import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  MIA_BASE_GLB_BASE64,
  MIA_LOCOMOTION_GLB_BASE64,
  MIA_ACTIONS_GLB_BASE64,
  MIA_COMBAT_GLB_BASE64
} from './assets/hero/mia/mia-assets.js';
import { addNormalDetail, addAlbedoDetail, strandRoughness, addCavityShade, waitForImage } from './mia-texture-detail.js';

/**
 * Mia's articulated hero model.
 *
 * The supplied CC0 GLB keeps every outfit variant in its own scene, and each
 * variant carries a full copy of the same 65-bone skeleton. Each retained
 * armature therefore keeps its own skeleton and every clip is duplicated per
 * armature with the loader's duplicate-name suffix applied, so all visible
 * skeletons stay in sync. No geometry is decimated and no texture is resized.
 */

const VISIBLE_MESHES = [
  'Superhero_Female',
  'Female_Ranger_Acc_Pauldrons',
  'Female_Ranger_Arms',
  'Female_Ranger_Arms_Bracer',
  'Female_Ranger_Body',
  'Female_Ranger_Body_Belt_1',
  'Female_Ranger_Body_Belt_2',
  'Female_Ranger_Feet',
  'Female_Ranger_Legs',
  'Hair_Long',
  'Eyes',
  'Eyebrows'
];

// The hero rig the village camera and world labels are framed for.
const HERO_HEIGHT = 3.34;
// Reference ground speeds (world units / second) for the borrowed cycles.
const WALK_REFERENCE_SPEED = 1.35;
const JOG_REFERENCE_SPEED = 3.1;
const SPRINT_REFERENCE_SPEED = 4.9;

