import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {SIGNATURE_ITEM_ART} from '../unity_preview/merchant-signature-items.js';
import {MERCHANT_CATALOG,purchaseMerchantItem} from '../unity_preview/merchant-catalog.js';
import {merchantItemArt} from '../unity_preview/merchant-shop.js';
for(const shop of Object.values(MERCHANT_CATALOG)){const art=merchantItemArt(shop.items[0],shop.color);assert.ok(art.startsWith('./assets/'),'every catalog shop has a full-quality local signature image');assert.ok(fs.existsSync('unity_preview/'+art.replace('./','')));}
const hashes=new Set();
for(const [id,path] of Object.entries(SIGNATURE_ITEM_ART)){
 const shop=Object.values(MERCHANT_CATALOG).find(s=>s.items.some(i=>i.id===id));assert.ok(shop);
 const item=shop.items.find(i=>i.id===id);assert.equal(merchantItemArt(item,shop.color),path);
 const bytes=fs.readFileSync('unity_preview/'+path.replace('./',''));assert.equal(bytes.subarray(1,4).toString(),'PNG');hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
 const state={coins:2000,inventory:[],currentZone:'village'};assert.ok(purchaseMerchantItem(state,shop.id,id).ok);assert.equal(state.coins,2000-item.price);assert.equal(state.inventory[0].id,id);
}
assert.equal(hashes.size,Object.keys(SIGNATURE_ITEM_ART).length);
console.log(`PASS: ${hashes.size} distinct signature portraits connected to purchasable items, unchanged prices/IDs, original local PNGs.`);
