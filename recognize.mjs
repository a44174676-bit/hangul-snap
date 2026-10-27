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
const PROMPT="Identify individual physical Korean Hangul consonant and vowel shape pieces, including snacks, cardboard and paper cutouts, not text printed on surfaces. Classes: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ. Return one object per *separate physical piece*, never a whole word. Each object has bounding box [left,top,width,height] normalized 0..1000 and up to 3 candidate jamo with estimated confidence 0..1. Hollow square/ring with four sides and central hole resembles ㅁ. Rotated shapes can be ambiguous; be uncertain rather than inventing. Ignore QR codes and printed letters. Output JSON schema only.";
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
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
   method:'POST',
   headers:{'content-type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({contents:[{parts:[{text:PROMPT},{inline_data:{mime_type:match[1],data:match[2]}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema:SCHEMA}}),
   signal:AbortSignal.timeout(20000)
  });
  if(!r.ok){const code=providerStatus(r.status);console.warn('[hangul-snap vision]',{http:r.status,model,reason:code});return json({status:code},502);}
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