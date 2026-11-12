import assert from 'node:assert/strict';
import * as THREE from '../unity_preview/lib/three.module.js';
import {createGuildAtmosphere} from '../unity_preview/guild-atmosphere.js';
import {guildFurniturePlan} from '../unity_preview/adventure-guild.js';
const material=new THREE.MeshStandardMaterial(),materials=new Proxy({},{get:()=>material});
const plan=guildFurniturePlan(),atmosphere=createGuildAtmosphere(THREE,materials,plan);
assert.equal(atmosphere.guests.length,24);
assert.equal(atmosphere.vases.length,20);
assert.equal(atmosphere.conversations.length,12);
for(const guest of atmosphere.guests){
 assert.equal(guest.group.userData.seated,true);
 assert.ok(plan.tables[guest.table].chairs.some(c=>c.x===guest.group.position.x&&c.z===guest.group.position.z));
 assert.ok(Math.abs(guest.group.position.x)>8,'middle aisle stays clear');
}
let sawSpeech=false,sawSilence=false;
for(let time=0;time<40;time+=.5){atmosphere.update(time);sawSpeech ||= atmosphere.conversations.some(c=>c.active&&c.text);sawSilence ||= atmosphere.conversations.some(c=>!c.active);}
assert.ok(sawSpeech&&sawSilence);
atmosphere.root.traverse(object=>{if(object.geometry)for(const n of object.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
console.log('PASS: 24 seated gesturing guests, 12 conversation groups, 20 flower arrangements, finite decoration geometry and clear aisle.');
