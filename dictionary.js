import {EXAMPLE_WORDS} from './data.js';
export function localExample(word){const e=EXAMPLE_WORDS[word];return e?{word,pronunciation:null,source:'editorial-example',senses:[{pos:e.pos,definitionKo:e.ko,translation:e.vi,definitionVi:''}]}:null;}
export async function lookupDictionary(word,lang='vi'){
 const query=new URLSearchParams({word,lang});let resp;
 try{resp=await fetch(`/.netlify/functions/dictionary?${query}`,{cache:'no-store',headers:{Accept:'application/json'}});}catch(e){return {status:'network-error',example:localExample(word)};}
 let data;try{data=await resp.json();}catch{data=null;}
 if(resp.ok&&data?.status==='ok')return {status:'ok',data};
 if(data?.status==='not-found')return {status:'not-found',example:localExample(word)};
 if(data?.status==='unconfigured')return {status:'unconfigured',example:localExample(word)};
 return {status:'network-error',example:localExample(word)};
}
