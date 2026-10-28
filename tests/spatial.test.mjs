import test from 'node:test';import assert from 'node:assert/strict';
import {composeCell,composeCells,composeSpatial,objectsFromCells,normalizeObjects,EMPTY} from '../site/js/spatial.js';
import {EXAMPLES,JAMO,LESSONS,LOCAL_LEXICON} from '../site/js/jamo-data.js';
const cells=(a,b)=>[a,b];
test('Unicode Hangul composition formula and common words',()=>{
 assert.equal(composeCell({L:'ㄴ',V:'ㅏ',T:null}),'나');
 assert.equal(composeCell({L:'ㅂ',V:'ㅏ',T:'ㅇ'}),'방');
 for(const w of ['나무','고기','바다','가방']){
   let syllables=[...w].map(ch=>{const i=ch.charCodeAt(0)-0xAC00;const L='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ',V='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ',T=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];return {L:L[Math.floor(i/588)],V:V[Math.floor((i%588)/28)],T:T[i%28]||null}});
   assert.equal(composeCells(syllables).text,w);
   const result=composeSpatial({objects:objectsFromCells(syllables),cellCount:2});
   assert.equal(result.originalText,w);
   assert.equal(result.wordCandidates[0].valid,true);
 }
});
test('2D position distinguishes L, vertical/horizontal vowel and T',()=>{
 const items=[
  {id:'l',bbox:[70,190,170,180],topK:[{jamo:'ㄱ',confidence:.9}]},
  {id:'v',bbox:[280,570,160,110],topK:[{jamo:'ㅗ',confidence:.85}]},
  {id:'l2',bbox:[570,190,170,180],topK:[{jamo:'ㄱ',confidence:.9}]},
  {id:'v2',bbox:[800,240,130,180],topK:[{jamo:'ㅣ',confidence:.85}]}
 ];
 const r=composeSpatial({objects:items,cellCount:2});assert.equal(r.originalText,'고기');
});
test('dictionary suggestion MUST NOT auto-correct original non-dictionary word',()=>{
 const detected=[{id:'a',bbox:[100,190,140,150],topK:[{jamo:'ㄱ',confidence:.8}]},{id:'b',bbox:[300,200,140,160],topK:[{jamo:'ㅏ',confidence:.7},{jamo:'ㅓ',confidence:.2}]}];
 const r=composeSpatial({objects:detected,cellCount:1});
 assert.equal(r.originalText,'가');assert.equal(r.requiresConfirmation,true);assert.ok(r.wordCandidates.every(c=>c.autoCorrected===false));
});
test('recognition normalization removes invalid jamo and invalid geometry',()=>{
 const o=normalizeObjects([{id:'x',bbox:[10,20,50,60],topK:[{jamo:'ㄱ',confidence:.88},{jamo:'BAD',confidence:1}]},{bbox:['NaN',0,2,5],topK:[{jamo:'ㅏ',confidence:1}]}]);
 assert.equal(o.length,1);assert.equal(o[0].topK[0].jamo,'ㄱ');
});
test('14 lessons contain three bilingual example words',()=>{
 assert.equal(JAMO.length,14);for(const j of JAMO){assert.equal(LESSONS[j].words.length,3);assert.ok(LESSONS[j].nameKo);assert.ok(LESSONS[j].onsetKo);assert.ok(LESSONS[j].codaVi)}
});
test('user corrections survive API normalization',()=>{
 const items=normalizeObjects([{id:'edited',bbox:[120,200,110,100],topK:[{jamo:'ㄴ',confidence:.8}],correctedJamo:'ㄱ',correctedSlot:'L',correctedCell:0}]);
 assert.equal(items[0].correctedJamo,'ㄱ');assert.equal(items[0].correctedCell,0);assert.equal(items[0].correctedSlot,'L');
});
