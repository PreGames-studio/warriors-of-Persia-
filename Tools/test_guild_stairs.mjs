import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../unity_preview/lib/three.module.js';
import {GUILD,GUILD_UPPER_FLOORS_OPEN,guildWalkHeight,guildCanWalkTo,guildUpperFloorBlocked,guildDoorReached,buildGuildInteriorStage} from '../unity_preview/adventure-guild.js';
assert.equal(GUILD_UPPER_FLOORS_OPEN,false);
for(const side of [-1,1])for(let z=-16;z>=-27;z-=.25){
 assert.equal(guildUpperFloorBlocked(side*16.3,z),true);
 assert.equal(guildCanWalkTo(side*16.3,z,0),false);
 assert.equal(guildWalkHeight(side*16.3,z,7),0);
}
assert.equal(guildCanWalkTo(0,-18,0),true,'counter approach stays open');
assert.equal(guildWalkHeight(0,0,14),0,'old upper-floor saves cannot remain upstairs');
assert.equal(guildDoorReached({x:0,z:9,y:0},GUILD.entrance),true);
assert.equal(guildDoorReached({x:5,z:9,y:0},GUILD.entrance),false);
assert.equal(guildDoorReached({x:0,z:25.5,y:7},GUILD.interiorExit),false);
const material=new THREE.MeshStandardMaterial(),m=new Proxy({},{get:()=>material});
const hall=buildGuildInteriorStage(THREE,m);
assert.equal(hall.userData.upperDecks.length,0,'upper floors not constructed yet');
assert.equal(hall.children.filter(g=>g.userData.staircase).length,2,'first flights retained behind barriers');
const html=fs.readFileSync('unity_preview/index.html','utf8');
assert.ok(html.includes("addWorldLabel('بزودی'"));
assert.ok(html.includes("showToast('بزودی"));
assert.ok(!html.includes('const guildGate = buildPortal3D'));
assert.ok(!html.includes('buildPortal3D(GUILD.interiorExit'));
console.log('PASS: upper floors blocked, coming-soon notice, no upper decks, save relocation and natural doorway transitions.');
