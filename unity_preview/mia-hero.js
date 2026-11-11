import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  MIA_BASE_GLB_BASE64,
  MIA_LOCOMOTION_GLB_BASE64,
  MIA_ACTIONS_GLB_BASE64,
  MIA_COMBAT_GLB_BASE64
} from './assets/hero/mia/mia-assets.js';

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

/** Crimson scarf wrapped around the neck, as on the reference sheet. */
function buildScarf(material) {
  const group = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.024, 8, 18), material);
  knot.rotation.x = Math.PI / 2;
  knot.scale.set(1.2, 1, 0.85);
  knot.position.set(0, 0.03, 0.005);
  knot.castShadow = true;
  group.add(knot);
  const fold = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.017, 8, 18), material);
  fold.rotation.x = Math.PI / 2;
  fold.rotation.z = 0.2;
  fold.scale.set(1.16, 1, 0.8);
  group.add(fold);
  return group;
}

/** Single-edged shamshir built as a real blade profile with a rounded spine. */
class Shamshir {
  constructor(materials) {
    const group = new THREE.Group();
    group.name = 'MiaShamshir';

    const blade = new THREE.Shape();
    blade.moveTo(-0.038, 0);
    blade.lineTo(0.038, 0);
    // A shamshir: the cutting edge sweeps forward while the spine stays nearly
    // straight, then both curves meet in a fine point.
    blade.quadraticCurveTo(0.085, 0.34, 0.13, 0.62);
    blade.quadraticCurveTo(0.16, 0.82, 0.105, 0.94);
    blade.quadraticCurveTo(0.1, 0.8, 0.07, 0.62);
    blade.quadraticCurveTo(0.02, 0.34, -0.038, 0);
    const bladeGeometry = new THREE.ExtrudeGeometry(blade, {
      depth: 0.022, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 36
    });
    bladeGeometry.translate(0, 0, -0.007);
    const bladeMesh = new THREE.Mesh(bladeGeometry, materials.steel);
    bladeMesh.castShadow = true;
    group.add(bladeMesh);

    // A narrow, recessed spine highlight reads as a forged fuller without a box.
    const fullerShape = new THREE.Shape();
    fullerShape.moveTo(-0.008, 0.06);
    fullerShape.lineTo(0.008, 0.06);
    fullerShape.quadraticCurveTo(0.028, 0.4, 0.04, 0.7);
    fullerShape.quadraticCurveTo(0.024, 0.42, -0.008, 0.06);
    const fullerGeometry = new THREE.ExtrudeGeometry(fullerShape, {
      depth: 0.026, bevelEnabled: false, curveSegments: 18
    });
    fullerGeometry.translate(0, 0, -0.013);
    const fuller = new THREE.Mesh(fullerGeometry, materials.steelDark);
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
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((material) => {
        if (environment && !material.envMap) {
          material.envMap = environment;
          material.envMapIntensity = 0.55;
          material.needsUpdate = true;
        }
      });
      visibleMeshes.push(mesh);
    });
  });
  tintHair(visibleMeshes);
  visibleMeshes.filter((mesh) => mesh.name === 'Eyebrows').forEach((brows) => {
    const materials = (Array.isArray(brows.material) ? brows.material : [brows.material]).map((material) => {
      const clone = material.clone();
      clone.color.setHex(0x4a3025);
      clone.roughness = 0.9;
      if (environment) { clone.envMap = environment; clone.envMapIntensity = 0.15; }
      return clone;
    });
    brows.material = Array.isArray(brows.material) ? materials : materials[0];
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
  tailMaterial.color.setHex(0x6d1a24);
  tailMaterial.roughness = 0.97;
  tailMaterial.envMapIntensity = 0.18;
  if (environment) tailMaterial.envMap = environment;
  const tailLeft = new ClothTail(tailMaterial, { length: 0.4, topWidth: 0.095, hemWidth: 0.07, phase: 0 });
  const tailRight = new ClothTail(tailMaterial, { length: 0.3, topWidth: 0.075, hemWidth: 0.055, phase: 1.7 });
  const tails = [tailLeft, tailRight];
  const waist = boneByName.get('pelvis') || boneByName.get('spine_01');
  if (waist) {
    // Two short belt tails flank the hips: they clear the legs while walking
    // and cannot cut through the torso when the spine bends in combat.
    tailLeft.mesh.position.set(0.15, 0.015, -0.02);
    tailLeft.mesh.rotation.set(0.08, 0.55, 0.16);
    tailRight.mesh.position.set(-0.155, 0.015, -0.05);
    tailRight.mesh.rotation.set(0.05, -0.5, -0.14);
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
