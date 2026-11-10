import assert from 'node:assert/strict';
import {restoreDungeonProgress,canEnterFloor,clearDungeonFloor,dungeonFloorDefinition,floorNumber} from '../unity_preview/dungeon-floors.js';
let p=restoreDungeonProgress(null);assert.equal(p.highest,1);assert.ok(!canEnterFloor(p,2));assert.ok(!canEnterFloor(p,1.5));
assert.deepEqual(clearDungeonFloor(p,5),p);
for(let f=1;f<=100;f++){
 assert.ok(canEnterFloor(p,f));
 const d=dungeonFloorDefinition(f);assert.equal(d.floor,f);assert.ok(d.boss);assert.ok(d.corridors.length&&d.enemies.length&&d.traps.length);
 p=clearDungeonFloor(p,f);assert.equal(p.highest,Math.min(100,f+1));
 p=restoreDungeonProgress(JSON.parse(JSON.stringify(p)));
}
assert.ok(!canEnterFloor(p,101));assert.equal(p.cleared.length,100);
assert.equal(restoreDungeonProgress({cleared:[2,10,NaN,101]}).highest,1);
assert.equal(floorNumber(1000),100);
assert.deepEqual(clearDungeonFloor(p,100),p);
console.log('PASS: 100 floors, sequential boss permissions, permanent save roundtrip, direct entry authorization, bounds and per-floor corridor/enemy/trap definitions.');
