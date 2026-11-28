import assert from 'node:assert/strict';
import { OPEN_WORLD_BOUNDS, WEST_FIELD, OPEN_WORLD_ROUTES, isOpenWorldLand, routeDistance, createSlimeSpawns } from '../../unity_preview/open-world-first.js';
import { createCombatPlan, combatHeight, BUSH_CARDS_PER_CLUMP } from '../../unity_preview/world-landscape.js';

assert.equal(OPEN_WORLD_BOUNDS.maxX, -WEST_FIELD.minX);
assert(isOpenWorldLand(1100, 800));
assert(!isOpenWorldLand(1182, 0));
assert(!isOpenWorldLand(0, 881));
const plan = createCombatPlan('open_world');
assert.deepEqual(plan, createCombatPlan('open_world'), 'generation is deterministic');
assert.equal(plan.plots.length, 0, "no homes outside the village");
assert.equal(plan.baseBushCount, 4153);
assert.equal(createCombatPlan("dungeon", 1).plots.length, 0);
assert.equal(createCombatPlan("dungeon", 3).plots.length, 0);
assert.equal(plan.bushes.length, plan.baseBushCount * 5, 'previous clump count retained');
assert.equal(BUSH_CARDS_PER_CLUMP, 50, '50 bush cards per prior clump');
assert.equal(plan.bushes.length * BUSH_CARDS_PER_CLUMP, 1038250);
assert(plan.walls.length > 20 && plan.walls.some(p => p.x < 120));
for (const wall of plan.walls) {
  assert(wall.x > 25 && routeDistance(wall.x, wall.z) > 20);
  assert.equal(wall.y, combatHeight('open_world', 1, wall.x, wall.z));
  for (const [x,z] of [[54,-28],[78,30]]) assert(Math.hypot(wall.x-x,wall.z-z)>38);
}
for (const bush of plan.bushes.filter(p => p.x > 25)) assert(routeDistance(bush.x, bush.z) >= 13);

for (const plot of plan.plots) {
  assert(plot.x > 0 && routeDistance(plot.x, plot.z) >= 22);
  assert.equal(plot.y, combatHeight('open_world', 1, plot.x, plot.z));
  for (const [x,z] of [[54,-28],[78,30]]) assert(Math.hypot(plot.x-x,plot.z-z)>28);
}
for (const route of OPEN_WORLD_ROUTES) for (const [x,z] of route) assert(isOpenWorldLand(x,z));
assert.equal(createSlimeSpawns().length, 300);
assert(createSlimeSpawns().every(p => p.x < -24 && routeDistance(p.x,p.z) >= 22));
console.log('East bank bounds, clear lanes, portals, terrain and west slimes: PASS');
