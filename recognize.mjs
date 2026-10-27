// HANGUL SNAP V1 — diagnostics and strict physical-jamo recognition.
const JAMO=new Set(['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ']);
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const env=k=>globalThis.Netlify?.env?.get(k)||process.env[k];
export function providerStatus(code){
 if(code===400)return 'provider-invalid-request';
 if(code===401||code===403)return 'provider-auth-error';
 if(code===404)return 'model-unavailable';
 if(code===429)return 'provider-rate-limited';
 if(code>=500)return 'provider-unavailable';
 return 'provider-error';
}
export function validateObjects(payload){
 if(!payload||!Array.isArray(payload.objects))return null;
 const results=[];
 for(const item of payload.objects.slice(0,16)){
  const b=item?.bbox;
  if(!Array.isArray(b)||b.length!==4||b.some(n=>typeof n!=='number'||!Number.isFinite(n)))continue;
  const [x,y,w,h]=b;
  if(x<0||y<0||w<=0||h<=0||x+w>1000||y+h>1000)continue;
  if(!Array.isArray(item.topK))continue;
  const seen=new Set();
  const topK=item.topK.filter(v=>{
   if(!JAMO.has(v?.jamo)||typeof v.confidence!=='number'||!Number.isFinite(v.confidence)||v.confidence<0||v.confidence>1||seen.has(v.jamo))return false;
   seen.add(v.jamo);return true;
  }).sort((a,b)=>b.confidence-a.confidence).slice(0,3);
  if(topK.length)results.push({bbox:b,topK});
 }
 return results;
}
const SCHEMA={type:'OBJECT',properties:{objects:{type:'ARRAY',items:{type:'OBJECT',properties:{bbox:{type:'ARRAY',items:{type:'NUMBER'}},topK:{type:'ARRAY',items:{type:'OBJECT',properties:{jamo:{type:'STRING',enum:[...JAMO]},confidence:{type:'NUMBER'}},required:['jamo','confidence']}}},required:['bbox','topK']}}},required:['objects']};
const PROMPT="Recognize each visually isolated Hangul consonant/vowel SHAPE in the photo. This is a prototype for physical alphabet-shaped snacks; test photos MAY instead show paper cutouts or a single large glyph illustration on a monitor. Prefer the main prominent shape in a single-piece photo (e.g. a large red ring is ㅇ; a square with an interior hole is ㅁ). Ignore surrounding text captions, watermarks and branding. In word mode find separate physical character pieces, not a whole word, and do not segment strokes within the same piece. Classes ONLY: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ. Output JSON object with objects array. Each item must have bbox array [left,top,width,height] coordinates normalized 0 to 1000 relative to the image and topK array of up to three objects {jamo:string,confidence:number 0..1} sorted by confidence. These confidences are estimates, not calibrated probabilities. Do not invent unseen glyphs. For uncertain cases return candidate choices or empty array; no explanations, no markdown.";
export default async function handler(request){
 if(request.method!=='POST')return json({status:'method-not-allowed'},405);
 const key=env('GEMINI_API_KEY');
 if(!key)return json({status:'unconfigured',service:'vision'},503);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return json({status:'bad-request'},415);
 let raw;try{raw=await request.text();}catch{return json({status:'bad-request'},400);}
 if(raw.length>3700000)return json({status:'too-large'},413);
 let body;try{body=JSON.parse(raw);}catch{return json({status:'bad-request'},400);}
 if(!['single','word'].includes(body.mode))return json({status:'bad-request'},400);
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image||'');
 if(!match||match[2].length>3500000)return json({status:'bad-image'},400);
 const model=env('GEMINI_MODEL')||'gemini-3.8-flash';
 try{
  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  const contents=[{parts:[{text:PROMPT},{inline_data:{mime_type:match[1],data:match[2]}}]}];
  const call=async(fullSchema)=>fetch(endpoint,{
   method:'POST',
   headers:{'content-type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({contents,generationConfig:fullSchema?{responseMimeType:'application/json',responseSchema:SCHEMA}:{responseMimeType:'application/json'}}),
   signal:AbortSignal.timeout(fullSchema?16000:17000)
  });
  let r=await call(true);
  if(r.status===400){
   // A subset of generationConfig.responseSchema is accepted by different
   // Gemini endpoints. Retry *only* malformed structured-output requests.
   const body=await r.json().catch(()=>({}));
   const msg=String(body?.error?.message||'');
   const schemaError=/schema|generation_config|generationConfig|structured|Invalid JSON payload|responseMimeType|response_format/i.test(msg);
   console.warn('[hangul-snap vision] first request HTTP 400',{model,schemaError,providerMessage:msg.slice(0,500)});
   if(schemaError)r=await call(false);
   else return json({status:'provider-invalid-request',hint:'request-rejected'},502);
  }
  if(!r.ok){
   const reason=providerStatus(r.status);
   const response=await r.json().catch(()=>({}));
   const providerMessage=String(response?.error?.message||'');
   console.warn('[hangul-snap vision] provider HTTP failure',{http:r.status,model,reason,providerMessage:providerMessage.slice(0,500)});
   return json({status:reason},502);
  }
  let data;try{data=await r.json();}catch{return json({status:'provider-invalid-response'},502);}
  const responseText=data.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string').map(p=>p.text).join('\n');
  let parsed;try{parsed=JSON.parse(responseText||'');}catch{return json({status:'invalid-model-output'},502);}
  const objects=validateObjects(parsed);
  if(objects===null)return json({status:'invalid-model-output'},502);
  if(!objects.length)return json({status:'no-objects',objects:[]},200);
  return json({status:'ok',objects,requiresConfirmation:true});
 }catch(error){
  const reason=['TimeoutError','AbortError'].includes(error?.name)?'provider-timeout':'provider-network-error';
  console.warn('[hangul-snap vision]',{reason});
  return json({status:reason},502);
 }
}