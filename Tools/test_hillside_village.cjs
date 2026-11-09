// Deterministic layout regression checks; no browser dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('unity_preview/index.html', 'utf8');
const start = html.indexOf('    const CENTRAL_VILLAGE_SHOPS_3D');
const end = html.indexOf('    // Twenty stationary quest-giver', start);
const source = html.slice(start, end) + '; ({plan: VILLAGE_DISTRICT_PLAN, shops: VILLAGE_SHOPS_3D, height: villageHeight})';
const {plan, shops, height} = vm.runInNewContext(source);
assert.equal(plan.houses.length, 400);
assert.equal(shops.length, 20);
assert.equal(new Set(plan.houses.map(p => p.id)).size, 400);
assert.equal(JSON.stringify(plan), JSON.stringify(vm.runInNewContext(source).plan));
assert.ok(Math.abs(height(0, 10)) < 1e-9);
assert.ok(height(0, -200) - height(0, 200) > 80);
for (const house of plan.houses) {
  assert.equal(house.y, height(house.x, house.z));
  assert.ok(Math.abs(house.x) < 260 && Math.abs(house.z) < 260);
  assert.ok(Math.hypot(house.x,house.z)>26, 'central court stays clear');
  for (const shop of shops) assert.ok(Math.abs(house.x-shop.pos.x) >= 15 || Math.abs(house.z-shop.pos.z) >= 15);
}
assert.ok(shops.some(s => s.id === 'blacksmith'));
assert.ok(new Set(shops.map(s => `${Math.sign(s.pos.x)},${Math.sign(s.pos.z)}`)).size === 4);
assert.ok(html.includes('aria-expanded="false"'));
assert.ok(html.includes("e.key === 'Escape'"));
console.log('PASS: 400 unique deterministic hillside homes; 20 distributed shops; clear streets and shop approaches; height and map controls.');

// Regression: true free placement and rotation, not jittered rows or mirrored pairs.
assert.ok(new Set(plan.houses.map(p=>p.rotY.toFixed(2))).size>200);
assert.ok(plan.alleys.some(p=>Math.abs(p.rotY)>.2));
for (let i=0;i<plan.houses.length;i++) {
  const a=plan.houses[i];
  const half=p=>({w:(4.7*Math.abs(Math.cos(p.rotY))+3.75*Math.abs(Math.sin(p.rotY)))*1.25+.45,d:(4.7*Math.abs(Math.sin(p.rotY))+3.75*Math.abs(Math.cos(p.rotY)))*1.25+.45});
  const ah=half(a);
  for(const b of plan.houses.slice(i+1)) {const bh=half(b);assert.ok(Math.abs(a.x-b.x)>=ah.w+bh.w+1.19 || Math.abs(a.z-b.z)>=ah.d+bh.d+1.19,'passable non-overlapping house footprints');}
}
console.log('PASS: free rotations, winding lanes, no overlapping house collider footprints.');
