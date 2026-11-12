import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../unity_preview/lib/three.module.js';
import {WEST_FIELD,OPEN_WORLD_BOUNDS,OPEN_WORLD_ROUTES,WEST_SPAWN,VILLAGE_GATE,SLIME,createSlimeSpawns,buildSlime,routeDistance,isSafeWestTrail,isOpenWorldLand,slimeCanMove} from '../unity_preview/open-world-first.js';
const area=(WEST_FIELD.maxX-WEST_FIELD.minX)*(WEST_FIELD.maxZ-WEST_FIELD.minZ);
assert.equal(area/WEST_FIELD.originalArea,100);
assert.equal(OPEN_WORLD_BOUNDS.maxX,128,'right bank unchanged');
assert.equal(SLIME.hp,100);assert.equal(SLIME.xp,1);assert.equal(SLIME.drop.count,1);assert.equal(SLIME.drop.color,0x32dd77);
const spawns=createSlimeSpawns();assert.equal(spawns.length,300);assert.deepEqual(spawns,createSlimeSpawns());
assert.equal(new Set(spawns.map(s=>s.id)).size,300);
for(const p of spawns){assert.ok(p.x<-24&&p.x>WEST_FIELD.minX&&Math.abs(p.z)<880);assert.ok(routeDistance(p.x,p.z)>=22);}
assert.ok(isSafeWestTrail(WEST_SPAWN.x,WEST_SPAWN.z));assert.ok(isSafeWestTrail(VILLAGE_GATE.x,VILLAGE_GATE.z));
for(const route of OPEN_WORLD_ROUTES)for(const [x,z] of route)assert.ok(isOpenWorldLand(x,z));
assert.equal(isOpenWorldLand(100,400),false,'no unintended right-bank expansion');
for(const [i,p] of spawns.entries()){
 let position={x:p.x,z:p.z};
 for(let t=0;t<400;t++){
  const next={x:position.x+Math.sin(t*.1+i)*1.5,z:position.z+Math.cos(t*.13+i)*1.5};
  if(slimeCanMove(position,next))position=next;
  assert.ok(!isSafeWestTrail(position.x,position.z));
 }
}
assert.equal(slimeCanMove({x:-1120,z:-30},{x:-1120,z:30}),false,'swept motion cannot jump across trails');
const slime=buildSlime(THREE);assert.equal(slime.userData.kind,'slime');assert.equal(slime.children[0].geometry.type,'LatheGeometry');
for(const n of slime.children[0].geometry.attributes.position.array)assert.ok(Number.isFinite(n));
const html=fs.readFileSync('unity_preview/index.html','utf8');
assert.ok(html.includes("createSlimeSpawns().forEach(p=>spawnEnemyUnit3D"));
assert.ok(html.includes("cType=SLIME.drop.type"));
console.log('PASS: exact 100x west-bank area, unchanged east bank, 300 deterministic off-trail slimes, 100 HP / 1 XP / one green drop, swept safe-path exclusion and droplet geometry.');
