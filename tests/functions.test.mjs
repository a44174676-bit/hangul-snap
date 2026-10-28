import test from 'node:test';import assert from 'node:assert/strict';
import compose from '../netlify/functions/compose.mjs';
import products from '../netlify/functions/product-sets.mjs';
import {objectsFromCells} from '../site/js/spatial.js';
test('GET /api/product-sets/basic14 response',async()=>{const r=await products(new Request('https://example.com/.netlify/functions/product-sets?setId=basic14'));const j=await r.json();assert.equal(r.status,200);assert.equal(j.jamoList.length,14);assert.equal(j.uiLangDefault,'vi')});
test('POST /api/compose with corrected 2D cells retains original and no forced correction',async()=>{const objects=objectsFromCells([{L:'ㄱ',V:'ㅗ',T:null},{L:'ㄱ',V:'ㅣ',T:null}]);const r=await compose(new Request('https://example.com/.netlify/functions/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({objects,cellCount:2})}));const j=await r.json();assert.equal(j.originalText,'고기');assert.equal(j.requiresConfirmation,true);assert.equal(j.wordCandidates[0].autoCorrected,false);});