const LOCOMOTION = ['Sword_Idle', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'];

function decodeBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function parseGLB(loader, base64) {
  return new Promise((resolve, reject) => {
    loader.parse(decodeBase64(base64), '', resolve, reject);
  });
}

/** Studio-like reflection probe so steel and gold read as metal, not paint. */
export function createHeroEnvironment(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  gradient.addColorStop(0, '#9fb9da');
  gradient.addColorStop(0.42, '#e7dcc8');
  gradient.addColorStop(0.55, '#b9a488');
  gradient.addColorStop(1, '#3b332b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 64);
  // A warm sun patch and a cool bounce keep highlights directional.
  const sun = ctx.createRadialGradient(96, 18, 2, 96, 18, 26);
  sun.addColorStop(0, 'rgba(255,244,214,1)');
  sun.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(60, 0, 68, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  texture.dispose();
  pmrem.dispose();
  return target.texture;
}

function collectArmatures(gltf) {
  const scenes = gltf.scenes && gltf.scenes.length ? gltf.scenes : [gltf.scene];
  const wanted = new Set(VISIBLE_MESHES);
  const selected = (object) => wanted.has(object.name)
    || (object.parent && wanted.has(object.parent.name));
  const entries = [];

  scenes.forEach((scene) => {
    const skinned = [];
    scene.traverse((object) => {
      // Multi-primitive GLB meshes become a Group whose children carry the
      // primitives, so match the parent name as well.
      if (object.isSkinnedMesh && selected(object)) skinned.push(object);
    });
    if (!skinned.length) return;

    const byArmature = new Map();
    skinned.forEach((mesh) => {
      let armature = mesh;
      while (armature.parent && !armature.parent.isScene) armature = armature.parent;
      if (!byArmature.has(armature)) byArmature.set(armature, []);
      byArmature.get(armature).push(mesh);
    });

    byArmature.forEach((meshes, armature) => {
      const rootBone = meshes[0].skeleton.bones[0];
      const suffix = rootBone.name.startsWith('root') ? rootBone.name.slice(4) : '';
      entries.push({ armature, suffix, meshes });
    });
  });

  return entries;
}

/** Rename a clip's tracks for one armature copy (root -> root_2, ...). */
function retargetClip(clip, suffix) {
  if (!suffix) return clip;
  const retargeted = clip.clone();
  retargeted.tracks = retargeted.tracks.map((track) => {
    const dot = track.name.lastIndexOf('.');
    if (dot < 0) return track;
    const copy = track.clone();
    copy.name = track.name.slice(0, dot) + suffix + track.name.slice(dot);
    return copy;
  });
  return retargeted;
}

/** Hand-painted dark chestnut hair: multiplies the albedo, texture untouched. */
/**
 * Replace the imported Phong-style materials with physically based ones.
 *
 * Sheen reproduces fabric and skin micro-fuzz (two cheap extra terms, no extra
 * maps), clearcoat keeps the eyes wet, anisotropy breaks the hair highlight into
 * strands, and specularIntensity tames broad plastic highlights. Every original
 * map (albedo, normal, rough/metal pack) is preserved; only the shading model
 * changes.
 */

/**
 * The atlas paints a red sash across the pauldron UVs; on steel that reads as a
 * rust blotch. Re-render the albedo with the colour removed and the luminance
 * compressed into a narrow gunmetal band, keeping every painted scratch.
 */
async function steelAlbedo(THREE, texture) {
  if (!texture || !texture.image) return null;
  const image = texture.image;
  if (image.decode) { try { await image.decode(); } catch (error) { /* already decoded */ } }
  if (!image.width || !image.height) return null;
  const size = Math.min(1024, Math.max(image.width, image.height));
  const scale = size / Math.max(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    const steel = 0.5 + (luminance - 0.5) * 0.26;
    data[i] = Math.max(0, Math.min(255, steel * 236));
    data[i + 1] = Math.max(0, Math.min(255, steel * 242));
    data[i + 2] = Math.max(0, Math.min(255, steel * 250));
  }
  context.putImageData(pixels, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = texture.colorSpace;
  result.wrapS = texture.wrapS;
  result.wrapT = texture.wrapT;
  result.flipY = texture.flipY;
  result.needsUpdate = true;
  return result;
}


function upgradeMaterials(meshes, environment) {
  const surfaceOf = (mesh, material) => {
    if (mesh.name === 'Eyebrows') return 'brow';
    if (mesh.name === 'Eyes') return 'eye';
    if (mesh.name.startsWith('Hair')) return 'hair';
    if (mesh.name === 'Superhero_Female') return 'skin';
    // Steel has its own re-graded albedo; cloth detail passes must not touch it.
    if (mesh.name === 'Female_Ranger_Acc_Pauldrons') return 'steel';
    if (mesh.name === 'Female_Ranger_Legs') return 'leather';
    return 'cloth';
  };

  meshes.forEach((mesh) => {
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((source) => {
      const surface = surfaceOf(mesh, source);
      const material = new THREE.MeshPhysicalMaterial({
        name: `${source.name} (${surface})`,
        map: source.map,
        normalMap: source.normalMap,
        roughnessMap: source.roughnessMap,
        metalnessMap: source.metalnessMap,
        color: source.color ? source.color.clone() : new THREE.Color(0xffffff),
        roughness: source.roughness ?? 0.8,
        metalness: source.metalness ?? 0,
        side: surface === 'hair' ? THREE.DoubleSide : THREE.FrontSide,
        envMap: environment,
        envMapIntensity: surface === 'eye' ? 0.9
          : surface === 'skin' ? 0.34
            : surface === 'hair' ? 0.55
              : surface === 'steel' ? 0.75
                : surface === 'leather' ? 0.3
                  : 0.4
      });
      if (source.normalScale) material.normalScale.copy(source.normalScale);
      material.specularIntensity = 0.5;
      material.ior = 1.4;

      if (surface === 'skin') {
        // Moonlight is cold, but skin has to stay warm or the face turns lilac.
        material.sheen = 0.2;
        material.sheenRoughness = 0.8;
        material.sheenColor.setHex(0xffbb9c);
        material.specularIntensity = 0.26;
        material.envMapIntensity = 0.1;
        material.attenuationColor = new THREE.Color(0xffb4a0);
      } else if (surface === 'cloth') {
        // Moonlit satin: a cool sheen and a high, tight specular instead of the
        // warm wool response the atlas was painted for.
        material.sheen = 0.3;
        material.sheenRoughness = 0.72;
        material.sheenColor.setHex(0x8497e4);
        material.specularIntensity = 0.42;
        material.envMapIntensity = 0.55;
        material.roughness = Math.min(1, (material.roughness ?? 0.8) * 0.82);
      } else if (surface === 'hair') {
        material.sheen = 0.38;
        material.sheenRoughness = 0.5;
        material.sheenColor.setHex(0x9db6e0);
        material.specularIntensity = 0.6;
        material.envMapIntensity = 0.45;
        material.roughness = 0.56;
      } else if (surface === 'eye') {
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.06;
        material.roughness = 0.2;
        material.specularIntensity = 0.9;
      } else if (surface === 'steel') {
        material.sheen = 0;
        material.metalness = 0.78;
        material.roughness = 0.3;
        material.specularIntensity = 0.7;
        material.color.setHex(0xa8bcca);
        // A cold, faint self-light at the plate edges, like the reference armour.
        material.emissive.setHex(0x0a1f2b);
        material.emissiveIntensity = 1;
      } else if (surface === 'leather') {
        material.sheen = 0.14;
        material.sheenRoughness = 0.8;
        material.sheenColor.setHex(0x7d7ba4);
        material.specularIntensity = 0.4;
      } else if (surface === 'brow') {
        material.color.setHex(0x8b8b98);
        material.roughness = 0.92;
        material.specularIntensity = 0.15;
        material.sheen = 0.2;
      }
      material.userData.surface = surface;
      material.needsUpdate = true;
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0];
  });
}



/**
 * The supplied hair mesh is a shoulder-length bob. The reference hero wears a
 * high, sweeping ponytail, so a tapered strand group is authored procedurally
 * and baked into the head bone's local space: no rig edits, no new textures and
 * it inherits every clip.
 *
 * Every length is a fraction of the *unscaled* body height, because the root is
 * normalised to HERO_HEIGHT after the rig is built; authoring in final world
 * units would make the hair nearly twice its intended size.
 */
function buildPonytail(bone, hairMaterial, forward, up, unit) {
  const group = new THREE.Group();
  group.name = 'MiaPonytail';
  if (!bone || !hairMaterial) return group;

  const head = bone.getWorldPosition(new THREE.Vector3());
  const inverse = new THREE.Matrix4().copy(bone.matrixWorld).invert();
  const back = forward.clone().negate();
  const side = new THREE.Vector3().crossVectors(up, forward).normalize();
  const u = unit;

  const strand = (lateral, lift, length, radius, taper, phase, sides = 8) => {
    const at = (height, backness, sway) => head.clone()
      .addScaledVector(up, height * u)
      .addScaledVector(back, backness * u)
      .addScaledVector(side, (lateral + sway) * u);
    // Crown → back of the skull → a long sweep down the spine.
    const points = [
      at(0.105 + lift, 0.015, 0),
      at(0.125 + lift, 0.055, 0.002),
      at(0.1 + lift, 0.115, 0.012 + phase),
      at(0.01 + lift, 0.135, 0.008 + phase),
      at(-0.09 * length + lift, 0.115, -0.006 + phase),
      at(-0.17 * length + lift, 0.09, -0.014 + phase * 0.5),
      at(-0.23 * length + lift, 0.06, -0.008)
    ];
    const geometry = taperedTube(sides, points, [radius * u, radius * taper * u]);
    geometry.applyMatrix4(inverse);
    const mesh = new THREE.Mesh(geometry, hairMaterial);
    mesh.castShadow = true;
    return mesh;
  };

  // One thick mass with two thinner locks lying against it: separate tubes read
  // as dreadlocks, a single silhouette reads as gathered hair.
  group.add(strand(0, 0, 1.0, 0.03, 0.2, 0, 12));
  group.add(strand(0.019, -0.002, 0.92, 0.014, 0.28, 0.004));
  group.add(strand(-0.02, -0.004, 0.88, 0.013, 0.26, 0.006));

  // A soft bun where the hair is gathered, so the tail grows out of the head
  // instead of hovering behind it.
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.026 * u, 16, 12), hairMaterial);
  bun.scale.set(1.25, 0.9, 1);
  bun.position.copy(head).addScaledVector(up, 0.105 * u).addScaledVector(back, 0.045 * u);
  bun.position.applyMatrix4(inverse);
  bun.castShadow = true;
  group.add(bun);

  // The leather tie that gathers the hair.
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.014 * u, 0.004 * u, 8, 18), hairMaterial);
  tie.position.copy(head).addScaledVector(up, 0.108 * u).addScaledVector(back, 0.04 * u);
  tie.position.applyMatrix4(inverse);
  const boneRotation = new THREE.Quaternion();
  bone.matrixWorld.decompose(new THREE.Vector3(), boneRotation, new THREE.Vector3());
  tie.quaternion.copy(boneRotation.invert()).multiply(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), forward.clone().addScaledVector(up, 0.5).normalize()));
  group.add(tie);
  return group;
}

