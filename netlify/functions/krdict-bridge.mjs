/**
 * Temporary resilience path for the corporate learning ecosystem.
 * When HANGUL SNAP's direct KRDICT key fails, relay a public word-only query
 * through the already operating K-GROW KRDICT Netlify Function.
 *
 * This is intentionally NOT a physical-jamo recognition or correction system.
 * No images, account data, or API keys are transmitted to K-GROW. Only the
 * learner-confirmed Korean word is submitted.
 */
const K_GROW='https://k-grow-20260912231534.netlify.app';
const OFFICIAL='국립국어원 한국어기초사전';
const HEADWORD=/^[가-힣]{1,25}$/;

export function mapKGrowSearch(data,word,lang){
 if(!data||data.ok!==true||data.status!=='SOURCE_RETRIEVED'||
   data.source?.id!=='KRDICT'||data.source?.tier!=='OFFICIAL'||
   data.query!==word||!Array.isArray(data.results))return null;
 const exact=data.results.filter(row=>row?.word===word);
 if(!exact.length)return null;
 const senses=[];
 for(const row of exact){
   const code=String(row.targetCode||'');
   for(const sense of (Array.isArray(row.senses)?row.senses:[])){
     const definitionKo=String(sense?.definitionKo||'').trim();
     if(!definitionKo)continue;
     const translationVi=lang==='vi'?String(sense.translationWordVi||''):'';
     const definitionVi=lang==='vi'?String(sense.translationDefinitionVi||''):'';
     senses.push({senseNo:senses.length+1,pos:String(row.pos||''),
       definitionKo,translationVi,definitionVi,
       translationSource:translationVi||definitionVi?'krdict_official':'none',
       homonym:String(row.supNo||'0'),targetCode:code});
   }
 }
 if(!senses.length)return null;
 return {status:'found',headword:word,
   targetCode:String(exact[0].targetCode||'')||null,
   pronunciation:String(exact[0].pronunciation||'')||null,
   senses:senses.slice(0,30),
   source:'kgrow_official_bridge',isOfficial:true,
   sourceUrl:'https://krdict.korean.go.kr/',
   attribution:OFFICIAL+' (K-GROW의 공식 API 경유)',
   warnings:['fallback-to-corporate-k-grow-krdict-proxy']};
}

export async function viaKGrow(word,lang,{fetchImpl=fetch}={}){
 if(!HEADWORD.test(word)||!['ko','vi','en','ja','zh'].includes(lang))return null;
 const url=K_GROW+'/.netlify/functions/krdict-search?'+new URLSearchParams({q:word});
 try{
   const response=await fetchImpl(url,{headers:{accept:'application/json'},
     signal:AbortSignal.timeout(6500)});
   if(!response.ok)return null;
   const data=await response.json();
   return mapKGrowSearch(data,word,lang);
 }catch{return null;}
}
