// Deterministic layout regression checks; no browser dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('unity_preview/index.html', 'utf8');
const start = html.indexOf('    const CENTRAL_VILLAGE_SHOPS_3D');
const end = html.indexOf('    // Twenty stationary quest-giver', start);
const source = html.slice(start, end) + '; ({plan: VILLAGE_DISTRICT_PLAN, shops: VILLAGE_SHOPS_3D, height: villageHeight})';
const {plan, shops, height} = vm.runInNewContext(source);
assert.equal(plan.houses.length, 800);
assert.equal(shops.length, 20);
assert.equal(new Set(plan.houses.map(p => p.id)).size, 800);
assert.equal(JSON.stringify(plan), JSON.stringify(vm.runInNewContext(source).plan));
assert.ok(Math.abs(height(0, 10)) < 1e-9);
assert.ok(height(0, -200) - height(0, 200) > 80);
for (const house of plan.houses) {
  assert.equal(house.y, height(house.x, house.z));
  assert.ok(Math.abs(house.x) < 260 && Math.abs(house.z) < 260);
  assert.ok(Math.abs(house.x) > 11, 'central street stays clear');
  for (const shop of shops) assert.ok(Math.abs(house.x-shop.pos.x) >= 15 || Math.abs(house.z-shop.pos.z) >= 15);
}
assert.ok(shops.some(s => s.id === 'blacksmith'));
assert.ok(new Set(shops.map(s => `${Math.sign(s.pos.x)},${Math.sign(s.pos.z)}`)).size === 4);
assert.ok(html.includes('aria-expanded="false"'));
assert.ok(html.includes("e.key === 'Escape'"));
console.log('PASS: 800 unique deterministic hillside homes; 20 distributed shops; clear streets and shop approaches; height and map controls.');
