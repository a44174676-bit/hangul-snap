// Netlify Function: official Korean Basic Dictionary. Does not expose API credentials to browsers.
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const allowedLanguages={vi:'7',ko:'7',en:'1',ja:'2',zh:'11'};
const dec=text=>String(text||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[\da-f]+|\d+);/gi,(_,s)=>String.fromCodePoint(s[0].toLowerCase()==='x'?parseInt(s.slice(1),16):parseInt(s,10))).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[n])).trim();
const blocks=(xml,tag)=>Array.from(xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,'g')),m=>m[1]);
const tag=(xml,name)=>dec(blocks(xml,name)[0]||'');
export function parseDictionary(xml,word,language='vi'){
 if(/<error\b/.test(xml))return {status:'upstream-error'};
 const items=blocks(xml,'item');const match=items.find(s=>tag(s,'word')===word);
 if(!match)return {status:'not-found'};
 const senses=blocks(match,'sense').map(s=>{const translations=blocks(s,'translation');const preferred=translations.find(t=>tag(t,'trans_lang')===(language==='en'?'영어':language==='ja'?'일본어':language==='zh'?'중국어':'베트남어'))||translations[0]||'';return {pos:tag(match,'pos'),definitionKo:tag(s,'definition'),translation:tag(preferred,'trans_word'),definitionVi:tag(preferred,'trans_dfn')};}).filter(s=>s.definitionKo).slice(0,5);
 if(!senses.length)return {status:'not-found'};
 return {status:'ok',word,pronunciation:tag(match,'pronunciation'),targetCode:tag(match,'target_code'),senses,source:'krdict'};
}
export default async function handler(request){
 if(request.method!=='GET')return response({status:'method-not-allowed'},405);
 const url=new URL(request.url);const word=(url.searchParams.get('word')||'').normalize('NFC').trim();const language=Object.prototype.hasOwnProperty.call(allowedLanguages,url.searchParams.get('lang'))?url.searchParams.get('lang'):'vi';
 if(!word||word.length>25||!(/^[가-힣]+$/u.test(word)))return response({status:'invalid-word'},400);
 const key=globalThis.Netlify?.env?.get('KRDICT_API_KEY')||process.env.KRDICT_API_KEY;
 if(!key)return response({status:'unconfigured',service:'dictionary'},503);
 const args=new URLSearchParams({key,q:word,translated:'y',trans_lang:allowedLanguages[language],num:'10'});
 try{const r=await fetch(`https://krdict.korean.go.kr/api/search?${args}`,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/xml'}});if(!r.ok)return response({status:'upstream-error'},502);const xml=await r.text();if(xml.length>600000)return response({status:'upstream-error'},502);const result=parseDictionary(xml,word,language);return response(result,result.status==='upstream-error'?502:200);}catch{return response({status:'upstream-error'},502)}
}
