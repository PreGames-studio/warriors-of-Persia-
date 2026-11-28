import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  MIA_BASE_GLB_BASE64,
  MIA_LOCOMOTION_GLB_BASE64,
  MIA_ACTIONS_GLB_BASE64,
  MIA_COMBAT_GLB_BASE64
} from './assets/hero/mia/mia-assets.js';
import { weaponKindFor } from './equipment.js';
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
// Fallback ground speeds (world units / second) for the borrowed cycles. The
// live numbers are measured from the clips in `measureReferenceSpeeds`, because
// these files walk at 1.93 and jog at 4.99 world units on the 3.34-unit rig.
const WALK_REFERENCE_SPEED = 1.93;
const JOG_REFERENCE_SPEED = 4.99;
const SPRINT_REFERENCE_SPEED = 6.08;
// Local X of a hand bone is the axis the palm rolls around while walking.
const WRIST_SWAY_AXIS = new THREE.Vector3(1, 0, 0);

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

/**
 * Load a candidate character GLB from a URL. Only the review harness uses this:
 * it lets us render an art pass straight from a build artefact, without first
 * re-embedding it in mia-assets.js.
 */
export async function parseGLBFromUrl(loader, url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Mia GLB fetch failed: ${url} (${response.status})`);
  const buffer = await response.arrayBuffer();
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
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
          : surface === 'skin' ? 0.32
            : surface === 'hair' ? 0.42
              : surface === 'steel' ? 0.34
                : 0.26
      });
      if (source.normalScale) material.normalScale.copy(source.normalScale);
      material.specularIntensity = 0.5;
      material.ior = 1.4;

      if (surface === 'skin') {
        // The anime face pass (Tools/stylize_mia_face.py) reads best on smooth,
        // evenly lit skin: the sculpted normal detail is eased off and a small
        // warm emissive keeps the soft shadows from going grim.
        material.normalScale.set(0.5, 0.5);
        material.emissive.setHex(0x241610);
        material.emissiveIntensity = 1;
        material.sheen = 0.16;
        material.sheenRoughness = 0.85;
        material.sheenColor.setHex(0xff9c80);
        material.specularIntensity = 0.34;
        material.envMapIntensity = 0.22;
      } else if (surface === 'cloth') {
        material.sheen = 0.2;
        material.sheenRoughness = 0.9;
        material.sheenColor.setHex(0x8a5a52);
        material.specularIntensity = 0.28;
        material.envMapIntensity = 0.14;
      } else if (surface === 'hair') {
        material.sheen = 0.4;
        material.sheenRoughness = 0.58;
        material.sheenColor.setHex(0xb07c52);
        material.specularIntensity = 0.55;
        material.envMapIntensity = 0.3;
      } else if (surface === 'eye') {
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.06;
        material.roughness = 0.2;
        material.specularIntensity = 0.9;
      } else if (surface === 'steel') {
        material.sheen = 0;
        material.metalness = 0.55;
        material.roughness = 0.38;
        material.specularIntensity = 0.6;
      } else if (surface === 'brow') {
        // Warm mid-brown instead of near-black: the authored card is wide, so a
        // dark tint read as a heavy frown on an otherwise soft face.
        material.color.setHex(0x7d5540);
        material.roughness = 0.94;
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

function tintHair(meshes) {
  meshes.filter((mesh) => mesh.name === 'Hair_Long').forEach((hair) => {
    const materials = Array.isArray(hair.material) ? hair.material : [hair.material];
    materials.forEach((material) => {
      material.color.setHex(0x5f3d2b);
      material.roughness = Math.min(1, (material.roughness ?? 0.8) + 0.08);
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
 * The weapons Mia can carry, all built in the same local space as the shamshir:
 * the grip sits at y = 0 and the business end points along +Y.
 */
class WarHammer {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaWarHammer';
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.92, 12), materials.leather);
    shaft.position.y = 0.34;
    group.add(shaft);
    for (let i = 0; i < 6; i += 1) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.004, 5, 12), materials.gold);
      wrap.rotation.x = Math.PI / 2;
      wrap.position.y = -0.05 + i * 0.09;
      group.add(wrap);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.20, 0.15), materials.steelDark);
    head.position.y = 0.84;
    head.castShadow = true;
    group.add(head);
    // Two polished striking faces: the brightest part of the prop, so the hammer
    // still reads as a hammer in a 640px-wide screenshot.
    [-1, 1].forEach((side) => {
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.17), materials.steel);
      face.position.set(side * 0.165, 0.84, 0);
      group.add(face);
    });
    [-1, 1].forEach((side) => {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.20, 0.16), materials.gold);
      cheek.position.set(side * 0.125, 0.84, 0);
      group.add(cheek);
    });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.165), materials.gold);
    band.position.y = 0.725;
    group.add(band);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 10), materials.steel);
    spike.position.y = 0.975;
    group.add(spike);
    this.group = group;
  }
}

class BattleAxe {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaBattleAxe';
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 1.0, 12), materials.leather);
    shaft.position.y = 0.30;
    group.add(shaft);
    const blade = new THREE.Shape();
    blade.moveTo(0.03, 0.05);
    blade.quadraticCurveTo(0.30, 0.10, 0.33, 0.30);
    blade.quadraticCurveTo(0.34, 0.50, 0.26, 0.62);
    blade.quadraticCurveTo(0.16, 0.42, 0.03, 0.40);
    blade.closePath();
    const geometry = new THREE.ExtrudeGeometry(blade, {
      depth: 0.028, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 20
    });
    geometry.translate(0, 0, -0.014);
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(geometry, materials.steel);
      wing.position.y = 0.62;
      wing.scale.x = side;
      wing.castShadow = true;
      group.add(wing);
    });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 12), materials.gold);
    collar.position.y = 0.62;
    group.add(collar);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 9), materials.gold);
    pommel.position.y = -0.20;
    group.add(pommel);
    this.group = group;
  }
}

class ImmortalSpear {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaImmortalSpear';
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 2.1, 12), materials.leather);
    shaft.position.y = 0.55;
    group.add(shaft);
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.12, 12), materials.gold);
    socket.position.y = 1.55;
    group.add(socket);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 12), materials.steel);
    head.position.y = 1.78;
    head.castShadow = true;
    group.add(head);
    [-1, 1].forEach((side) => {
      const wing = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.14, 8), materials.gold);
      wing.position.set(side * 0.05, 1.60, 0);
      wing.rotation.z = side * -0.5;
      group.add(wing);
    });
    const butt = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.10, 10), materials.gold);
    butt.position.y = -0.52;
    butt.rotation.x = Math.PI;
    group.add(butt);
    this.group = group;
  }
}

class ArashBow {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaArashBow';
    // The limb is a torus arc: it reads as a recurve from every camera angle and
    // costs a fraction of an extruded bow profile.
    const limb = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.019, 8, 40, Math.PI * 0.86),
      materials.leather
    );
    limb.rotation.z = Math.PI * 0.57;
    limb.position.y = 0.30;
    group.add(limb);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.98, 6), materials.steel);
    string.position.set(0.13, 0.30, 0);
    group.add(string);
    [-1, 1].forEach((side) => {
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 4, 8), materials.gold);
      cap.position.set(0.13, 0.30 + side * 0.49, 0);
      group.add(cap);
    });
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10), materials.gold);
    grip.position.set(-0.05, 0.30, 0);
    grip.rotation.z = Math.PI / 2;
    group.add(grip);
    this.group = group;
  }
}

/** Kite shield with a raised golden lion, gripped at the boss like a viking round shield. */
class KiteShield {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaShield';
    const face = new THREE.Shape();
    face.moveTo(0, 0.34);
    face.lineTo(0.26, 0.26);
    face.quadraticCurveTo(0.30, -0.10, 0, -0.40);
    face.quadraticCurveTo(-0.30, -0.10, -0.26, 0.26);
    face.closePath();
    const geometry = new THREE.ExtrudeGeometry(face, {
      depth: 0.038, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 24
    });
    geometry.translate(0, 0, -0.019);
    // Gold rim: the same silhouette, slightly enlarged and pushed back, so only
    // a border shows around the steel face instead of covering it.
    const rimGeometry = geometry.clone();
    const rim = new THREE.Mesh(rimGeometry, materials.gold);
    rim.scale.set(1.07, 1.07, 0.55);
    rim.position.z = -0.010;
    rim.castShadow = true;
    group.add(rim);

    const shell = new THREE.Mesh(geometry, materials.steelDark);
    shell.castShadow = true;
    group.add(shell);

    // Curved steel ribs and a raised boss follow the shield profile instead of
    // the flat rectangular bars that used to make the face look toy-like.
    const rib = (points, radius, material) => {
      const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 6, false), material);
      group.add(mesh);
      return mesh;
    };
    for (const side of [-1, 1]) {
      rib([[side*.035,.25,.027],[side*.14,.19,.027],[side*.18,.04,.027],
        [side*.12,-.14,.027],[side*.025,-.31,.027]], .008, materials.steel);
    }
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), materials.gold);
    boss.scale.z = 0.48;
    boss.position.z = 0.030;
    group.add(boss);
    const bossRim = new THREE.Mesh(new THREE.TorusGeometry(.088, .006, 6, 28), materials.steel);
    bossRim.position.z = .028;
    group.add(bossRim);
    // Rivets share one draw call, keeping the detail inexpensive on mobile.
    const points = [[0,.305],[.115,.27],[.225,.235],[.235,.13],[.22,.02],[.18,-.09],
      [.12,-.20],[.055,-.30],[0,-.36],[-.055,-.30],[-.12,-.20],[-.18,-.09],
      [-.22,.02],[-.235,.13],[-.225,.235],[-.115,.27]];
    const rivets = new THREE.InstancedMesh(new THREE.SphereGeometry(.008, 8, 6), materials.gold, points.length);
    rivets.name = 'ShieldRivets';
    const transform = new THREE.Object3D();
    points.forEach(([x,y], index) => {
      transform.position.set(x,y,.027); transform.scale.set(1,1,.55); transform.updateMatrix();
      rivets.setMatrixAt(index, transform.matrix);
    });
    rivets.instanceMatrix.needsUpdate = true;
    rivets.computeBoundingSphere();
    group.add(rivets);
    // The lower finial is softly tapered rather than a block of metal.
    const finial = new THREE.Shape();
    finial.moveTo(0,-.12); finial.quadraticCurveTo(.038,-.15,.028,-.20);
    finial.quadraticCurveTo(.02,-.25,0,-.28);
    finial.quadraticCurveTo(-.02,-.25,-.028,-.20);
    finial.quadraticCurveTo(-.038,-.15,0,-.12);
    const crest = new THREE.Mesh(new THREE.ExtrudeGeometry(finial, {
      depth:.006, bevelEnabled:true, bevelSize:.003, bevelThickness:.002, bevelSegments:2, curveSegments:12
    }), materials.gold);
    crest.position.z = .025;
    group.add(crest);
    this.group = group;
  }
}

/**
 * Measure the fist so the sword sits in the palm instead of floating beside the
 * hand, and so the fingers can close around the grip. All values are expressed
 * in the hand bone's local space. `side` picks the right (weapon) or left hand.
 */
function measureFist(boneByName, side = 'r') {
  const read = (name) => boneByName.get(name) || boneByName.get(`${name}_${side}`) || null;
  const hand = read(`hand_${side}`);
  if (!hand) return null;
  hand.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(hand.matrixWorld).invert();
  const local = (bone) => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);

  const index = read(`index_01_${side}`);
  const middle = read(`middle_01_${side}`);
  const pinky = read(`pinky_01_${side}`);
  const ring = read(`ring_01_${side}`);
  const indexMid = read(`index_02_${side}`);
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
  const { renderer = null, materials = {}, baseGlbUrl = null } = options;
  const loader = new GLTFLoader();
  const [base, locomotion, actions, combat] = await Promise.all([
    baseGlbUrl ? parseGLBFromUrl(loader, baseGlbUrl) : parseGLB(loader, MIA_BASE_GLB_BASE64),
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

  // Mia's face is painted as an anime-leaning portrait (Tools/stylize_mia_face.py):
  // the slender brows live in the skin atlas, so the wide authored card is hidden
  // rather than left as a second, heavier brow above it.
  visibleMeshes.filter((mesh) => mesh.name === 'Eyebrows').forEach((mesh) => { mesh.visible = false; });

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

  // Crossfade from the weights actually visible now, not from an assumed 0/1.
  // Three's fadeIn/fadeOut restart their ramps at 0/1, which pops when a new
  // spell or movement change interrupts an unfinished blend.
  const blendWeights = new Map(Array.from(actionSets.keys(), name => [name, name === 'Sword_Idle' ? 1 : 0]));
  let blend = null;
  const setWeights = (name, duration) => {
    if (!actionSets.has(name)) return;
    blend = { from: new Map(blendWeights), name, duration: Math.max(duration, 0.001), elapsed: 0 };
    actionSets.get(name).forEach(action => { action.enabled = true; action.play(); });
  };
  const advanceBlend = (dt) => {
    if (!blend) return;
    blend.elapsed = Math.min(blend.duration, blend.elapsed + Math.max(0, dt));
    const t = blend.elapsed / blend.duration;
    // Smoothstep has zero slope at either end, avoiding a harsh pose change.
    const eased = t * t * (3 - 2 * t);
    actionSets.forEach((actions, name) => {
      const weight = THREE.MathUtils.lerp(blend.from.get(name) || 0, name === blend.name ? 1 : 0, eased);
      blendWeights.set(name, weight);
      actions.forEach(action => {
        action.setEffectiveWeight(weight);
        action.enabled = weight > 0.00001 || name === blend.name;
      });
    });
    if (t >= 1) blend = null;
  };

  // Only idle contributes at load; all later transitions use blendWeights.
  actionSets.forEach((actions, name) => {
    actions.forEach((action) => {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = name === 'Sword_Idle';
      action.setEffectiveWeight(name === 'Sword_Idle' ? 1 : 0);
    });
  });
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
  //
  // Every correction is grouped per bone and remembers the value the clip wrote
  // (`base`) plus the value we left on the bone (`applied`). Several borrowed
  // cycles (Jog, Sprint, the combat clips) do not animate every bone: a bone
  // without a track keeps whatever the previous frame left, so multiplying the
  // correction again compounds it — that is what used to spin the sword in the
  // air and twist the resting hand. When the clip did not touch a bone this
  // frame, the guard restores `base` before the correction is applied again.
  const offsetGroups = [];
  const offsetGroupFor = (bone) => {
    let group = offsetGroups.find((entry) => entry.bone === bone);
    if (!group) {
      // `rest` is the authored idle pose of this bone: the value to settle on
      // when the running clip has no track for it at all.
      group = {
        bone,
        entries: [],
        base: bone.quaternion.clone(),
        applied: new THREE.Quaternion(),
        rest: bone.quaternion.clone(),
        used: false
      };
      offsetGroups.push(group);
    }
    return group;
  };
  /** `weight`: undefined = always full, otherwise multiplied by the one-shot fade. */
  const addOffset = (bone, quaternion, weight, premultiply = false) => {
    if (!bone) return null;
    const group = offsetGroupFor(bone);
    const entry = { quaternion, weight, premultiply };
    group.entries.push(entry);
    return entry;
  };
  let correctionWeight = 1;
  let gaitPhase = 0;
  let lastDt = 1 / 60;

  // One correction has to reach every copy of the bone: Mia's clothes (the
  // ranger arms and the bracers) live on their own skeleton, so curling the
  // skin's fingers alone left the visible hands open.
  const boneCopies = new Map();
  armatures.forEach(({ suffix, meshes }) => {
    meshes[0].skeleton.bones.forEach((bone) => {
      const base = suffix && bone.name.endsWith(suffix) ? bone.name.slice(0, -suffix.length) : bone.name;
      if (!boneCopies.has(base)) boneCopies.set(base, []);
      if (!boneCopies.get(base).includes(bone)) boneCopies.get(base).push(bone);
    });
  });
  const eachBoneCopy = (name, visit) => {
    const copies = boneCopies.get(name);
    if (copies) copies.forEach(visit);
  };

  const fist = measureFist(boneByName, 'r');
  const leftFist = measureFist(boneByName, 'l');

  /**
   * Put a prop in a fist. Every model keeps its grip at the local origin, so the
   * same palm/quaternion maths works for the sword, the hammer and the shield.
   */
  function placeInFist(group, { side = 'r', scale = 0.86, gripOffset = null, tilt = 0 } = {}) {
    const target = side === 'l' ? leftFist : fist;
    if (!target) return false;
    group.scale.setScalar(scale);
    group.quaternion.copy(gripOrientation(target));
    if (tilt) {
      // Swing the prop in the palm before it is placed: the resting wrist makes
      // a blade hang down, which would bury a hammer or a spear in the floor.
      group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    }
    const offset = (gripOffset || new THREE.Vector3(0, 0, 0))
      .clone()
      .multiplyScalar(scale)
      .applyQuaternion(group.quaternion);
    group.position.copy(target.palmCenter).sub(offset);
    target.hand.add(group);
    return true;
  }

  if (fist) {
    const gripScale = 0.86;
    // The shamshir's handle centre sits below its origin; every other prop is
    // modelled around the grip itself.
    placeInFist(sword.group, { scale: gripScale, gripOffset: new THREE.Vector3(0, -0.093, 0) });
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
      eachBoneCopy('hand_r', (bone) => addOffset(bone, local.clone(), true, true));
    }
    // The fingers wrap the handle; their curl axis is the grip axis.
    const curl = (name, amount) => {
      const bone = boneByName.get(name);
      if (!bone) return;
      const worldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
      const axis = fist.gripAxis.clone().applyQuaternion(worldQuaternion.clone().invert()).normalize();
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, amount);
      eachBoneCopy(name, (copy) => addOffset(copy, quaternion.clone()));
    };
    ['index', 'middle', 'ring', 'pinky'].forEach((finger, index) => {
      const scale = index === 3 ? 0.82 : 1;
      curl(`${finger}_01_r`, 0.5 * scale);
      curl(`${finger}_02_r`, 0.62 * scale);
      curl(`${finger}_03_r`, 0.42 * scale);
    });
    const thumbAxisLocal = fist.palmNormal.clone().applyQuaternion(handWorld.clone().invert()).normalize();
    [['thumb_01_r', -0.3], ['thumb_02_r', 0.42], ['thumb_03_r', 0.34]].forEach(([name, amount]) => {
      const quaternion = new THREE.Quaternion().setFromAxisAngle(thumbAxisLocal, amount);
      eachBoneCopy(name, (bone) => addOffset(bone, quaternion.clone()));
    });
    // The free hand relaxes into a soft curl instead of an open claw.
    ['index', 'middle', 'ring', 'pinky'].forEach((finger) => {
      const bone = boneByName.get(`${finger}_02_l`);
      if (!bone) return;
      const worldQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuaternion).normalize();
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.applyQuaternion(worldQuaternion.clone().invert()).normalize(), 0.24);
      eachBoneCopy(`${finger}_02_l`, (copy) => addOffset(copy, quaternion.clone()));
    });
  }

  // ------------------------------------------------------------------
  // LOADOUT — the weapon family and the shield the player has equipped.
  // The base model ships one shamshir; the other families are built here in
  // the same grip space, so swapping gear never needs a new GLB.
  // ------------------------------------------------------------------
  const propSet = {
    steel: propMaterial('steel'),
    steelDark: propMaterial('steelDark'),
    gold: propMaterial('gold'),
    leather: propMaterial('leather')
  };
  // Subtle brushed-forging texture, generated offline and shared by the new
  // armor pieces. Existing forge maps are retained when the caller has them.
  const armorCanvas = document.createElement('canvas');
  armorCanvas.width = armorCanvas.height = 256;
  const armorContext = armorCanvas.getContext('2d');
  const pixels = armorContext.createImageData(256, 256);
  let grain = 0x627f19;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0;
      const brushed = ((x * 37 + (y >> 4) * 17) % 53 === 0) ? 26 : 0;
      const value = Math.max(0, Math.min(255, 160 + ((grain >>> 27) - 16) * 2 + brushed));
      const i = (y * 256 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
  }
  armorContext.putImageData(pixels, 0, 0);
  const armorGrain = new THREE.CanvasTexture(armorCanvas);
  armorGrain.wrapS = armorGrain.wrapT = THREE.RepeatWrapping;
  armorGrain.repeat.set(2, 2);
  const armorMaterial = (source) => {
    const material = source.clone();
    material.roughness = Math.max(material.roughness, .48);
    if (!material.bumpMap && !material.normalMap) {
      material.bumpMap = armorGrain;
      material.bumpScale = .003;
    }
    if (!material.roughnessMap) material.roughnessMap = armorGrain;
    return material;
  };
  const armorSteel = armorMaterial(propSet.steel);
  const armorDark = armorMaterial(propSet.steelDark);

  const radiantSteel = propSet.steel.clone();
  radiantSteel.color = new THREE.Color(0xe6c168);
  radiantSteel.metalness = 0.94;
  radiantSteel.roughness = 0.26;
  radiantSteel.emissive = new THREE.Color(0x2a1c05);
  radiantSteel.emissiveIntensity = 0.35;
  const radiantGold = propSet.gold.clone();
  radiantGold.emissive = new THREE.Color(0x3b2606);

  const radiant = new Shamshir({ ...propSet, steel: radiantSteel, gold: radiantGold });
  radiant.group.name = 'MiaSwordRadiant';
  const hammer = new WarHammer(propSet);
  const axe = new BattleAxe(propSet);
  const spear = new ImmortalSpear(propSet);
  const bow = new ArashBow(propSet);
  const shield = new KiteShield(propSet);

  const weaponLoadout = {
    sword: { group: sword.group, side: 'r', scale: 0.86, gripOffset: new THREE.Vector3(0, -0.093, 0) },
    radiant: { group: radiant.group, side: 'r', scale: 0.86, gripOffset: new THREE.Vector3(0, -0.093, 0) },
    hammer: { group: hammer.group, side: 'r', scale: 1.0, tilt: -1.75 },
    axe: { group: axe.group, side: 'r', scale: 0.95, tilt: -1.75 },
    spear: { group: spear.group, side: 'r', scale: 0.8, tilt: -1.55 },
    bow: { group: bow.group, side: 'l', scale: 0.9 }
  };
  Object.entries(weaponLoadout).forEach(([kind, entry]) => {
    if (kind === 'sword') { entry.group.visible = true; return; }
    placeInFist(entry.group, entry);
    entry.group.visible = false;
  });
  if (leftFist) {
    // A centre-grip shield: its face looks along the palm normal and the grip
    // bar runs across the palm, so the forearm takes the weight in every clip.
    const basis = new THREE.Matrix4().makeBasis(leftFist.gripAxis, leftFist.sideAxis, leftFist.palmNormal);
    shield.group.quaternion.setFromRotationMatrix(basis);
    // The model's decorated face is +Z; turn it outward from the hand rather
    // than hiding the boss and rivets against the forearm.
    shield.group.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    shield.group.scale.setScalar(0.95);
    shield.group.position.copy(leftFist.palmCenter);
    leftFist.hand.add(shield.group);
    shield.group.visible = false;
  }
  const gearGroups = Array.from(new Set([
    ...Object.values(weaponLoadout).map((entry) => entry.group),
    shield.group
  ]));
  let currentGear = { weapon: 'sword', shield: false };
  let armorPieces = null;
  let backShield = null;

  /** Show the weapon family (and shield) the player is wearing right now. */
  function setGear(gear = {}) {
    const worn = gear && gear.weapon ? gear.weapon.id : null;
    let kind = worn ? weaponKindFor(worn) : null;
    if (kind && (!weaponLoadout[kind] || (kind === 'bow' && !leftFist))) kind = 'sword';
    Object.entries(weaponLoadout).forEach(([key, entry]) => {
      entry.group.visible = key === kind;
    });
    const showShield = Boolean(gear && gear.shield && leftFist);
    // A bow occupies the shield hand. Store the equipped shield on the back
    // rather than making an equipped item disappear.
    const shieldOnBack = Boolean(showShield && kind === 'bow' && backShield);
    shield.group.visible = showShield && !shieldOnBack;
    if (backShield) backShield.visible = shieldOnBack;
    if (armorPieces) {
      const tunic = visibleMeshes.find(mesh => mesh.name === 'Female_Ranger_Body');
      if (tunic) tunic.visible = !(gear && gear.chest);
      Object.entries(armorPieces).forEach(([key, piece]) => {
        piece.group.visible = Boolean(gear && gear[key]);
        if (key === 'chest' && gear && gear.chest) {
          const royal = gear.chest.id === 'chest_plate_royal';
          piece.plate.material = royal ? armorDark : armorSteel;
          piece.emblem.material = royal ? radiantGold : propSet.gold;
          piece.royalDetail.visible = royal;
        }
      });
    }
    currentGear = {
      weapon: kind, shield: showShield,
      shieldLocation: showShield ? (shieldOnBack ? 'back' : 'hand') : null,
      helmet: gear?.helmet?.id || null, chest: gear?.chest?.id || null,
      gauntlets: gear?.gauntlets?.id || null, boots: gear?.boots?.id || null
    };
    return currentGear;
  }

  // Shoulders relax slightly in idle/walk; the weight fades away for one-shots.
  [['upperarm_l', -0.3, 0.08], ['upperarm_r', 0.3, -0.08]].forEach(([name, roll, yaw]) => {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, roll, 'XYZ'));
    eachBoneCopy(name, (bone) => addOffset(bone, quaternion.clone(), true));
  });

  // A carried blade should not ride a dead wrist: the borrowed jog/sprint cycles
  // swing the shoulders but leave `hand_*` untouched, so a small sway keeps the
  // sword and the shield alive. It is driven per frame in `update`.
  const wristSwayRight = new THREE.Quaternion();
  const wristSwayLeft = new THREE.Quaternion();
  eachBoneCopy('hand_r', (bone) => addOffset(bone, wristSwayRight, true));
  eachBoneCopy('hand_l', (bone) => addOffset(bone, wristSwayLeft, true));

  const sameQuaternion = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    + Math.abs(a.z - b.z) + Math.abs(a.w - b.w) < 1e-9;
  const applyOffsets = (weight) => {
    const amount = new THREE.Quaternion();
    for (let g = 0; g < offsetGroups.length; g++) {
      const group = offsetGroups[g];
      const bone = group.bone;
      // If the running clip has no track for this bone the mixer leaves last
      // frame's value alone, and applying the correction on top of it again
      // would compound (a hand rolling forever, a sword spinning in the air).
      // Keep the clip value separately and always rebuild from it.
      if (group.used && sameQuaternion(bone.quaternion, group.applied)) {
        // Nothing wrote it this frame: ease the stored clip value onto the
        // authored resting pose instead of freezing the previous clip's angle.
        group.base.slerp(group.rest, 1 - Math.exp(-lastDt * 9));
      } else {
        group.base.copy(bone.quaternion);
      }
      bone.quaternion.copy(group.base);
      for (let i = 0; i < group.entries.length; i++) {
        const { quaternion, weight: fadeWith, premultiply } = group.entries[i];
        const w = fadeWith === undefined ? 1 : weight;
        if (w <= 0.001) continue;
        amount.identity().slerp(quaternion, w);
        if (premultiply) bone.quaternion.premultiply(amount);
        else bone.quaternion.multiply(amount);
      }
      group.applied.copy(bone.quaternion);
      group.used = true;
    }
  };

  const clothMaterial = propMaterial('cape');
  const tailMaterial = clothMaterial.clone();
  tailMaterial.color.setHex(0x6d1a24);
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
  scarfMaterial.color.setHex(0x7e1d27);
  scarfMaterial.roughness = 0.96;
  scarfMaterial.envMapIntensity = 0.2;
  if (environment) scarfMaterial.envMap = environment;
  const scarf = buildScarf(scarfMaterial);
  const neck = boneByName.get('neck_01');
  if (neck) {
    scarf.position.set(0, 0.02, 0);
    neck.add(scarf);
  }

  let currentName = 'Sword_Idle';

  /**
   * Ground speed each borrowed cycle covers at its own tempo, measured from the
   * clips themselves: the planted foot travels `2 x stride` per loop, and the
   * rig is a 1.774-unit body scaled to HERO_HEIGHT. Matching the gameplay speed
   * to this number is what stops the feet from skating.
   */
  const strideInModelUnits = {
    'Walk_Loop': 0.682,
    'Jog_Fwd_Loop': 1.237,
    'Sprint_Loop': 1.077
  };
  const referenceSpeed = {};
  let speedsMeasured = false;
  const measureReferenceSpeeds = () => {
    const scale = root.scale.x || 1;
    Object.entries(strideInModelUnits).forEach(([name, stride]) => {
      const duration = byName.get(name)?.duration || 1;
      referenceSpeed[name] = (2 * stride * scale) / Math.max(duration, 0.05);
    });
  };
  measureReferenceSpeeds();

  /**
   * Walk until the walk cycle would look hurried, then take whichever of the
   * faster cycles covers the ground speed most closely (fewest sliding feet).
   */
  const speedToClip = (speed) => {
    // Hysteresis avoids repeatedly restarting a blend when measured movement
    // jitters around the idle/walk or walk/run boundary.
    if (speed <= (currentName === 'Sword_Idle' ? 0.16 : 0.08)) return 'Sword_Idle';
    const walk = referenceSpeed['Walk_Loop'] || WALK_REFERENCE_SPEED;
    const walkLimit = currentName === 'Walk_Loop' ? 1.50 : 1.40;
    if (speed <= walk * walkLimit) return 'Walk_Loop';
    const jog = referenceSpeed['Jog_Fwd_Loop'] || JOG_REFERENCE_SPEED;
    const sprint = referenceSpeed['Sprint_Loop'] || SPRINT_REFERENCE_SPEED;
    if (!jog || !sprint) return 'Walk_Loop';
    const jogError = Math.abs(Math.log(speed / jog));
    const sprintError = Math.abs(Math.log(speed / sprint));
    return sprintError < jogError ? 'Sprint_Loop' : 'Jog_Fwd_Loop';
  };

  let oneShotName = null;
  let oneShotTimer = 0;

  const playOneShot = (name, fadeDuration = 0.12) => {
    const actions = actionSets.get(name);
    if (!actions) return null;
    actions.forEach((action) => {
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    });
    setWeights(name, fadeDuration);
    oneShotName = name;
    oneShotTimer = (byName.get(name)?.duration || 0.6) - fadeDuration * 0.5;
    return actions;
  };

  const update = (dt, speed = 0) => {
    lastDt = Math.max(dt, 1 / 240);
    if (!oneShotName) {
      // The rig is scaled after load, so measure the clip speeds on the first
      // frame with the scale that is actually in use.
      if (!speedsMeasured) {
        measureReferenceSpeeds();
        speedsMeasured = true;
      }
      const name = speedToClip(speed);
      if (name !== currentName && actionSets.has(name)) {
        currentName = name;
        setWeights(name, 0.26);
      }
      const reference = referenceSpeed[currentName];
      const timeScale = reference ? THREE.MathUtils.clamp(speed / reference, 0.62, 1.5) : 1;
      actionSets.get(currentName)?.forEach((action) => action.setEffectiveTimeScale(timeScale));
      // One gait cycle per walk-length travelled, so the wrist sway stays in
      // step with the legs while the borrowed cycles are played back faster.
      const walk = referenceSpeed['Walk_Loop'] || WALK_REFERENCE_SPEED;
      gaitPhase += (speed / Math.max(walk, 0.2)) * dt * Math.PI;
    } else {
      oneShotTimer -= dt;
      if (oneShotTimer <= 0) {
        oneShotName = null;
        const next = speedToClip(speed);
        if (actionSets.has(next)) currentName = next;
        setWeights(currentName, 0.2);
      }
    }
    tails.forEach((tail) => tail.update(dt, speed));
    // Combat clips are authored for the raw rig, so the resting wrist and
    // shoulder corrections fade out for one-shots and return afterwards.
    correctionWeight += ((oneShotName ? 0 : 1) - correctionWeight) * (1 - Math.exp(-dt * 11));
    // Keep the wrist sway tiny and fade it out at a standstill, so the resting
    // pose is exactly the authored one.
    const sway = Math.min(1, speed / 1.2) * 0.11;
    wristSwayRight.setFromAxisAngle(WRIST_SWAY_AXIS, Math.sin(gaitPhase) * sway);
    wristSwayLeft.setFromAxisAngle(WRIST_SWAY_AXIS, Math.sin(gaitPhase + Math.PI) * sway * 0.7);
    advanceBlend(dt);
    mixer.update(dt);
    applyOffsets(correctionWeight);
    if (fist && correctionWeight > .01 &&
        (currentGear.weapon === 'sword' || currentGear.weapon === 'radiant')) {
      // Retain the animated arm swing, but turn the wrist so the carried blade
      // points down and away from the torso instead of crossing the abdomen.
      // Corrections are applied to every clothing/skin armature and recorded
      // as the applied pose so missing wrist tracks cannot accumulate rotation.
      root.updateMatrixWorld(true);
      const handWorld = fist.hand.getWorldQuaternion(new THREE.Quaternion());
      const blade = new THREE.Vector3(0,1,0).applyQuaternion(handWorld.clone().multiply(sword.group.quaternion));
      const desired = new THREE.Vector3(-.48,-.84,.25).normalize().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()));
      const axis = new THREE.Vector3().crossVectors(blade,desired);
      const angle = blade.angleTo(desired);
      if (axis.lengthSq() > 1e-8 && angle > .001) {
        axis.normalize();
        const worldCorrection = new THREE.Quaternion().setFromAxisAngle(axis,Math.min(angle,2.2)*correctionWeight);
        eachBoneCopy('hand_r', bone => {
          const parentWorld = bone.parent.getWorldQuaternion(new THREE.Quaternion());
          bone.quaternion.premultiply(parentWorld.clone().invert().multiply(worldCorrection).multiply(parentWorld));
          const group = offsetGroups.find(entry => entry.bone === bone);
          if (group) group.applied.copy(bone.quaternion);
        });
      }
    }
  };

  // Apply the resting corrections, then frame the character for the existing
  // village camera. SkinnedMesh bounds need the posed matrices, so the props are
  // hidden for the single measurement.
  applyOffsets(1);
  root.updateMatrixWorld(true);
  const propsWereVisible = gearGroups.map((group) => group.visible);
  gearGroups.forEach((group) => { group.visible = false; });
  tails.forEach((tail) => { tail.mesh.visible = false; });
  const bodyBounds = new THREE.Box3().setFromObject(rig);
  gearGroups.forEach((group, index) => { group.visible = propsWereVisible[index]; });
  tails.forEach((tail) => { tail.mesh.visible = true; });
  const size = new THREE.Vector3();
  bodyBounds.getSize(size);
  const scale = HERO_HEIGHT / (size.y || 2);
  root.scale.setScalar(scale);
  root.position.y = -bodyBounds.min.y * scale;

  // Lightweight fitted equipment follows the real animated bones. Build each
  // piece in the current root-space pose, then attach it to its own joint so
  // it moves in idle, locomotion and every spell without a separate animation.
  root.updateMatrixWorld(true);
  const positionOf = name => root.worldToLocal(boneByName.get(name).getWorldPosition(new THREE.Vector3()));
  const jointPiece = (boneName, name, position) => {
    const part = new THREE.Group();
    part.name = name;
    part.position.copy(position);
    root.add(part);
    root.updateMatrixWorld(true);
    boneByName.get(boneName).attach(part);
    return part;
  };
  const addMesh = (group, geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  armorPieces = {};
  const helmetContainer = new THREE.Group(); helmetContainer.name = 'EquippedHelmet';
  const helmet = jointPiece('Head', 'HelmetOnHead', positionOf('Head').add(new THREE.Vector3(0, .13, 0)));
  const dome = addMesh(helmet, new THREE.SphereGeometry(.165, 24, 14, 0, Math.PI * 2, 0, Math.PI * .55), armorSteel);
  dome.scale.set(1, .90, .95);
  const rim = addMesh(helmet, new THREE.TorusGeometry(.163, .008, 8, 32), propSet.gold);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = .95;
  // Low central ridge, engraved brow and cheek guards give the helm a forged,
  // layered profile without obscuring Mia's face or replacing her hairstyle.
  const tube = (parent, points, radius, material) => addMesh(parent,
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 20, radius, 6, false), material);
  tube(helmet, [[0,-.002,-.155],[0,.085,-.12],[0,.145,0],[0,.085,.12],[0,.005,.155]], .0045, propSet.gold);
  for (const side of [-1, 1]) {
    const cheek = addMesh(helmet, new THREE.SphereGeometry(1, 16, 12), armorDark, side*.145, -.04, -.05);
    cheek.scale.set(.015, .06, .045);
    const stud = addMesh(helmet, new THREE.SphereGeometry(.009, 10, 8), propSet.gold, side*.158, -.018, .025);
    stud.scale.set(.65,1,1);
  }
  // Keep face visible: this is an open-faced helm, not a full visor.
  boneByName.get('Head').add(helmetContainer);
  helmetContainer.add(helmet);
  armorPieces.helmet = { group: helmetContainer };

  const chestContainer = new THREE.Group(); chestContainer.name = 'EquippedChest';
  const chest = jointPiece('spine_02', 'ChestOnSpine', positionOf('spine_02').add(new THREE.Vector3(0, .09, 0)));
  // Shaped cuirass: a tapered oval shell instead of a spherical breastplate.
  const cuirassProfile = [
    new THREE.Vector2(.155, -.19), new THREE.Vector2(.18, -.17),
    new THREE.Vector2(.20, -.08), new THREE.Vector2(.22, .04),
    new THREE.Vector2(.21, .14), new THREE.Vector2(.16, .19)
  ];
  const plate = addMesh(chest, new THREE.LatheGeometry(cuirassProfile, 32), armorSteel);
  plate.scale.z = .84;
  // The chest plate is layered with curved forged edges, a raised ridge and a
  // small eight-point sun. All lines follow the shell rather than floating in
  // a flat plane across the torso.
  const star = new THREE.Shape();
  for (let i=0; i<16; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 8;
    const radius = i % 2 ? .014 : .032;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (!i) star.moveTo(x,y); else star.lineTo(x,y);
  }
  star.closePath();
  const emblem = addMesh(chest, new THREE.ExtrudeGeometry(star, {depth:.003, bevelEnabled:true, bevelSize:.001, bevelThickness:.001, bevelSegments:1}), propSet.gold, 0, .055, .187);
  const boss = addMesh(chest, new THREE.SphereGeometry(.009, 12, 8), armorDark, 0, .055, .192);
  boss.scale.z = .38;
  for (const [y, radius] of [[-.16, .182], [.125, .212]]) {
    const edging = addMesh(chest, new THREE.TorusGeometry(radius, .0045, 6, 32), propSet.gold, 0, y, 0);
    edging.rotation.x = Math.PI / 2;
    edging.scale.y = .84;
  }
  for (const side of [-1,1]) {
    tube(chest, [[side*.165,.12,.115],[side*.11,.10,.16],[side*.065,.08,.18]], .003, propSet.gold);
    tube(chest, [[side*.145,-.105,.13],[side*.10,-.12,.155],[0,-.135,.159]], .003, armorDark);
    for (const y of [-.13,.10]) {
      const stud = addMesh(chest, new THREE.SphereGeometry(.006, 8, 6), propSet.gold, side*.14, y, y > 0 ? .139 : .112);
      stud.scale.z = .65;
    }
  }
  // Overlapping waist lames soften the silhouette and suggest flexible armor.
  // They stay above the hips, so the leg swing remains unobstructed.
  for (let i=0; i<2; i++) {
    const y = -.145 - i*.018;
    const radius = .185 - i*.013;
    const lame = addMesh(chest, new THREE.LatheGeometry([
      new THREE.Vector2(radius-.004,y+.012), new THREE.Vector2(radius+.003,y+.006),
      new THREE.Vector2(radius,y-.009)
    ], 32), armorDark);
    lame.name = `CuirassWaistLame${i}`;
    lame.scale.z = .84;
    const edge = addMesh(chest, new THREE.TorusGeometry(radius+.002,.0025,5,32), propSet.gold, 0, y+.006, 0);
    edge.rotation.x = Math.PI/2; edge.scale.y = .84;
  }
  // The dark royal cuirass has its own symmetrical engraved filigree rather
  // than merely changing the color of the regular Persian breastplate.
  const royalDetail = new THREE.Group();
  royalDetail.name = 'RoyalCuirassFiligree';
  royalDetail.visible = false;
  chest.add(royalDetail);
  const surface = (x,y) => {
    let i = 1;
    while (i < cuirassProfile.length - 1 && cuirassProfile[i].y < y) i++;
    const a = cuirassProfile[i-1], b = cuirassProfile[i];
    const t = THREE.MathUtils.clamp((y-a.y)/(b.y-a.y),0,1);
    const r = THREE.MathUtils.lerp(a.x,b.x,t);
    return [x,y,.84*Math.sqrt(Math.max(0,r*r-x*x))+.003];
  };
  for (const side of [-1,1]) {
    const path = [[.045,.025],[.07,-.005],[.095,-.025],[.12,-.02],[.135,.005]]
      .map(([x,y]) => surface(side*x,y));
    tube(royalDetail,path,.0025,propSet.gold);
    const point = surface(side*.12,-.02);
    const rivet = addMesh(royalDetail,new THREE.SphereGeometry(.005,8,6),propSet.gold,...point);
    rivet.scale.z=.6;
  }
  boneByName.get('spine_02').add(chestContainer); chestContainer.add(chest);
  armorPieces.chest = { group: chestContainer, plate, emblem, royalDetail };

  const limbArmor = (slot, startName, endName, fraction, length, radius) => {
    const start = positionOf(startName), end = positionOf(endName);
    const center = start.clone().lerp(end, fraction);
    const piece = jointPiece(startName, `${slot}-${startName}`, center);
    const axis = end.clone().sub(start).normalize();
    // Group is already in the bone's local frame; rotate a mesh in world/root
    // space first, then convert that orientation into the attached frame.
    const boneRotation = piece.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion()));
    const profile = [
      new THREE.Vector2(radius*.78,-length*.50), new THREE.Vector2(radius*.92,-length*.43),
      new THREE.Vector2(radius,-length*.18), new THREE.Vector2(radius*.95,length*.25),
      new THREE.Vector2(radius*.77,length*.48)
    ];
    const shell = addMesh(piece, new THREE.LatheGeometry(profile, 20), armorDark);
    shell.quaternion.copy(boneRotation).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis));
    for (const [y, r] of [[-length*.39,radius*.96],[length*.27,radius*.96]]) {
      const band = addMesh(shell, new THREE.TorusGeometry(r, .004, 6, 24), propSet.gold, 0, y, 0);
      band.rotation.x = Math.PI / 2;
    }
    // A raised central plate with overlapping edges, shaped rather than a box.
    const overlay = addMesh(shell, new THREE.SphereGeometry(1, 16, 12), armorSteel, 0, 0, radius*1.02);
    overlay.scale.set(radius*.42, length*.35, .012);
    for (const y of [-length*.25, length*.20]) {
      const rivet = addMesh(shell, new THREE.SphereGeometry(.006, 8, 6), propSet.gold, 0, y, radius*.98);
      rivet.scale.z = .65;
    }
    return piece;
  };
  for (const [slot, a, b, fraction, length, radius] of [
    ['gauntlets','lowerarm_l','hand_l',.70,.16,.075],
    ['gauntlets','lowerarm_r','hand_r',.70,.16,.075],
    ['boots','calf_l','foot_l',.72,.22,.095],
    ['boots','calf_r','foot_r',.72,.22,.095]
  ]) {
    if (!armorPieces[slot]) armorPieces[slot] = { group: new THREE.Group(), parts: [] };
    // Parts are attached independently, since left and right limbs animate apart.
    const part = limbArmor(slot,a,b,fraction,length,radius);
    armorPieces[slot].parts.push(part);
  }
  // Toe plates follow the forefoot bone, not the shin or ankle.
  for (const side of ['l', 'r']) {
    const footName = `foot_${side}`, ballName = `ball_${side}`;
    const direction = positionOf(ballName).sub(positionOf(footName)); direction.y = 0; direction.normalize();
    const center = positionOf(ballName).addScaledVector(direction, .015).add(new THREE.Vector3(0, .032, 0));
    const toe = jointPiece(ballName, `boots-${ballName}`, center);
    const cap = addMesh(toe, new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), armorSteel);
    cap.scale.set(.061, .028, .085);
    cap.rotation.y = Math.atan2(direction.x, direction.z);
    armorPieces.boots.parts.push(toe);
  }
  // Paired parts have different parents: visibility is applied to each part.
  for (const slot of ['gauntlets', 'boots']) {
    const entry = armorPieces[slot];
    entry.group = { set visible(value) { entry.parts.forEach(part => { part.visible = value; }); } };
  }
  backShield = shield.group.clone();
  backShield.name = 'EquippedShieldOnBack';
  backShield.position.copy(positionOf('spine_03').add(new THREE.Vector3(0, -.04, -.23)));
  backShield.rotation.set(0, Math.PI, 0);
  backShield.scale.setScalar(.75);
  root.add(backShield); root.updateMatrixWorld(true);
  boneByName.get('spine_03').attach(backShield);
  // Start with the familiar base sword; the game synchronizes the saved slots
  // immediately after loading and hides every item whose slot is empty.
  Object.values(armorPieces).forEach(piece => { piece.group.visible = false; });
  backShield.visible = false;

  return {
    root,
    meshes: visibleMeshes,
    armatures: armatures.map((entry) => entry.armature),
    clips,
    mixer,
    playOneShot,
    update,
    setGear,
    gear: () => ({ ...currentGear }),
    weaponKinds: Object.keys(weaponLoadout),
    // Which clip is running, and the prop actually in her hand right now.
    clip: () => currentName,
    // Ground speed each cycle covers at its own tempo (world units / second).
    clipSpeeds: () => ({ ...referenceSpeed }),
    worn: () => currentGear.weapon ? (weaponLoadout[currentGear.weapon] || weaponLoadout.sword).group : null,
    shield: shield.group,
    sword: sword.group,
    sash: tailLeft.mesh,
    tails: tails.map((tail) => tail.mesh),
    scarf,
    bone: (name) => boneByName.get(name) || null,
    height: HERO_HEIGHT,
    environment
  };
}
