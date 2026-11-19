/**
 * Headless check of Mia's locomotion and of the props in her fists.
 *
 * The two bugs this guards against:
 *   1. the sword used to rotate in the air while she moved, because the wrist
 *      correction was multiplied onto a bone the running clip never wrote, so
 *      it compounded every frame;
 *   2. the visible hands stayed open because the finger curls were applied to
 *      the skin skeleton only, not to the clothes (ranger arms) skeleton.
 *
 * Run with: node Tools/tests/mia-gait.test.mjs
 */
import * as THREE from '../../unity_preview/lib/three.module.js';
import { GLTFLoader } from '../../unity_preview/lib/GLTFLoader.js';

// ---------------------------------------------------------------- DOM stubs
const makeCanvas = () => ({
  width: 1,
  height: 1,
  getContext() {
    return {
      canvas: this,
      fillStyle: '', strokeStyle: '', lineWidth: 1, shadowColor: '', shadowBlur: 0, shadowOffsetY: 0,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      fillRect() {}, strokeRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {}, ellipse() {},
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {}, drawImage() {}, fillText() {}, measureText: () => ({ width: 10 })
    };
  }
});
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : {
    style: {}, addEventListener() {}, removeEventListener() {}, setAttribute() {}, appendChild() {}
  }),
  createElementNS: () => makeCanvas(),
  body: { appendChild() {} }
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.Image = class { set src(value) { if (this.onload) this.onload(); } };

/** Node has no image decoder: drop the maps and keep the rig and the clips. */
function withoutTextures(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer);
  const total = view.getUint32(8, true);
  let offset = 12;
  const chunks = [];
  while (offset < total) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    chunks.push({ type, data: bytes.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const json = JSON.parse(new TextDecoder().decode(chunks[0].data));
  delete json.images;
  delete json.textures;
  delete json.samplers;
  (json.materials || []).forEach((material) => {
    const pbr = material.pbrMetallicRoughness;
    if (pbr) { delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture; }
    delete material.normalTexture;
    delete material.occlusionTexture;
    delete material.emissiveTexture;
  });
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text);
  const bin = chunks[1] ? chunks[1].data : new Uint8Array(0);
  const pad = (4 - (bin.length % 4)) % 4;
  const out = new Uint8Array(12 + 8 + jsonBytes.length + (bin.length ? 8 + bin.length + pad : 0));
  const outView = new DataView(out.buffer);
  outView.setUint32(0, 0x46546c67, true);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, out.length, true);
  outView.setUint32(12, jsonBytes.length, true);
  outView.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  if (bin.length) {
    const at = 20 + jsonBytes.length;
    outView.setUint32(at, bin.length + pad, true);
    outView.setUint32(at + 4, 0x004e4942, true);
    out.set(bin, at + 8);
  }
  return out.buffer;
}
const parseGLB = GLTFLoader.prototype.parse;
GLTFLoader.prototype.parse = function parse(data, path, onLoad, onError) {
  return parseGLB.call(this, withoutTextures(data), path, onLoad, onError);
};

const { loadMiaHero } = await import('../../unity_preview/mia-hero.js');

const worldQuaternion = (object) => object.getWorldQuaternion(new THREE.Quaternion());
const degrees = (radians) => (radians * 180) / Math.PI;

const model = await loadMiaHero({});
const hand = model.bone('hand_r');
const sword = model.worn();
const foot = model.bone('foot_l');

