import assert from 'node:assert/strict';
import {dungeonReturnArrival,arrivalPartyPosition} from '../unity_preview/portal-arrival.js';
import {drawShopMarker,drawPlayerMarker,mapMarkerMetrics} from '../unity_preview/map-markers.js';
const entrances=[{targetZone:'dungeon',targetTier:1,pos:{x:54,z:-28},group:{rotation:{y:0}}},{targetZone:'dungeon',targetTier:3,pos:{x:78,z:30},group:{rotation:{y:0}}}];
for(const tier of [1,3]){
 const gate=entrances.find(p=>p.targetTier===tier),arrival=dungeonReturnArrival(entrances,tier);
 assert.equal(arrival.x,gate.pos.x);assert.equal(arrival.z,gate.pos.z+9);
 for(let i=0;i<5;i++){
  const p=arrivalPartyPosition(arrival,i);
  assert.ok(p.z>gate.pos.z);assert.ok(Math.hypot(p.x-gate.pos.x,p.z-gate.pos.z)>6);
 }
}
assert.equal(dungeonReturnArrival(entrances,99),null);
const turned={...entrances[0],group:{rotation:{y:Math.PI/2}}};
assert.ok(Math.abs(dungeonReturnArrival([turned],1).x-63)<1e-9);
const text=[];const ctx=new Proxy({}, {get:(_,method)=>method==='fillText'?(t)=>text.push(t):()=>{},set:()=>true});
for(const expanded of [false,true]){
 const metrics=mapMarkerMetrics(900,320,expanded);
 drawShopMarker(ctx,{x:100,y:100},{id:'blacksmith',title:'⚒ آهنگری کاوه'},metrics,expanded,900,900,[]);
 drawShopMarker(ctx,{x:200,y:200},{id:'jeweler',title:'💎 جواهر و کریستال'},metrics,expanded,900,900,[]);
 drawPlayerMarker(ctx,{x:150,y:150},0,metrics,expanded,900,900,0);
}
assert.deepEqual(text,['⚒','💎']);
console.log('PASS: symbol-only markers; correct per-dungeon gate return; five heroes outside gate trigger; rotated entrances supported.');