/**
 * A tapered tube built from a hand-authored curve: the primitive that both the
 * crystal shards and the ponytail are made of, with a real radius falloff and
 * smooth normals (TubeGeometry cannot taper).
 */
function taperedTube(sides, points, radii) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.clone()));
  const steps = Math.max(6, points.length * 5);
  const positions = [];
  const indices = [];
  const frames = curve.computeFrenetFrames(steps, false);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const centre = curve.getPointAt(u);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    const radius = radii[0] + (radii[1] - radii[0]) * Math.pow(u, 0.8);
    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const offset = normal.clone().multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions.push(centre.x + offset.x, centre.y + offset.y, centre.z + offset.z);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Cold crystal accents on the shoulder plate and the chest harness, exactly the
 * motif of the reference armour. They are parented to bones, so they inherit
 * every animation, and they cost five draw calls and no texture.
 */
function buildCrystals(unit) {
  const glow = new THREE.MeshPhysicalMaterial({
    color: 0x5fd2f5, emissive: 0x1f9fd0, emissiveIntensity: 0.85,
    metalness: 0.35, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05,
    envMapIntensity: 1.1
  });
  const group = new THREE.Group();
  group.name = 'MiaCrystals';
  group.userData.material = glow;

  group.shard = (bone, worldPoint, worldAim, length, radius) => {
    if (!bone) return null;
    const geometry = new THREE.ConeGeometry(radius * unit, length * unit, 6, 1);
    const mesh = new THREE.Mesh(geometry, glow);
    const alignment = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), worldAim.clone().normalize());
    const boneRotation = new THREE.Quaternion();
    bone.matrixWorld.decompose(new THREE.Vector3(), boneRotation, new THREE.Vector3());
    mesh.position.copy(worldPoint.clone().applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert()));
    mesh.quaternion.copy(boneRotation.invert().multiply(alignment));
    group.add(mesh);
    return mesh;
  };
  return group;
}

function tintHair(meshes) {
  meshes.filter((mesh) => mesh.name === 'Hair_Long').forEach((hair) => {
    const materials = Array.isArray(hair.material) ? hair.material : [hair.material];
    materials.forEach((material) => {
      // The atlas is graded to platinum; the tint only lifts it into moonlight.
      material.color.setHex(0xd2d8e8);
      material.roughness = Math.min(1, (material.roughness ?? 0.8) * 0.86);
      if ('sheenColor' in material) material.sheenColor.setHex(0x9fb9e2);
      material.needsUpdate = true;
    });
  });
}


/**
 * Two tapered crimson belt tails. A single flat quad read as a banner behind
 * the back, so each tail is a narrow tapered strip with a centre fold that
 * catches the light, hanging beside the hip where the legs cannot clip it.
 */
class ClothTail {
  constructor(material, { length = 0.52, topWidth = 0.13, hemWidth = 0.1, phase = 0 }) {
    const rows = 10;
    const cols = 4;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const width = THREE.MathUtils.lerp(topWidth, hemWidth, t);
      for (let j = 0; j < cols; j++) {
        const u = j / (cols - 1);
        const x = (u - 0.5) * width;
        // Shallow V-fold down the middle, deeper towards the hem.
        const fold = Math.abs(u - 0.5) * 2;
        positions.push(x, -t * length, -0.012 - fold * (0.012 + t * 0.02));
        uvs.push(u, 1 - t);
      }
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j;
        indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.length = length;
    this.geometry = geometry;
    this.base = geometry.attributes.position.array.slice();
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.phase = phase;
  }

