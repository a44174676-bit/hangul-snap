import test from 'node:test';import assert from 'node:assert/strict';
import {parseSearch,parseDetail} from '../netlify/functions/dictionary.mjs';
const xml=`<?xml version="1.0"?><channel><item><target_code>123</target_code><word>나무</word><pronunciation>나무</pronunciation><pos>명사</pos><link>https://krdict.korean.go.kr/</link><sense><sense_order>1</sense_order><definition>줄기와 가지가 있는 식물.</definition><translation><trans_word>cây</trans_word><trans_dfn>thực vật có thân và cành</trans_dfn></translation></sense><sense><sense_order>2</sense_order><definition>다른 뜻.</definition></sense></item></channel>`;
test('search parses multiple official senses and translation source',()=>{const r=parseSearch(xml,'나무');assert.equal(r.status,'found');assert.equal(r.senses.length,2);assert.equal(r.senses[0].translationVi,'cây');assert.equal(r.senses[0].translationSource,'krdict_official');assert.equal(r.senses[1].translationSource,'none');});
test('missing headword is not_found and not an API error',()=>{assert.equal(parseSearch(xml,'없는말').status,'not_found');assert.equal(parseSearch('<error>bad key</error>','나무').status,'error');});
test('view detail can replace initial senses',()=>{const initial=parseSearch(xml,'나무');const r=parseDetail(xml,'나무',initial);assert.equal(r.senses.length,2)});
test('homonym meanings from search are preserved after view detail',()=>{
 const xml2=xml.replace('</channel>','<item><target_code>999</target_code><word>나무</word><pos>명사</pos><sense><sense_order>1</sense_order><definition>전혀 다른 뜻풀이.</definition></sense></item></channel>');
 const search=parseSearch(xml2,'나무');const detail=parseDetail(xml,'나무',search);assert.equal(detail.senses.length,3);
});
