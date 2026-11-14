import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import recognize,{config as recognitionConfig,validateDetections,parseModelJson} from '../netlify/functions/recognize.mjs';
import compose,{mergeAdjustments} from '../netlify/functions/compose.mjs';
import dictionary,{parseSearch,parseDetail} from '../netlify/functions/dictionary.mjs';
import localIndex from '../netlify/functions/dictionary-index.mjs';
import {localEntry, LEARNING_CARD_WORDS} from '../netlify/functions/local-dictionary.mjs';
import {objectsFromCells} from '../site/js/spatial.js';

const fs=readFileSync(new URL('../netlify.toml',import.meta.url),'utf-8');
test('Netlify routes expose five API endpoints and limit photo recognition requests',()=>{
 assert.match(fs,/command = "npm run build && npm test"/);
 assert.match(fs,/publish = "site"/);
 assert.equal(recognitionConfig.path,'/api/recognize');
 assert.deepEqual(recognitionConfig.rateLimit.aggregateBy,['ip','domain']);
 for(const route of ['compose','dictionary','dictionary-index']) {
  assert.match(fs,new RegExp(`from = "/api/${route}"`));
  assert.match(fs,new RegExp(`to = "/\\.netlify/functions/${route}"`));
 }
 assert.match(fs,/from = "\/api\/product-sets\/:setId"/);
});

