import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../unity_preview/lib/three.module.js';
import {createVillagePopulation,createVillageNavigation} from '../unity_preview/village-population.js';
import {registerGuildMember,sellGuildItem,guildResaleValue} from '../unity_preview/guild-services.js';
const html=fs.readFileSync('unity_preview/index.html','utf8');
const from=html.indexOf('    const CENTRAL_VILLAGE_SHOPS_3D'),to=html.indexOf('    // Twenty stationary quest-giver',from);
const {plan,height}=vm.runInNewContext(html.slice(from,to)+';({plan:VILLAGE_DISTRICT_PLAN,height:villageHeight})');
const colliders=plan.houses.map(p=>{const c=Math.abs(Math.cos(p.rotY)),s=Math.abs(Math.sin(p.rotY));const w=(c*4.7+s*3.75)*1.25+.45,d=(s*4.7+c*3.75)*1.25+.45;return {minX:p.x-w,maxX:p.x+w,minZ:p.z-d,maxZ:p.z+d};});
colliders.push({minX:-12.2,maxX:12.2,minZ:-13.2,maxZ:7.2});
const population=createVillagePopulation(THREE,{buildVillager:()=>new THREE.Group()},plan.houses,colliders,height,new THREE.Group());
assert.equal(population.residents.length,200);
for(const kind of ['child','elder','woman','man'])assert.equal(population.residents.filter(r=>r.profile===kind).length,50);
const phases=new Set();let hidden=false,moved=false;const starts=population.residents.map(r=>r.group.position.clone());
for(let i=0;i<1200;i++){
 population.update(.2);
 for(const r of population.residents){phases.add(r.phase);hidden ||= !r.group.visible;assert.ok(Number.isFinite(r.group.position.y));}
}
moved=population.residents.some((r,i)=>r.group.position.distanceTo(starts[i])>10);
assert.ok(moved&&hidden);assert.ok(phases.has('inside')&&phases.has('walking'));
const nav=createVillageNavigation([{minX:-2,maxX:2,minZ:-5,maxZ:5}],20,1);
const route=nav.path({x:-10,z:0},{x:10,z:0});assert.ok(route);
assert.ok(route.every(p=>!(Math.abs(p.x)<2.5&&Math.abs(p.z)<5.5)),'navigation avoids walls');
const state={currentZone:'guild',coins:20,inventory:[{title:'آیتم تست',price:100}],party:[{name:'میا'}]};
assert.equal(registerGuildMember(state).ok,true);assert.equal(registerGuildMember(state).ok,false);
assert.equal(JSON.parse(JSON.stringify(state)).guildMembership.registered,true);
assert.equal(sellGuildItem(state,0).ok,true);assert.equal(state.coins,55);assert.equal(state.inventory.length,0);
assert.equal(sellGuildItem(state,0).ok,false);assert.equal(guildResaleValue({price:NaN}),0);
state.currentZone='village';assert.equal(registerGuildMember(state).ok,false);
console.log(`PASS: 200 diverse residents, ${population.homes.length} accessible houses, collision routes, home entry/exit lifecycle, registration and item resale.`);
