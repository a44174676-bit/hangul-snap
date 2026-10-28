/**
 * Stage 2: ONLY after user confirms a word, fetch the official Korean Basic Dictionary.
 * Stage 1's local candidate index lives in dictionary-index.mjs / compose.mjs.
 * Unknown in our tiny index does not mean missing from the official dictionary.
 * The handler never invents official translations or serves cached personal images.
 */
import {EXAMPLES} from '../../site/js/jamo-data.js';
import {localEntry} from './local-dictionary.mjs';
const BASE='https://krdict.korean.go.kr';
const ATTRIBUTION='국립국어원 한국어기초사전';
const send=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const env=k=>globalThis.Netlify?.env?.get(k)||process.env[k];
const empty=(headword,status,reason='')=>({status,headword,targetCode:null,pronunciation:null,senses:[],sourceUrl:null,attribution:ATTRIBUTION,reason});
const sections=(xml,name)=>[...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'gi'))].map(m=>m[1]);
function decode(value) {
  return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&#(x[0-9a-f]+|\d+);/gi,(all,raw)=>{
      const number=raw[0].toLowerCase()==='x'?parseInt(raw.slice(1),16):parseInt(raw,10);
      return number>0&&number<=0x10ffff&&!(number>=0xd800&&number<=0xdfff)?String.fromCodePoint(number):all;
    }).replace(/&(amp|lt|gt|quot|apos);/g,(_,x)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x])).trim();
}
const tag=(xml,name)=>decode(sections(xml,name)[0]||'');
const safeLink=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='krdict.korean.go.kr'?url.href:null;}catch{return null;}};
const isErrorXml=xml=>/<error(?:\s|>)/i.test(xml);
const validXml=xml=>/<channel(?:\s|>)/i.test(xml)&&/<\/channel>/i.test(xml);
const sensesInSearch=(item,pos)=>sections(item,'sense').map((xml,i)=>{
  const translation=sections(xml,'translation')[0]||'';
  const translationVi=tag(translation,'trans_word'),definitionVi=tag(translation,'trans_dfn');
  return {senseNo:Number(tag(xml,'sense_order'))||i+1,pos,
    definitionKo:tag(xml,'definition'),translationVi,definitionVi,
    translationSource:translationVi||definitionVi?'krdict_official':'none'};
}).filter(s=>s.definitionKo);

/** Search gives full multilingual senses; preserve homonyms instead of silently choosing one. */
export function parseSearch(xml,word) {
  if (isErrorXml(xml)||!validXml(xml)) return empty(word,'error','upstream-xml-error');
  const matches=sections(xml,'item').filter(x=>tag(x,'word').normalize('NFC')===word);
  if (!matches.length) return empty(word,'not_found');
  const senses=[];
  for (const item of matches) {
    const pos=tag(item,'pos');
    const homonym=tag(item,'sup_no')||'0';
    const code=tag(item,'target_code');
    for (const sense of sensesInSearch(item,pos)) {
      senses.push({...sense,senseNo:senses.length+1, homonym, targetCode:code});
    }
  }
  const first=matches[0];
  return {status:'found',headword:word,targetCode:tag(first,'target_code')||null,
    pronunciation:tag(first,'pronunciation')||null,senses:senses.slice(0,30),
    sourceUrl:safeLink(tag(first,'link'))||BASE,attribution:ATTRIBUTION};
}

/**
 * Official /api/view XML nests meanings in word_info/sense_info, not in search's sense.
 * Do not lose multilingual translations returned by search when the view has none.
 */
