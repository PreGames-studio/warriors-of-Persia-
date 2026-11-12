import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../unity_preview/lib/three.module.js';
import {GUILD,buildGuildExterior,buildGuildInteriorStage,guildFurniturePlan} from '../unity_preview/adventure-guild.js';
import {arrivalPartyPosition} from '../unity_preview/portal-arrival.js';
const material=new THREE.MeshStandardMaterial();
const materials=new Proxy({}, {get:()=>material});
const exterior=buildGuildExterior(THREE,materials);
assert.equal(exterior.userData.floors,3);
assert.equal(exterior.position.x,0);assert.equal(exterior.position.z,-3);
exterior.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(exterior,true);
assert.ok(bounds.max.y>24);assert.ok(bounds.min.y<0);
assert.ok(GUILD.entrance.z>7.2 && GUILD.entrance.z<11,'trigger just outside door collision');
for(let i=0;i<5;i++){
 const p=arrivalPartyPosition(GUILD.villageArrival,i);
 assert.ok(Math.hypot(p.x-GUILD.entrance.x,p.z-GUILD.entrance.z)>6);
 assert.ok(p.z>bounds.max.z);
}
assert.ok(Math.hypot(GUILD.interiorSpawn.x-GUILD.interiorExit.x,GUILD.interiorSpawn.z-GUILD.interiorExit.z)>6);
const stage=buildGuildInteriorStage(THREE,materials);
assert.equal(stage.userData.interiorDesignPending,false);
const plan=guildFurniturePlan();assert.equal(plan.tables.length,12);
assert.equal(plan.tables.filter(t=>t.x<0).length,6);
assert.equal(plan.tables.filter(t=>t.x>0).length,6);
assert.equal(plan.tables.flatMap(t=>t.chairs).length,60);
assert.equal(plan.staff.length,2);
for(const table of plan.tables){assert.equal(table.chairs.length,5);for(const chair of table.chairs)assert.ok(Math.abs(chair.x)>8,'clear central aisle');}
for(const c of stage.userData.colliders)if(c.z>-18)assert.ok(Math.abs(c.x)-c.halfW>6,'furniture outside central aisle');
const html=fs.readFileSync('unity_preview/index.html','utf8');
assert.ok(html.includes("} else if (zoneId === 'guild')"));
assert.ok(html.includes("zoneId === 'open_world' || zoneId === 'dungeon'"));
assert.equal((html.match(/const guildPoint = toMM/g)||[]).length,1,'map rendering must not leak into game update');
assert.ok(html.includes("state.currentZone === 'guild' ? guildWalkHeight"));
console.log('PASS: three-storey guild geometry, furnished independent interior, safe entry/exit spawn formation and map integration.');