  update(dt, speed) {
    this.phase += dt * (1.2 + speed * 1.3);
    const move = THREE.MathUtils.clamp(speed / 3.2, 0, 1);
    const positions = this.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = this.base[i * 3];
      const y = this.base[i * 3 + 1];
      const z = this.base[i * 3 + 2];
      const t = Math.min(1, -y / this.length);
      const wave = Math.sin(this.phase * 1.8 + t * 4.2 + x * 12);
      positions.setZ(i, z + wave * (0.01 + move * 0.055) * (0.2 + t));
      positions.setX(i, x + Math.sin(this.phase * 1.1 + t * 2.6) * 0.012 * t);
    }
    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

/**
 * Crimson scarf: several tapered cloth bands stacked with slight offsets and a
 * hanging tail, so it reads as wrapped fabric instead of a solid ring.
 */
/**
 * A wound scarf: two overlapping loops whose surface is displaced along its own
 * normals, so the folds catch light like knit cloth instead of reading as two
 * clean rubber tubes.
 */
function buildScarf(material) {
  const group = new THREE.Group();
  group.name = 'MiaScarf';

  const folded = (radius, tube, folds, phase, amplitude) => {
    const geometry = new THREE.TorusGeometry(radius, tube, 12, 56);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const vertex = new THREE.Vector3();
    const direction = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      direction.fromBufferAttribute(normal, i);
      const angle = Math.atan2(vertex.y, vertex.x);
      const fold = Math.sin(angle * folds + phase) * amplitude
        + Math.sin(angle * folds * 2.7 + phase * 1.7) * amplitude * 0.42;
      position.setXYZ(
        i,
        vertex.x + direction.x * fold,
        vertex.y + direction.y * fold,
        vertex.z + direction.z * fold
      );
    }
    geometry.computeVertexNormals();
    return geometry;
  };

  const loops = [
    { radius: 0.063, tube: 0.025, folds: 9, phase: 0.6, amplitude: 0.0026, y: 0.008, tilt: 0.05, roll: 0.18, scale: [1.2, 1, 0.92] },
    { radius: 0.056, tube: 0.021, folds: 8, phase: 2.4, amplitude: 0.0022, y: 0.046, tilt: -0.09, roll: -0.28, scale: [1.15, 1, 0.9] },
    { radius: 0.068, tube: 0.018, folds: 7, phase: 4.1, amplitude: 0.0020, y: -0.03, tilt: 0.12, roll: 0.42, scale: [1.24, 1, 0.88] }
  ];
  loops.forEach((loop) => {
    const mesh = new THREE.Mesh(folded(loop.radius, loop.tube, loop.folds, loop.phase, loop.amplitude), material);
    mesh.rotation.set(Math.PI / 2, loop.tilt, loop.roll);
    mesh.position.set(0, loop.y, loop === loops[2] ? 0.008 : 0);
    mesh.scale.set(loop.scale[0], loop.scale[1], loop.scale[2]);
    mesh.castShadow = true;
    group.add(mesh);
  });

  return group;
}

/** Single-edged shamshir built as a real blade profile with a rounded spine. */
class Shamshir {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaShamshir';

    const blade = new THREE.Shape();
    blade.moveTo(-0.036, 0);
    blade.lineTo(0.036, 0);
    // A shamshir: the cutting edge sweeps forward while the spine stays nearly
    // straight, then both curves meet in a fine point.
    blade.quadraticCurveTo(0.072, 0.36, 0.112, 0.66);
    blade.quadraticCurveTo(0.136, 0.86, 0.09, 0.98);
    blade.quadraticCurveTo(0.086, 0.82, 0.062, 0.64);
    blade.quadraticCurveTo(0.02, 0.36, -0.036, 0);
    const bladeGeometry = new THREE.ExtrudeGeometry(blade, {
      depth: 0.022, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 36
    });
    bladeGeometry.translate(0, 0, -0.007);
    const bladeMesh = new THREE.Mesh(bladeGeometry, materials.steel);
    bladeMesh.castShadow = true;
    group.add(bladeMesh);

    // A narrow, recessed spine highlight reads as a forged fuller without a box.
    const fullerShape = new THREE.Shape();
    fullerShape.moveTo(-0.006, 0.07);
    fullerShape.lineTo(0.006, 0.07);
    fullerShape.quadraticCurveTo(0.022, 0.42, 0.032, 0.72);
    fullerShape.quadraticCurveTo(0.019, 0.44, -0.006, 0.07);
    // The rib has to clear the blade's own slabs (z ±0.015) on both faces, or
    // the two coplanar surfaces fight and the edge turns into a sawtooth.
    const fullerGeometry = new THREE.ExtrudeGeometry(fullerShape, {
      depth: 0.036, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003,
      bevelSegments: 1, curveSegments: 22
    });
    fullerGeometry.translate(0, 0, -0.018);
    // A polished channel, not a black bar: a slightly darker steel that still
    // takes the same reflections as the blade faces.
    const fullerMaterial = materials.steel.clone();
    fullerMaterial.color = new THREE.Color(0x87929c);
    fullerMaterial.roughness = 0.28;
    fullerMaterial.metalness = 0.95;
    // The reference weapon carries a cold inner glow rather than a plain groove.
    fullerMaterial.emissive.setHex(0x1f8fb5);
    fullerMaterial.emissiveIntensity = 0.55;
    const fuller = new THREE.Mesh(fullerGeometry, fullerMaterial);
    group.add(fuller);

    const guard = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.19, 6, 12), materials.gold);
    guard.rotation.z = Math.PI / 2;
    guard.position.y = -0.004;
    group.add(guard);
    [-1, 1].forEach((side) => {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 9), materials.gold);
      tip.position.set(side * 0.112, -0.01 + side * 0.01, 0);
      group.add(tip);
    });

    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.026, 0.16, 14), materials.leather);
    grip.position.y = -0.093;
    group.add(grip);
    for (let i = 0; i < 5; i++) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.004, 5, 14), materials.gold);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = -0.032 - i * 0.03;
      group.add(wrap);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), materials.gold);
    pommel.position.y = -0.183;
    pommel.scale.y = 0.85;
    group.add(pommel);

    this.group = group;
    this.blade = bladeMesh;
  }
}

/**
 * Measure the fist so the sword sits in the palm instead of floating beside the
 * hand, and so the fingers can close around the grip. All values are expressed
 * in the right hand bone's local space.
 */
