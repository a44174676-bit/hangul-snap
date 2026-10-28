const env=k=>globalThis.Netlify?.env?.get(k)||process.env[k];
const LANG={vi:'Vietnamese',en:'English',ja:'Japanese',zh:'Simplified Chinese'};
export async function enrichTranslations(dict,word,lang,{fetchImpl=fetch,key=env('GEMINI_API_KEY')}={}){
 if(!dict||!['found','ok'].includes(dict.status)||!LANG[lang]||!Array.isArray(dict.senses))return dict;
 if(!dict.senses.some(s=>!s.translationVi&&!s.definitionVi)||!key)return dict;
 const senses=dict.senses;
 const input=senses.map((s,i)=>({n:i+1,definitionKo:String(s.definitionKo||'').slice(0,800)}));
 if(!input.length||input.length>30||input.some(x=>!x.definitionKo))return dict;
 const instruction='Translate the Korean dictionary headword and each independently numbered Korean sense into '+LANG[lang]+'. Do not mix meanings or change Korean definitions. Input headword: '+word+'. Numbered senses: '+JSON.stringify(input)+'. Output ONLY JSON with translations array of same length containing {n:number,word:string,definition:string}. Keep exact order. The translations are supplemental machine translations, NOT official dictionary translations.';
 try{
  const model=env('GEMINI_TRANSLATION_MODEL')||'gemini-2.5-flash';
  const response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
   method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({contents:[{parts:[{text:instruction}]}],generationConfig:{responseMimeType:'application/json',temperature:0.1}}),
   signal:AbortSignal.timeout(13000)
  });
  if(!response.ok)return dict;
  const data=await response.json();
  const raw=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
  const values=JSON.parse(raw).translations;
  if(!Array.isArray(values)||values.length!==senses.length||
    values.some((v,i)=>v.n!==i+1||typeof v.word!=='string'||typeof v.definition!=='string'||!v.definition.trim()||v.definition.length>1000))return dict;
  return {...dict,senses:senses.map((s,i)=>s.translationVi||s.definitionVi?s:{
    ...s,translationVi:values[i].word.slice(0,180),definitionVi:values[i].definition,
    translationSource:'machine_translation'
  }),warnings:[...(dict.warnings||[]),'machine-translation-must-be-reviewed']};
 }catch{return dict;}
}