test('OpenAI detections preserve well position, computed center and sorted alternatives',()=>{
 const result=validateDetections({objects:[
  {bbox:[120,200,180,100],topK:[{jamo:'ㄴ',confidence:0.3},{jamo:'ㄱ',confidence:0.6}]},
  {bbox:[600,170,120,240],topK:[{jamo:'ㅏ',confidence:0.75}],trayCell:1,traySlot:'V'}
 ]},'word');
 assert.equal(result.ok,true);assert.equal(result.objects.length,2);
 assert.deepEqual(result.objects[0].center,[210,250]);
 assert.equal(result.objects[0].topK[0].jamo,'ㄱ');
 assert.equal(result.objects[1].bbox.length,4);
 assert.equal(result.objects[1].trayCell,1);
 assert.equal(result.objects[1].traySlot,'V');
});
test('Reject word-level output, out-of-range bbox and invalid confidences',()=>{
 assert.equal(validateDetections({word:'나무'},'word').ok,false);
 assert.equal(validateDetections({objects:[{bbox:[900,100,200,100],topK:[{jamo:'ㄴ',confidence:1}]}]},'single').ok,false);
 assert.equal(validateDetections({objects:[{bbox:[0,0,100,100],topK:[{jamo:'ㄱ',confidence:1.3}]}]},'single').ok,false);
 assert.equal(validateDetections({objects:[{bbox:[0,0,100,100],topK:[{jamo:'ㄱ',confidence:0.7},{jamo:'ㄱ',confidence:0.2}]}]},'single').ok,false);
});
test('Word recognition accepts the 한끼 tray pieces through API composition',async()=>{
 const pieces=[
  ['ㅎ',0,'L',[120,170,100,120]], ['ㅏ',0,'V',[285,170,100,120]], ['ㄴ',0,'T',[175,353,150,70]],
  ['ㄲ',1,'L',[595,170,115,120]], ['ㅣ',1,'V',[780,170,100,120]]
 ].map(([jamo,trayCell,traySlot,bbox])=>({bbox,trayCell,traySlot,topK:[{jamo,confidence:.9}]}));
 const detected=validateDetections({objects:pieces},'word');
 assert.equal(detected.ok,true);
 const response=await compose(new Request('https://unit.test/api/compose',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({objects:detected.objects,cellCount:2})
 }));
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.originalText,'한끼');
 assert.equal(data.actions.keepOriginal,true);
});
test('Parse structured OpenAI content and accept older provider fixtures',()=>{
 const r=parseModelJson({choices:[{message:{content:'{"objects":[]}'}}]});
 assert.deepEqual(r.objects,[]);
 assert.equal(parseModelJson({choices:[{message:{content:'어묵'}}]}),null);
 assert.deepEqual(parseModelJson({candidates:[{content:{parts:[{text:'{"objects":[]}'}]}}]}).objects,[]);
});
test('Missing API key returns unconfigured with no detections',async()=>{
 const prev=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;
 const r=await recognize(new Request('https://unit.test/api/recognize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'word',setId:'basic14',image:'data:image/jpeg;base64,aGVsbG8='})}));
 assert.equal(r.status,503);assert.deepEqual((await r.json()).objects,[]);
 if(prev)process.env.OPENAI_API_KEY=prev;
});
test('Compose: partial ID patch does not discard unedited objects',()=>{
 const orig=objectsFromCells([{L:'ㄴ',V:'ㅏ',T:null},{L:'ㅁ',V:'ㅜ',T:null}]);
 const merged=mergeAdjustments(orig,[{id:orig[0].id,correctedJamo:'ㄱ'}]);
 assert.equal(merged.length,4);assert.equal(merged[0].correctedJamo,'ㄱ');
 assert.equal(merged[1].id,orig[1].id);
});
test('Compose: valid non-index syllable is retained with keepOriginal flag',async()=>{
 const objects=objectsFromCells([{L:'ㄱ',V:'ㅏ',T:null},{L:'ㄱ',V:'ㅏ',T:null}]); // 가가, not indexed
 const response=await compose(new Request('https://unit.test/api/compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({objects,cellCount:2})}));
 const data=await response.json();
 assert.equal(data.originalText,'가가');
 assert.equal(data.wordCandidates[0].text,'가가');
 assert.equal(data.wordCandidates[0].lexiconStatus,'not_in_local_index');
 assert.equal(data.wordCandidates[0].autoCorrected,false);
 assert.equal(data.actions.keepOriginal,true);
 assert.equal(data.actions.editJamo,true);
 assert.equal(data.requiresConfirmation,true);
});
test('Local candidate index does not claim that unknown word is absent from KRDICT',async()=>{
 const response=await localIndex(new Request('https://unit.test/api/dictionary-index?word=가가'));
 assert.equal((await response.json()).status,'not_in_local_index');
});

const searchXml=`<channel><total>1</total><item><target_code>32750</target_code><word>나무</word><pos>명사</pos><link>https://krdict.korean.go.kr/dicSearch/SearchView?paraWordNo=32750</link><sense><sense_order>1</sense_order><definition>나무 뜻풀이 1</definition><translation><trans_lang>베트남어</trans_lang><trans_word>cây</trans_word><trans_dfn>cây lâu năm</trans_dfn></translation></sense></item></channel>`;
const viewXml=`<channel><total>1</total><item><target_code>32750</target_code><word_info><word>나무</word><pos>명사</pos><pronunciation_info><pronunciation>나무</pronunciation></pronunciation_info><sense_info><definition>나무 뜻풀이 1</definition></sense_info></word_info></item></channel>`;
test('Official /api/view uses sense_info and retains search translation',()=>{
 const result=parseDetail(viewXml,'나무',parseSearch(searchXml,'나무'));
 assert.equal(result.senses.length,1);
 assert.equal(result.senses[0].definitionKo,'나무 뜻풀이 1');
 assert.equal(result.senses[0].translationVi,'cây');
 assert.equal(result.senses[0].translationSource,'krdict_official');
});
test('Official dictionary: broken upstream response is error, not not_found',()=>{
 assert.equal(parseSearch('<html>bad gateway</html>','나무').status,'error');
 assert.equal(parseSearch('<channel><total>0</total></channel>','없는말').status,'not_found');
});
test('Local fallback: 42 card references supported with explicit non-official label',()=>{
 assert.equal(LEARNING_CARD_WORDS.length,42);
 assert.ok(LEARNING_CARD_WORDS.every(w=>localEntry(w)));
 assert.equal(localEntry('나무').source,'local_fallback');
 assert.equal(localEntry('나무').senses[0].translationSource,'local_editorial');
 assert.equal(localEntry('가가'),null);
});
test('Official dictionary: no key and unavailable K-GROW returns local fallback',async()=>{
 const prev=process.env.KRDICT_API_KEY,originalFetch=global.fetch;
 delete process.env.KRDICT_API_KEY;
 let attempted=0;
 global.fetch=async url=>{
  assert.match(String(url),/^https:\/\/k-grow-20260912231534\.netlify\.app\/\.netlify\/functions\/krdict-/);
  attempted++;
  return Response.json({error:'upstream unavailable'},{status:503});
 };
 try{
  const r=await dictionary(new Request('https://unit.test/api/dictionary?word=나무&lang=vi'));
  const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.status,'ok');
  assert.equal(body.source,'local_fallback');assert.equal(body.isOfficial,false);
  assert.ok(attempted>=1,'must try official K-GROW bridge before editorial fallback');
 }finally{
  global.fetch=originalFetch;
  if(prev===undefined)delete process.env.KRDICT_API_KEY;
  else process.env.KRDICT_API_KEY=prev;
 }
});
test('Official dictionary: no key but K-GROW official succeeds, retain official translation',async()=>{
 const prev=process.env.KRDICT_API_KEY,originalFetch=global.fetch;
 delete process.env.KRDICT_API_KEY;
 global.fetch=async url=>{
  assert.match(String(url),/krdict-i18n\?q=/);
  return Response.json({
    ok:true,status:'SOURCE_RETRIEVED',
    source:{id:'KRDICT',tier:'OFFICIAL'},headword:'나무',targetCode:'32750',
    senses:[{pos:'명사',definitionKo:'줄기와 가지가 자라나는 여러해살이 식물.',
      translationWord:'cây',translationDefinition:'Thực vật có thân và cành.',
      translationSource:'krdict_official'}]
  });
 };
 try{
  const r=await dictionary(new Request('https://unit.test/api/dictionary?word=나무&lang=vi'));
  const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.status,'found');
  assert.equal(body.source,'kgrow_official_bridge');assert.equal(body.isOfficial,true);
  assert.equal(body.senses[0].translationVi,'cây');
  assert.equal(body.senses[0].translationSource,'krdict_official');
 }finally{
  global.fetch=originalFetch;
  if(prev===undefined)delete process.env.KRDICT_API_KEY;
  else process.env.KRDICT_API_KEY=prev;
 }
});
test('Official dictionary: mocked search + real view XML produce official Vietnamese meaning',async()=>{
 const old=global.fetch;const prev=process.env.KRDICT_API_KEY;
 process.env.KRDICT_API_KEY='a'.repeat(32);
 global.fetch=async input=>new Response(String(input).includes('/api/view?')?viewXml:searchXml,{status:200});
 try{const r=await dictionary(new Request('https://unit.test/api/dictionary?word=나무&lang=vi'));
 const body=await r.json();assert.equal(r.status,200);assert.equal(body.status,'found');
 assert.equal(body.senses[0].translationVi,'cây');assert.equal(body.sourceUrl.startsWith('https://krdict.korean.go.kr/'),true);
 }finally{global.fetch=old;if(prev)process.env.KRDICT_API_KEY=prev;else delete process.env.KRDICT_API_KEY;}
});
test('Official dictionary: upstream failure must not claim not_found',async()=>{
 const old=global.fetch;const prev=process.env.KRDICT_API_KEY;
 process.env.KRDICT_API_KEY='a'.repeat(32);global.fetch=async()=>{throw Error('network outage')};
 try{const r=await dictionary(new Request('https://unit.test/api/dictionary?word=나무&lang=vi'));
 const body=await r.json();assert.equal(r.status,200);assert.equal(body.status,'ok');
 assert.equal(body.source,'local_fallback');
 }finally{global.fetch=old;if(prev)process.env.KRDICT_API_KEY=prev;else delete process.env.KRDICT_API_KEY;}
});
test('OpenAI provider success: schema JSON still undergoes bbox validation',async()=>{
 const original=global.fetch;const prior=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='placeholder-test-key';
 global.fetch=async (_url,options)=>{
  JSON.parse(options.body); // verify that the function sends a valid JSON request
  return Response.json({choices:[{message:{content:JSON.stringify({objects:[{bbox:[100,130,210,190],topK:[{jamo:'ㄱ',confidence:.7},{jamo:'ㄴ',confidence:.3}]}],warnings:[]})}}]});
 };
 try {
  const r=await recognize(new Request('https://unit.test/api/recognize',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'single',setId:'basic14',image:'data:image/png;base64,aGVsbG8='})}));
  assert.equal(r.status,200);
  const output=await r.json();assert.equal(output.objects[0].topK.length,2);
  assert.deepEqual(output.objects[0].center,[205,225]);
 }finally{global.fetch=original;if(prior)process.env.OPENAI_API_KEY=prior;else delete process.env.OPENAI_API_KEY;}
});
