import assert from 'node:assert/strict';
import * as THREE from '../unity_preview/lib/three.module.js';
import {createCombatPlan, combatBounds, combatHeight, buildCombatLandscape} from '../unity_preview/world-landscape.js';
const material = new THREE.MeshStandardMaterial();
const materials = new Proxy({}, {get: () => material});
const kit = {materials, buildDistrict: () => new THREE.Group()};
for (const [zone,tier] of [['open_world',1], ['dungeon',1], ['dungeon',3]]) {
  const plan = createCombatPlan(zone,tier), bounds = combatBounds(zone);
  assert.deepEqual(plan,createCombatPlan(zone,tier));
  assert.equal(plan.plots.length, zone === 'open_world' ? 0 : tier >= 3 ? 6 : 4);
  assert.ok(plan.rocks.length + plan.trees.length > 100);
  for (const p of [...plan.plots,...plan.rocks,...plan.trees]) {
    assert.equal(p.y,combatHeight(zone,tier,p.x,p.z));
    assert.ok(Math.abs(p.x)<bounds.x && Math.abs(p.z)<bounds.z);
  }
  for(const route of plan.routes) for(const [x,z] of route) {
    assert.ok(Math.abs(x)<=bounds.x && Math.abs(z)<=bounds.z);
    for(const p of plan.plots) assert.ok(Math.hypot(x-p.x,z-p.z)>12);
  }
  let buildingCalls = 0;
  const checkedKit = { ...kit, buildDistrict: () => { buildingCalls++; return new THREE.Group(); } };
  const landscape = buildCombatLandscape(THREE,checkedKit,materials,zone,tier,plan);
  assert.equal(buildingCalls, zone === 'open_world' ? 0 : 1);
  if (zone === 'open_world') assert.ok(!plan.landmarks.some(p => p.title.includes('کاروانسرا')));
  let instances = 0;
  landscape.traverse(mesh => {
    if(mesh.isInstancedMesh) {instances++; assert.ok(mesh.count>0);}
    if(!mesh.geometry) return;
    for(const attribute of Object.values(mesh.geometry.attributes)) {
      for(const n of attribute.array) assert.ok(Number.isFinite(n),'finite geometry and normals');
    }
  });
  assert.ok(instances>=3);
  if(zone === 'open_world') {
    for(let x=-11;x<=11;x++) assert.equal(Math.abs(combatHeight(zone,tier,x,0)),0,'bridge has continuous level approaches');
  } else {
    assert.equal(Math.abs(combatHeight(zone,tier,0,-24)),0,'boss arena level');
    assert.equal(Math.abs(combatHeight(zone,tier,0,42)),0,'exit court level');
  }
  console.log(`PASS ${zone} tier ${tier}: ${plan.plots.length} PBR buildings, ${plan.trees.length} trees, ${plan.rocks.length} rocks, ${plan.routes.length} connected routes; finite terrain/instances.`);
}
assert.notDeepEqual(createCombatPlan('dungeon',1), createCombatPlan('dungeon',3));