function run(seconds, speed, settleFrames = 24) {
  const dt = 1 / 60;
  const frames = Math.round(seconds / dt);
  let relative = null;
  let spread = 0;
  let peak = 0;
  let previous = null;
  let handSpan = 0;
  let footLift = 0;
  let fingerDrift = 0;
  const fingerRest = model.bone('index_02_r').quaternion.clone();
  let minFoot = Infinity;
  let maxFoot = -Infinity;
  const start = new THREE.Vector3();
  const origin = new THREE.Vector3();
  for (let frame = 0; frame < frames; frame++) {
    model.update(dt, speed);
    model.root.updateMatrixWorld(true);
    const current = worldQuaternion(hand);
    if (frame < settleFrames) { previous = current; continue; }
    if (previous) peak = Math.max(peak, degrees(previous.angleTo(current)));
    previous = current;
    const relativeNow = worldQuaternion(hand).invert().multiply(worldQuaternion(sword));
    if (!relative) relative = relativeNow.clone();
    const angle = degrees(relativeNow.angleTo(relative));
    spread = Math.max(spread, Math.min(angle, 360 - angle));
    const handPosition = hand.getWorldPosition(new THREE.Vector3());
    const rootPosition = model.root.getWorldPosition(origin);
    handPosition.sub(rootPosition);
    if (frame === settleFrames) start.copy(handPosition);
    handSpan = Math.max(handSpan, Math.hypot(handPosition.x - start.x, handPosition.z - start.z));
    const footHeight = foot.getWorldPosition(new THREE.Vector3()).y - rootPosition.y;
    minFoot = Math.min(minFoot, footHeight);
    maxFoot = Math.max(maxFoot, footHeight);
    footLift = maxFoot - minFoot;
    fingerDrift = Math.max(fingerDrift, degrees(model.bone('index_02_r').quaternion.angleTo(fingerRest)));
  }
  return {
    clip: model.clip(),
    spread: Number(spread.toFixed(2)),
    peak: Number(peak.toFixed(1)),
    handSpan: Number(handSpan.toFixed(3)),
    footLift: Number(footLift.toFixed(3)),
    fingerDrift: Number(fingerDrift.toFixed(1))
  };
}

const checks = [];
const expect = (label, ok, detail) => checks.push({ label, ok: Boolean(ok), detail });

const idle = run(1.2, 0);
expect('idle uses the resting clip', idle.clip === 'Sword_Idle', idle.clip);

const walk = run(2.5, 2.0);
expect('slow movement plays the walk cycle', walk.clip === 'Walk_Loop', walk.clip);
expect('the walk steps instead of sliding', walk.footLift > 0.08, `foot lift ${walk.footLift}`);
expect('the arms swing while walking', walk.handSpan > 0.12, `hand travel ${walk.handSpan}`);

const village = run(3, 3.0);
expect('village speed plays the walk cycle', village.clip === 'Walk_Loop', village.clip);
const jog = run(3, 4.4);
expect('a faster chase plays the jog cycle', jog.clip === 'Jog_Fwd_Loop', jog.clip);

// The cycles are chosen by whichever covers the ground speed most closely, so
// the dungeon speed lands on the jog cycle and a real sprint is a bit faster.
const dungeon = run(3, 6.0);
expect('dungeon speed plays a running cycle', dungeon.clip === 'Jog_Fwd_Loop' || dungeon.clip === 'Sprint_Loop', dungeon.clip);
const sprint = run(2, 7.4);
expect('a full sprint plays the sprint cycle', sprint.clip === 'Sprint_Loop', sprint.clip);

for (const [label, result] of [['idle', idle], ['walk', walk], ['village', village], ['jog', jog], ['sprint', sprint]]) {
  expect(`the sword stays rigid in the fist (${label})`, result.spread < 6, `relative drift ${result.spread}°`);
  expect(`the hand does not roll over (${label})`, result.peak < 45, `peak ${result.peak}°/frame`);
  expect(`the fingers keep their grip (${label})`, result.fingerDrift < 25, `drift ${result.fingerDrift}°`);
}

// The visible hands belong to the clothes skeleton, so the grip corrections must
// land on every armature copy and not only on the skin underneath.
const handQuaternions = [];
model.armatures.forEach((armature) => {
  armature.traverse((object) => {
    if (object.isBone && /^hand_r(_\d+)?$/.test(object.name)) handQuaternions.push(object.quaternion.clone());
  });
});
const handSpread = handQuaternions.reduce(
  (worst, quaternion) => Math.max(worst, degrees(quaternion.angleTo(handQuaternions[0]))),
  0
);
expect('every armature gets the same grip pose', handQuaternions.length >= 2 && handSpread < 5,
  `${handQuaternions.length} copies, spread ${handSpread.toFixed(1)}°`);
const curled = degrees(model.bone('index_02_r').quaternion.angleTo(new THREE.Quaternion()));
expect('the fingers are closed around the grip', curled > 20, `curl ${curled.toFixed(0)}°`);

let failed = 0;
for (const check of checks) {
  if (!check.ok) failed++;
  console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.label} — ${check.detail}`);
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