function measureFist(boneByName) {
  const read = (name) => boneByName.get(name) || null;
  const hand = read('hand_r');
  if (!hand) return null;
  hand.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(hand.matrixWorld).invert();
  const local = (bone) => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);

  const index = read('index_01_r');
  const middle = read('middle_01_r');
  const pinky = read('pinky_01_r');
  const ring = read('ring_01_r');
  const indexMid = read('index_02_r');
  if (!index || !middle || !pinky || !ring || !indexMid) return null;

  const pIndex = local(index);
  const pMiddle = local(middle);
  const pPinky = local(pinky);
  const pRing = local(ring);
  const pIndexMid = local(indexMid);

  const palmCenter = pIndex.clone().add(pMiddle).add(pRing).add(pPinky).multiplyScalar(0.25);
  // The handle crosses the palm, from the little finger towards thumb/index.
  const bladeAxis = pIndex.clone().sub(pPinky).normalize();
  // The fingers curl around that axis; their direction is the blade's normal.
  const fingerDirection = pIndexMid.clone().sub(pIndex).normalize();
  const bladeNormal = fingerDirection
    .clone()
    .sub(bladeAxis.clone().multiplyScalar(fingerDirection.dot(bladeAxis)))
    .normalize();
  const sideAxis = new THREE.Vector3().crossVectors(bladeAxis, bladeNormal).normalize();
  return { hand, palmCenter, gripAxis: bladeAxis, palmNormal: bladeNormal, sideAxis };
}

/**
 * Quaternion that maps the sword's local +Y (blade) onto the grip axis across
 * the palm and keeps the blade flat against the palm normal.
 */
function gripOrientation(fist) {
  const basis = new THREE.Matrix4().makeBasis(fist.sideAxis, fist.gripAxis, fist.palmNormal);
  return new THREE.Quaternion().setFromRotationMatrix(basis);
}

