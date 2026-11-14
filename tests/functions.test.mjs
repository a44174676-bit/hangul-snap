import test from 'node:test';import assert from 'node:assert/strict';
import compose from '../netlify/functions/compose.mjs';
import products from '../netlify/functions/product-sets.mjs';
import {objectsFromCells} from '../site/js/spatial.js';
import {ALL_JAMO} from '../site/js/jamo-letters.js';
test('Existing product-set URLs expose the full Hangul inventory',async()=>{
 const response=await products(new Request('https://example.com/.netlify/functions/product-sets?setId=basic14'));
 const data=await response.json();
 assert.equal(response.status,200);
 assert.equal(data.setId,'basic14');
 assert.deepEqual(data.jamoList,ALL_JAMO);
 assert.equal(data.uiLangDefault,'vi');
});
test('POST /api/compose with corrected 2D cells retains original and no forced correction',async()=>{const objects=objectsFromCells([{L:'ㄱ',V:'ㅗ',T:null},{L:'ㄱ',V:'ㅣ',T:null}]);const r=await compose(new Request('https://example.com/.netlify/functions/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({objects,cellCount:2})}));const j=await r.json();assert.equal(j.originalText,'고기');assert.equal(j.requiresConfirmation,true);assert.equal(j.wordCandidates[0].autoCorrected,false);});
