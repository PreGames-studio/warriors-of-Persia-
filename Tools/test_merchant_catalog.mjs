import assert from 'node:assert/strict';
import {MERCHANT_CATALOG,purchaseMerchantItem} from '../unity_preview/merchant-catalog.js';
import {merchantItemArt} from '../unity_preview/merchant-shop.js';
const shops=Object.values(MERCHANT_CATALOG),ids=new Set();
assert.equal(shops.length,18);
for(const shop of shops){
 assert.equal(shop.items.length,6);
 for(const item of shop.items){
  assert.ok(!ids.has(item.id));ids.add(item.id);
  assert.ok(['hp','mana','full_restore','atk','max_hp','max_mana'].includes(item.type));
  assert.ok(item.price>0&&item.power>0);
  assert.ok(/^(data:image\/svg\+xml|\.\/assets\/blacksmith\/)/.test(merchantItemArt(item,shop.color)));
 }
 const item=shop.items[0],state={coins:2000,inventory:[],currentZone:'village'};
 assert.equal(purchaseMerchantItem(state,shop.id,item.id).ok,true);
 assert.equal(state.coins,2000-item.price);assert.equal(state.inventory[0].id,item.id);
 const loaded=JSON.parse(JSON.stringify(state));assert.deepEqual(loaded.inventory,state.inventory);
 for(const bad of [{...state,currentZone:'open_world'},{...state,coins:0},{...state,inventory:Array(16).fill({})}]){
  const before=JSON.stringify(bad);assert.equal(purchaseMerchantItem(bad,shop.id,item.id).ok,false);assert.equal(JSON.stringify(bad),before);
 }
 assert.equal(purchaseMerchantItem(state,shop.id,'not-a-product').ok,false);
}
assert.equal(ids.size,108);
console.log('PASS: 18 professions, 108 unique products and artwork, inventory persistence, guarded purchases and exact gold deductions.');