export async function loadMiaHero(options = {}) {
  const { renderer = null, materials = {} } = options;
  const loader = new GLTFLoader();
  const [base, locomotion, actions, combat] = await Promise.all([
    parseGLB(loader, MIA_BASE_GLB_BASE64),
    parseGLB(loader, MIA_LOCOMOTION_GLB_BASE64),
    parseGLB(loader, MIA_ACTIONS_GLB_BASE64),
    parseGLB(loader, MIA_COMBAT_GLB_BASE64)
  ]);

  const root = new THREE.Group();
  root.name = 'MiaHeroModel';
  const rig = new THREE.Group();
  rig.name = 'MiaHeroRig';
  root.add(rig);

  const armatures = collectArmatures(base);
  if (!armatures.length) throw new Error('Mia meshes missing from base GLB');

  const environment = renderer ? createHeroEnvironment(renderer) : null;
  const visibleMeshes = [];
  armatures.forEach(({ armature, meshes }) => {
    rig.add(armature);
    armature.position.set(0, 0, 0);
    armature.rotation.set(0, 0, 0);
    armature.scale.set(1, 1, 1);
    const keep = new Set(meshes);
    armature.traverse((object) => {
      if (object.isMesh && !keep.has(object)) object.visible = false;
    });
    meshes.forEach((mesh) => {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      visibleMeshes.push(mesh);
    });
  });

  upgradeMaterials(visibleMeshes, environment);
  // The atlas paints the shoulder plate cream; Mia wears gunmetal. Tint only the
  // pauldron mesh so cloth and leather keep their painted colour.
  visibleMeshes.filter((mesh) => mesh.name === 'Female_Ranger_Acc_Pauldrons').forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      steelAlbedo(THREE, material.map).then((map) => {
        if (!map) return;
        material.map = map;
        material.needsUpdate = true;
      }).catch(() => {});
      material.color.setHex(0xaab2ba);
      material.metalness = 0.55;
      material.roughness = 0.38;
      material.sheen = 0;
      material.envMapIntensity = 0.6;
      material.needsUpdate = true;
    });
  });
  tintHair(visibleMeshes);
  // Detail passes run once and are shared: the same atlas feeds several meshes,
  // so the derived canvas is cached per source texture.
  const detailCache = new Map();
  const once = (key, factory) => {
    if (!detailCache.has(key)) detailCache.set(key, Promise.resolve(factory()));
    return detailCache.get(key);
  };
  const detailJobs = [];
  visibleMeshes.forEach((mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (material.userData.detailApplied) return;
      material.userData.detailApplied = true;
      if (material.userData.surface === 'skin') {
        if (material.map && material.normalMap) {
          const albedo = material.map;
          const normal = material.normalMap;
          detailJobs.push(once(`skin-cavity-${material.uuid}`, () =>
            addCavityShade(THREE, albedo, normal, 0.09, 0.03)
          ).then((map) => { material.map = map; material.needsUpdate = true; }));
        }
        if (material.normalMap) {
          detailJobs.push(once(`skin-normal-${material.uuid}`, () =>
            addNormalDetail(THREE, material.normalMap, 'pores', 0.3, 7001)
          ).then((map) => { material.normalMap = map; material.needsUpdate = true; }));
        }
      } else if (material.userData.surface === 'cloth') {
        if (material.normalMap) {
          detailJobs.push(once(`cloth-normal-${material.uuid}`, () => addNormalDetail(THREE, material.normalMap, 'weave', 0.22, 7002)
            .then((woven) => addNormalDetail(THREE, woven, 'folds', 0.26, 7102))
          ).then((map) => { material.normalMap = map; material.needsUpdate = true; }));
        }
        if (material.map && material.normalMap) {
          const albedo = material.map;
          const normal = material.normalMap;
          detailJobs.push(once(`cloth-cavity-${material.uuid}`, () =>
            addCavityShade(THREE, albedo, normal, 0.12, 0.03)
          ).then((map) => { material.map = map; material.needsUpdate = true; }));
        }
      } else if (material.userData.surface === 'hair') {
        if (material.normalMap) {
          detailJobs.push(once(`hair-normal-${material.uuid}`, () =>
            addNormalDetail(THREE, material.normalMap, 'strands', 0.62, 7003)
          ).then((map) => { material.normalMap = map; material.needsUpdate = true; }));
        }
        if (material.map) {
          detailJobs.push(once(`hair-rough-${material.uuid}`, () =>
            strandRoughness(THREE, material.map, 9001, 512)
          ).then((map) => { material.roughnessMap = map; material.metalnessMap = null; material.needsUpdate = true; }));
          detailJobs.push(once(`hair-albedo-${material.uuid}`, () =>
            addAlbedoDetail(THREE, material.map, 'strands', 0.09, 7003)
          ).then((map) => { material.map = map; material.needsUpdate = true; }));
        }
      } else if (material.userData.surface === 'brow') {
        if (material.map) {
          detailJobs.push(once(`brow-albedo-${material.uuid}`, () =>
            addAlbedoDetail(THREE, material.map, 'strands', 0.08, 7004)
          ).then((map) => { material.map = map; material.needsUpdate = true; }));
        }
      }
    });
  });

  const clips = [...locomotion.animations, ...actions.animations, ...combat.animations]
    .filter((clip, index, list) => list.findIndex((other) => other.name === clip.name) === index);
  const byName = new Map(clips.map((clip) => [clip.name, clip]));

  // The plain (unsuffixed) armature carries the body, so sockets attach to it.
  const primary = armatures.find((entry) => entry.suffix === '') || armatures[0];
  const boneByName = new Map();
  primary.meshes[0].skeleton.bones.forEach((bone) => {
    if (bone.name && !boneByName.has(bone.name)) boneByName.set(bone.name, bone);
  });

  // Prop materials: fall back to purpose-built PBR materials so the sword reads
  // as forged steel even when the caller does not supply its own set.
  const defaultProps = {
    steel: new THREE.MeshStandardMaterial({ color: 0x8d99a4, metalness: 0.9, roughness: 0.34 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x3c454d, metalness: 0.85, roughness: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xb9924e, metalness: 0.86, roughness: 0.34 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.82 }),
    cape: new THREE.MeshStandardMaterial({ color: 0x7c1d27, roughness: 0.94, side: THREE.DoubleSide })
  };
  const withEnvironment = (material) => {
    if (!material) return material;
    if (environment && !material.envMap) {
      material.envMap = environment;
      material.envMapIntensity = 0.7;
      material.needsUpdate = true;
    }
    return material;
  };
  const propMaterial = (key) => withEnvironment(materials[key] || defaultProps[key]);

  // Animation graph first: the sword is fitted to the posed idle hand, not to
  // the bind pose, so the grip sits inside the fist exactly as it is rendered.
  const mixer = new THREE.AnimationMixer(root);
  const actionSets = new Map();
  byName.forEach((clip, name) => {
    const actions = armatures.map(({ suffix }) => mixer.clipAction(retargetClip(clip, suffix)));
    actions.forEach((action) => action.play());
    actionSets.set(name, actions);
  });

  const setWeights = (name, duration) => {
    actionSets.forEach((actions, key) => {
      actions.forEach((action) => {
        action.enabled = true;
        if (key === name) action.fadeIn(duration);
        else action.fadeOut(duration);
      });
    });
  };

  LOCOMOTION.forEach((name) => {
    const actions = actionSets.get(name);
    if (!actions) return;
    actions.forEach((action) => {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.setEffectiveWeight(name === 'Sword_Idle' ? 1 : 0);
    });
  });

  const idleActions = actionSets.get('Sword_Idle') || [];
  idleActions.forEach((action) => action.setEffectiveWeight(1));
  mixer.update(0);
  root.updateMatrixWorld(true);

  const sword = new Shamshir({
    steel: propMaterial('steel'),
    steelDark: propMaterial('steelDark'),
    gold: propMaterial('gold'),
    leather: propMaterial('leather')
  });

  // Constant local rotations applied after the mixer each frame: they never
  // touch the clip data, so damage, cooldowns and timings stay as authored.
  const poseOffsets = [];
  const offhandOffsets = [];
  const wristOffsets = [];
  let correctionWeight = 1;

  const fist = measureFist(boneByName);
  if (fist) {
    const gripScale = 0.86;
    sword.group.scale.setScalar(gripScale);
    sword.group.quaternion.copy(gripOrientation(fist));
    const gripCentre = new THREE.Vector3(0, -0.093, 0)
      .multiplyScalar(gripScale)
      .applyQuaternion(sword.group.quaternion);
    sword.group.position.copy(fist.palmCenter).sub(gripCentre);
    fist.hand.add(sword.group);
    root.updateMatrixWorld(true);

    // Bend the wrist so the resting blade hangs down instead of sticking out
    // sideways; the same offset fades out during combat so slash poses stay
    // exactly as the animation author left them.
    const hand = fist.hand;
    const handWorld = hand.getWorldQuaternion(new THREE.Quaternion());
    const bladeWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(handWorld.clone().multiply(sword.group.quaternion));
    const targetWorld = new THREE.Vector3(0.22, -0.96, 0.16).normalize();
    let angle = bladeWorld.angleTo(targetWorld);
    const axisWorld = new THREE.Vector3().crossVectors(bladeWorld, targetWorld);
    if (axisWorld.lengthSq() > 1e-8 && angle > 0.001) {
      axisWorld.normalize();
      angle = Math.min(angle, 1.15);
      const parentWorld = hand.parent.getWorldQuaternion(new THREE.Quaternion());
      const correction = new THREE.Quaternion().setFromAxisAngle(axisWorld, angle);
      const local = parentWorld.clone().invert().multiply(correction).multiply(parentWorld);
      wristOffsets.push({ bone: hand, quaternion: local });
    }
    // The fingers wrap the handle; their curl axis is the grip axis.
    const curl = (name, amount) => {
      const bone = boneByName.get(name);
      if (!bone) return;
      const worldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
      const axis = fist.gripAxis.clone().applyQuaternion(worldQuaternion.clone().invert()).normalize();
      poseOffsets.push({ bone, quaternion: new THREE.Quaternion().setFromAxisAngle(axis, amount) });
    };
    ['index', 'middle', 'ring', 'pinky'].forEach((finger, index) => {
      const scale = index === 3 ? 0.82 : 1;
      curl(`${finger}_01_r`, 0.5 * scale);
      curl(`${finger}_02_r`, 0.62 * scale);
      curl(`${finger}_03_r`, 0.42 * scale);
    });
    const thumbAxisLocal = fist.palmNormal.clone().applyQuaternion(handWorld.clone().invert()).normalize();
    [['thumb_01_r', -0.3], ['thumb_02_r', 0.42], ['thumb_03_r', 0.34]].forEach(([name, amount]) => {
      const bone = boneByName.get(name);
      if (!bone) return;
      poseOffsets.push({ bone, quaternion: new THREE.Quaternion().setFromAxisAngle(thumbAxisLocal, amount) });
    });
    // The free hand relaxes into a soft curl instead of an open claw.
    ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
      const bone = boneByName.get(`${finger}_02_l`);
      if (!bone) return;
      const worldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuaternion).normalize();
      offhandOffsets.push({
        bone,
        quaternion: new THREE.Quaternion().setFromAxisAngle(axis.applyQuaternion(worldQuaternion.clone().invert()).normalize(), 0.24)
      });
    });
  }

  // Shoulders relax slightly in idle/walk; the weight fades away for one-shots.
  [['upperarm_l', -0.3, 0.08], ['upperarm_r', 0.3, -0.08]].forEach(([name, roll, yaw]) => {
    const bone = boneByName.get(name);
    if (!bone) return;
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, roll, 'XYZ'));
    poseOffsets.push({ bone, quaternion, weight: 0 });
  });

  const applyOffsets = (weight) => {
    const amount = new THREE.Quaternion();
    for (let i = 0; i < poseOffsets.length; i++) {
      const { bone, quaternion, weight: fixedWeight } = poseOffsets[i];
      const w = fixedWeight === undefined ? 1 : weight;
      if (w <= 0.001) continue;
      amount.identity().slerp(quaternion, w);
      bone.quaternion.multiply(amount);
    }
    for (let i = 0; i < offhandOffsets.length; i++) {
      const { bone, quaternion } = offhandOffsets[i];
      bone.quaternion.multiply(quaternion);
    }
    for (let i = 0; i < wristOffsets.length; i++) {
      const { bone, quaternion } = wristOffsets[i];
      amount.identity().slerp(quaternion, weight);
      bone.quaternion.premultiply(amount);
    }
  };

  const clothMaterial = propMaterial('cape');
  const tailMaterial = clothMaterial.clone();
  tailMaterial.color.setHex(0x1b2140);
  tailMaterial.roughness = 0.97;
  tailMaterial.envMapIntensity = 0.18;
  if (environment) tailMaterial.envMap = environment;
  const tailLeft = new ClothTail(tailMaterial, { length: 0.32, topWidth: 0.09, hemWidth: 0.065, phase: 0 });
  const tailRight = new ClothTail(tailMaterial, { length: 0.24, topWidth: 0.07, hemWidth: 0.05, phase: 1.7 });
  const tails = [tailLeft, tailRight];
  const waist = boneByName.get('pelvis') || boneByName.get('spine_01');
  if (waist) {
    // Two short belt tails flank the hips: they clear the legs while walking
    // and cannot cut through the torso when the spine bends in combat.
    tailLeft.mesh.position.set(0.128, 0.01, -0.045);
    tailLeft.mesh.rotation.set(0.1, 0.62, 0.1);
    tailRight.mesh.position.set(-0.132, 0.01, -0.07);
    tailRight.mesh.rotation.set(0.06, -0.58, -0.09);
    waist.add(tailLeft.mesh);
    waist.add(tailRight.mesh);
  }
  const scarfMaterial = clothMaterial.clone();
  scarfMaterial.color.setHex(0x1a1f3d);
  scarfMaterial.roughness = 0.82;
  scarfMaterial.envMapIntensity = 0.5;
  if (environment) scarfMaterial.envMap = environment;
  // Geometry authored here is measured against the *unscaled* body, because the
  // root is normalised to HERO_HEIGHT at the end of this function.
  const unitHeight = Math.max(0.4, new THREE.Box3().setFromObject(rig).getSize(new THREE.Vector3()).y || 1.8);

  // Cold crystal accents on the shoulder plate and the chest harness.
  const crystals = buildCrystals(unitHeight / 1.8);
  const pauldron = visibleMeshes.find((mesh) => mesh.name === 'Female_Ranger_Acc_Pauldrons');
  const eyes = visibleMeshes.find((mesh) => mesh.name === 'Eyes');
  const headBone = boneByName.get('Head') || boneByName.get('head');
  const spineBone = boneByName.get('spine_03') || boneByName.get('spine_02');
  const clavicle = boneByName.get('clavicle_r') || boneByName.get('upperarm_r');
  if (pauldron && eyes && headBone && spineBone && clavicle) {
    // The face is the only reliable forward reference: mirrored rigs disagree
    // about hand order, but the eyes always point where the character looks.
    const eyeCentre = new THREE.Box3().setFromObject(eyes).getCenter(new THREE.Vector3());
    const headWorld = headBone.getWorldPosition(new THREE.Vector3());
    const forward = eyeCentre.sub(headWorld).setY(0).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize().negate();

    const plate = new THREE.Box3().setFromObject(pauldron);
    const plateCentre = plate.getCenter(new THREE.Vector3());
    const top = plate.max.y;
    const grain = unitHeight / 1.8;
    crystals.shard(clavicle, new THREE.Vector3(plateCentre.x, top + 0.002 * grain, plateCentre.z - 0.008 * grain),
      up.clone().addScaledVector(right, -0.3).addScaledVector(forward, 0.1), 0.032, 0.008);
    crystals.shard(clavicle, new THREE.Vector3(plateCentre.x + 0.022 * grain, top - 0.01 * grain, plateCentre.z + 0.016 * grain),
      up.clone().addScaledVector(right, -0.85).addScaledVector(forward, 0.25), 0.022, 0.006);
    crystals.shard(clavicle, new THREE.Vector3(plateCentre.x - 0.024 * grain, top - 0.014 * grain, plateCentre.z - 0.026 * grain),
      up.clone().addScaledVector(forward, -0.7), 0.018, 0.005);

    const spine = spineBone.getWorldPosition(new THREE.Vector3());
    // One small shard above the harness, not a gem cluster on the collar.
    const chest = spine.clone().addScaledVector(forward, 0.085 * grain).addScaledVector(up, 0.02);
    crystals.shard(spineBone, chest, forward.clone().addScaledVector(up, 0.2), 0.018, 0.006);
    clavicle.add(crystals);
  }

  const hairMesh = visibleMeshes.find((mesh) => mesh.name === 'Hair_Long');
  if (hairMesh && headBone && eyes) {
    const eyeCentre = new THREE.Box3().setFromObject(eyes).getCenter(new THREE.Vector3());
    const headWorld = headBone.getWorldPosition(new THREE.Vector3());
    const facing = eyeCentre.sub(headWorld).setY(0).normalize();
    const ponytail = buildPonytail(headBone, Array.isArray(hairMesh.material) ? hairMesh.material[0] : hairMesh.material,
      facing, new THREE.Vector3(0, 1, 0), unitHeight);
    headBone.add(ponytail);
  }

  const scarf = buildScarf(scarfMaterial);
  const neck = boneByName.get('neck_01');
  if (neck) {
    scarf.position.set(0, 0.02, 0);
    neck.add(scarf);
  }

  let currentName = 'Sword_Idle';
  const referenceSpeed = {
    'Walk_Loop': WALK_REFERENCE_SPEED,
    'Jog_Fwd_Loop': JOG_REFERENCE_SPEED,
    'Sprint_Loop': SPRINT_REFERENCE_SPEED
  };
  const speedToClip = (speed) => {
    if (speed > SPRINT_REFERENCE_SPEED * 0.72) return 'Sprint_Loop';
    if (speed > JOG_REFERENCE_SPEED * 0.62) return 'Jog_Fwd_Loop';
    if (speed > 0.12) return 'Walk_Loop';
    return 'Sword_Idle';
  };

  let oneShotName = null;
  let oneShotTimer = 0;

  const playOneShot = (name, fadeDuration = 0.12) => {
    const actions = actionSets.get(name);
    if (!actions) return null;
    actionSets.get(currentName)?.forEach((action) => action.fadeOut(fadeDuration));
    actions.forEach((action) => {
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.setEffectiveWeight(1);
      action.fadeIn(fadeDuration);
      action.play();
    });
    oneShotName = name;
    oneShotTimer = (byName.get(name)?.duration || 0.6) - fadeDuration * 0.5;
    return actions;
  };

  const update = (dt, speed = 0) => {
    if (!oneShotName) {
      const name = speedToClip(speed);
      if (name !== currentName && actionSets.has(name)) {
        currentName = name;
        setWeights(name, 0.26);
      }
      const reference = referenceSpeed[currentName];
      const timeScale = reference ? THREE.MathUtils.clamp(speed / reference, 0.55, 1.6) : 1;
      actionSets.get(currentName)?.forEach((action) => action.setEffectiveTimeScale(timeScale));
    } else {
      oneShotTimer -= dt;
      if (oneShotTimer <= 0) {
        actionSets.get(oneShotName)?.forEach((action) => action.fadeOut(0.18));
        oneShotName = null;
        setWeights(currentName, 0.2);
      }
    }
    tails.forEach((tail) => tail.update(dt, speed));
    // Combat clips are authored for the raw rig, so the resting wrist and
    // shoulder corrections fade out for one-shots and return afterwards.
    correctionWeight += ((oneShotName ? 0 : 1) - correctionWeight) * (1 - Math.exp(-dt * 11));
    mixer.update(dt);
    applyOffsets(correctionWeight);
  };

  // Apply the resting corrections, then frame the character for the existing
  // village camera. SkinnedMesh bounds need the posed matrices, so the props are
  // hidden for the single measurement.
  applyOffsets(1);
  root.updateMatrixWorld(true);
  sword.group.visible = false;
  tails.forEach((tail) => { tail.mesh.visible = false; });
  const bodyBounds = new THREE.Box3().setFromObject(rig);
  sword.group.visible = true;
  tails.forEach((tail) => { tail.mesh.visible = true; });
  const size = new THREE.Vector3();
  bodyBounds.getSize(size);
  const scale = HERO_HEIGHT / (size.y || 2);
  root.scale.setScalar(scale);
  root.position.y = -bodyBounds.min.y * scale;

  return {
    root,
    meshes: visibleMeshes,
    armatures: armatures.map((entry) => entry.armature),
    clips,
    mixer,
    playOneShot,
    update,
    sword: sword.group,
    sash: tailLeft.mesh,
    tails: tails.map((tail) => tail.mesh),
    scarf,
    bone: (name) => boneByName.get(name) || null,
    height: HERO_HEIGHT,
    environment
  };
}
