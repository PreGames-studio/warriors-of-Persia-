import assert from 'node:assert/strict';
import {smoothAngle,dragLookTarget} from '../unity_preview/camera-motion.js';
for(const fps of [30,60,120]) {
 let yaw=0;
 for(let i=0;i<fps*3;i++) {
  const next=smoothAngle(yaw,Math.PI,fps ? 1/fps : 0);
  assert.ok(Math.abs(next-yaw)<=1.05/fps+1e-10,'hard angular rate cap');
  assert.ok(next>=yaw,'no oscillation');yaw=next;
 }
 assert.ok(yaw>2.7);
}
assert.ok(smoothAngle(Math.PI-.01,-Math.PI+.01,1/60)>Math.PI-.01,'shortest arc over wrap boundary');
assert.ok(Math.abs(smoothAngle(0,Math.PI,2))<=1.05*.05,'stalled frame cannot cause jump');
assert.equal(smoothAngle(1,2,0),1);
const spike=dragLookTarget(0,0,5000,-5000);
assert.ok(Math.abs(spike.yaw)<=.1);assert.ok(Math.abs(spike.tilt)<=.0721);
assert.equal(dragLookTarget(0,.8,0,40).tilt,.8);
assert.ok(Math.abs(dragLookTarget(0,0,20,0).yaw)<20*.007,'reduced sensitivity');
console.log('PASS: bounded rotation at 30/60/120 fps, wraparound, frame stalls, gesture spike rejection and tilt limits.');