export function parseDetail(xml,word,fallback) {
  if (isErrorXml(xml)||!validXml(xml)) return fallback;
  const item=sections(xml,'item')[0];if(!item)return fallback;
  const info=sections(item,'word_info')[0]||item;
  const pos=tag(info,'pos');
  const senseBlocks=sections(info,'sense_info').length?sections(info,'sense_info'):sections(info,'sense');
  const detail=senseBlocks.map((block,i)=>({
    senseNo:i+1,pos,definitionKo:tag(block,'definition')
  })).filter(s=>s.definitionKo);
  if(!detail.length)return fallback;
  const code=tag(item,'target_code')||fallback.targetCode;
  const existing=fallback.senses||[];
  const next=[];
  for (let i=0;i<detail.length;i++) {
    const d=detail[i];
    // Prefer exact definition matching; view/search definitions may vary slightly.
    // For the same target_code, ordinal matching is a conservative fallback.
    const existingSense=existing.find(s=>s.definitionKo===d.definitionKo && (s.targetCode===code||!s.targetCode))
      || existing.filter(s=>s.targetCode===code||!s.targetCode)[i];
    next.push({...d,
      targetCode:code,homonym:existingSense?.homonym||'0',
      translationVi:existingSense?.translationVi||'',definitionVi:existingSense?.definitionVi||'',
      translationSource:existingSense?.translationSource||'none'});
  }
  // Keep other homonyms and alternate definitions found in the search result.
  for (const old of existing) if (!next.some(s=>s.definitionKo===old.definitionKo&&s.targetCode===old.targetCode)) next.push(old);
  return {...fallback,
    pronunciation:tag(info,'pronunciation')||fallback.pronunciation,
    senses:next.map((s,i)=>({...s,senseNo:i+1})),
    sourceUrl:safeLink(tag(item,'link'))||fallback.sourceUrl};
}

function optionalEditorialFallback(word) {
  const e=EXAMPLES[word];
  return e?{source:'editorial_example',isOfficial:false,definitionKo:e.meaningKo,
    translationVi:e.meaningVi,pos:e.pos}:null;
}
const failure=(word,reason,httpStatus=502)=>send({...empty(word,'error',reason),
  fallbackExample:optionalEditorialFallback(word)},httpStatus);

async function loadOfficial(url,timeout) {
  const response=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/xml,text/xml'}});
  if(!response.ok)throw Error('api-http-error');
  const xml=await response.text();
  if(xml.length>700000)throw Error('api-response-oversize');
  return xml;
}

export default async function handler(request) {
  if(request.method!=='GET')return send({status:'method-not-allowed'},405);
  const p=new URL(request.url).searchParams;
  const word=(p.get('word')||'').normalize('NFC').trim();
  const lang=p.get('lang')||'vi';
  if(!/^[가-힣]{1,25}$/.test(word)||!['vi','ko'].includes(lang))return send(empty(word,'error','invalid-word'),400);
  const key=env('KRDICT_API_KEY');
  if(!key)return send(localEntry(word,lang,'unconfigured') || {...empty(word,'error','unconfigured'),fallbackExample:null},localEntry(word,lang)?200:503);
  // exact word matching prevents accidental partial-word substitution
  const search=new URLSearchParams({key,q:word,method:'exact',part:'word',num:'20',translated:'y',trans_lang:'7'});
  try {
    const xml=await loadOfficial(`${BASE}/api/search?${search}`,9000);
    const found=parseSearch(xml,word);
    if(found.status==='error')return send(localEntry(word,lang,'api-error') || {...empty(word,'error',found.reason),fallbackExample:null},localEntry(word,lang)?200:502);
    if(found.status==='not_found')return send(localEntry(word,lang,'not-in-official-search')||found,200); // this is a confirmed query result, not a network error
    if(found.targetCode){
      const detail=new URLSearchParams({key,method:'target_code',q:found.targetCode,translated:'y',trans_lang:'7'});
      try {
        const content=await loadOfficial(`${BASE}/api/view?${detail}`,7000);
        return send(parseDetail(content,word,found));
      }catch {return send({...found,warnings:['detail-unavailable-using-official-search-result']});}
    }
    return send(found);
  } catch(err) {
    const reason=err?.name==='TimeoutError'?'api-timeout':'network-or-upstream-error';
    const local=localEntry(word,lang,reason);
    return local?send(local):failure(word,reason,502);
  }
}
