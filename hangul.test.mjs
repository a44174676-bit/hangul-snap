import test from 'node:test';import assert from 'node:assert/strict';
import {composeJamo,decomposeSyllables,sortDetectedObjects} from '../site/js/hangul.js';
import {parseDictionary} from '../netlify/functions/dictionary.mjs';
test('composes basic Hangul words',()=>{for(const [a,word] of [[['ㄴ','ㅏ','ㅁ','ㅜ'],'나무'],[['ㄱ','ㅗ','ㄱ','ㅣ'],'고기'],[['ㅂ','ㅏ','ㄷ','ㅏ'],'바다'],[['ㄱ','ㅏ','ㅂ','ㅏ','ㅇ'],'가방']])assert.deepEqual(composeJamo(a),{text:word,valid:true,issues:[]});});
test('invalid input is exposed and never silently repaired',()=>{const result=composeJamo(['ㄴ','ㄴ','ㅏ']);assert.equal(result.valid,false);assert.ok(result.issues.length)});
test('round-trips example word',()=>{const word='가방';assert.equal(composeJamo(decomposeSyllables(word)).text,word)});
test('orders detections with simple reading direction',()=>{const a=[{bbox:[400,20,30,50]},{bbox:[100,10,30,50]}];assert.deepEqual(sortDetectedObjects(a),[a[1],a[0]]);});
test('parses dictionary XML and Vietnamese translation safely',()=>{const xml=`<channel><item><target_code>32750</target_code><word>나무</word><pos>명사</pos><pronunciation>나무</pronunciation><sense><definition>줄기와 &amp; 잎이 있는 식물.</definition><translation><trans_lang>베트남어</trans_lang><trans_word>cây</trans_word><trans_dfn>thực vật</trans_dfn></translation></sense></item></channel>`;const data=parseDictionary(xml,'나무');assert.equal(data.status,'ok');assert.equal(data.senses[0].translation,'cây');assert.equal(data.senses[0].definitionKo,'줄기와 & 잎이 있는 식물.');assert.equal(parseDictionary(xml,'고기').status,'not-found');});
