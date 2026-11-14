import test from 'node:test';import assert from 'node:assert/strict';
import {composeCell,composeCells,composeSpatial,objectsFromCells,normalizeObjects,EMPTY} from '../site/js/spatial.js';
import {EXAMPLES,JAMO,JAMO_NAMES,LESSONS,LOCAL_LEXICON} from '../site/js/jamo-data.js';
import {ALL_JAMO,JAMO_BY_SLOT} from '../site/js/jamo-letters.js';
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
test('Word composer accepts the full SEKKI brand name and compound letters',()=>{
 assert.deepEqual(Object.values(JAMO_BY_SLOT).map(letters=>letters.length),[19,21,27]);
 assert.equal(ALL_JAMO.length,51);
 const brand=[
  {L:'ㅎ',V:'ㅏ',T:'ㄴ'}, {L:'ㄱ',V:'ㅡ',T:'ㄹ'},
  {L:'ㅅ',V:'ㅔ',T:null}, {L:'ㄲ',V:'ㅣ',T:null}
 ];
 const result=composeSpatial({objects:normalizeObjects(objectsFromCells(brand)),cellCount:4});
 assert.equal(result.originalText,'한글세끼');
 assert.equal(result.wordCandidates[0].valid,true);
 assert.deepEqual(result.cells,brand);
 assert.equal(composeCell({L:'ㄱ',V:'ㅘ',T:null}),'과');
 assert.equal(composeCell({L:'ㄴ',V:'ㅓ',T:'ㄳ'}),'넋');
 assert.equal(composeCell({L:'ㅎ',V:'ㅣ',T:'ㅎ'}),'힣');
 assert.equal(composeCell({L:'ㄳ',V:'ㅓ',T:null}),null);
 assert.equal(composeCell({L:'ㄷ',V:'ㅏ',T:'ㄸ'}),null);
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
test('Tray placement keeps 받침 in 어묵 even when the whole tray sits high in the photo',()=>{
 const objects=normalizeObjects([
  {id:'1',bbox:[160,170,85,120],topK:[{jamo:'ㅇ',confidence:.9}],trayCell:0,traySlot:'L'},
  {id:'2',bbox:[272,167,100,127],topK:[{jamo:'ㅓ',confidence:.9}],trayCell:0,traySlot:'V'},
  {id:'3',bbox:[550,170,85,120],topK:[{jamo:'ㅁ',confidence:.9}],trayCell:1,traySlot:'L'},
  {id:'4',bbox:[650,171,100,120],topK:[{jamo:'ㅜ',confidence:.9}],trayCell:1,traySlot:'V'},
  {id:'5',bbox:[625,352,88,65],topK:[{jamo:'ㄱ',confidence:.9}],trayCell:1,traySlot:'T'}
 ]);
 assert.equal(composeSpatial({objects,cellCount:2}).wordCandidates[0].text,'어묵');
 const legacy=objects.map(({trayCell,traySlot,...item})=>item);
 assert.equal(composeSpatial({objects:legacy,cellCount:2}).wordCandidates[0].text,'어묵');
 const userAdjustments=[{id:'5',correctedJamo:'ㄴ'}];
 const corrected=composeSpatial({objects,cellCount:2,userAdjustments}).wordCandidates[0];
 assert.equal(corrected.text,'어문');
 assert.equal(corrected.valid,true);
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
test('Every modern jamo has a single-piece lesson name',()=>{
 assert.deepEqual(new Set(Object.keys(JAMO_NAMES)),new Set(ALL_JAMO));
 assert.ok(ALL_JAMO.every(jamo=>/^[가-힣]+$/.test(JAMO_NAMES[jamo])));
});
test('user corrections survive API normalization',()=>{
 const items=normalizeObjects([{id:'edited',bbox:[120,200,110,100],topK:[{jamo:'ㄴ',confidence:.8}],correctedJamo:'ㄱ',correctedSlot:'L',correctedCell:0}]);
 assert.equal(items[0].correctedJamo,'ㄱ');assert.equal(items[0].correctedCell,0);assert.equal(items[0].correctedSlot,'L');
});
