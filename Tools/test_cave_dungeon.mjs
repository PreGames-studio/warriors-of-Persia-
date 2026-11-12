import assert from 'node:assert/strict';
import * as THREE from '../unity_preview/lib/three.module.js';
import {CAVE,createCave,caveCell,caveWalkable,caveCanMove,buildCave} from '../unity_preview/cave-dungeon.js';
import {OPEN_WORLD_BOUNDS} from '../unity_preview/open-world-first.js';
import fs from 'node:fs';
assert.equal(CAVE.width,OPEN_WORLD_BOUNDS.maxX-OPEN_WORLD_BOUNDS.minX);
assert.equal(CAVE.depth,OPEN_WORLD_BOUNDS.maxZ-OPEN_WORLD_BOUNDS.minZ);
for(const floor of [1,2,50,100]){
 const cave=createCave(floor);assert.deepEqual(cave,createCave(floor));
 const visited=new Set([0]),queue=[0],distances=[0];
 for(const id of queue){const p=cave.center(id);assert.equal(caveCell(p.x,p.z),id);assert.ok(caveWalkable(cave,p.x,p.z));
 for(const n of cave.cells[id].links){assert.ok(cave.cells[n].links.includes(id));assert.ok(caveCanMove(cave,p,cave.center(n)),'every carved passage traversable');if(!visited.has(n)){visited.add(n);queue.push(n);distances[n]=distances[id]+1;}}}
 assert.equal(visited.size,CAVE.cols*CAVE.rows);assert.equal(distances[cave.bossId],Math.max(...distances));
 assert.ok(cave.cells.filter(c=>c.links.length===1).length>50,'many genuine dead ends');
 assert.ok(cave.slimes.length>250);for(const s of cave.slimes)assert.ok(caveWalkable(cave,s.x,s.z));
 for(const w of cave.walls.slice(0,100))assert.ok(!caveWalkable(cave,w.x,w.z),'solid wall');
 assert.ok(!caveCanMove(cave,cave.spawn,cave.boss),'cannot cut directly through maze');
}
assert.notDeepEqual(createCave(1).routes,createCave(2).routes);
const root=buildCave(THREE,createCave(1),new THREE.MeshStandardMaterial());
root.traverse(o=>{if(o.geometry)for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n));if(o.isInstancedMesh)for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));});
const html=fs.readFileSync('unity_preview/index.html','utf8');
assert.ok(html.includes("mmCtx.fillStyle='#000'"));assert.ok(html.includes('caveVisited.has(caveCell(en.group.position.x'));
assert.ok(html.includes('caveExplored: state.caveExplored'));assert.ok(html.includes('caveCanMove(activeCave,p.mesh.position,nextProjectile)'));
console.log('PASS: world-sized caves, connected maze, farthest boss, dead ends, wall collision, 300+ corridor slimes, finite instanced cave, persistent black-map discovery integration.');
