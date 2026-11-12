import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {MERCHANT_KEEPERS,merchantKeeper} from '../unity_preview/merchant-keepers.js';
import {MERCHANT_CATALOG} from '../unity_preview/merchant-catalog.js';
assert.deepEqual(Object.keys(MERCHANT_KEEPERS).sort(),Object.keys(MERCHANT_CATALOG).sort(),'every catalog shop has a dedicated keeper');
const hashes=new Set();
for(const [id,k] of Object.entries(MERCHANT_KEEPERS)){
 assert.equal(merchantKeeper(id),k);assert.ok(k.description.length>20);
 const bytes=fs.readFileSync('unity_preview/'+k.image.replace('./',''));
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));
}
assert.equal(hashes.size,Object.keys(MERCHANT_KEEPERS).length,'no duplicate portrait files');
assert.equal(merchantKeeper('unconfigured').image,'./assets/merchants/merchant-hall.jpg');
console.log(`PASS: ${hashes.size} distinct dedicated merchant portraits (all catalog shops), local files and accessible descriptions; unknown-shop fallback retained.`);
