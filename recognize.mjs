// Optional Gemini-powered visual recognition. Requires a project API key; results are suggestions only.
const VALID_JAMO=new Set(['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ']);
const makeResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function validate(obj){if(!obj||!Array.isArray(obj.objects))return [];
 return obj.objects.slice(0,20).map(v=>{
 const bbox=(Array.isArray(v.bbox)?v.bbox:[0,0,200,200]).slice(0,4).map(n=>Math.max(0,Math.min(1000,Number(n)||0)));
 const topK=(Array.isArray(v.topK)?v.topK:[]).filter(x=>x&&VALID_JAMO.has(x.jamo)&&Number.isFinite(Number(x.confidence))).slice(0,3).map(x=>({jamo:x.jamo,confidence:Math.max(0,Math.min(1,Number(x.confidence)))}));
 return {bbox,topK};}).filter(x=>x.topK.length);}
export default async function handler(request){
 if(request.method!=='POST')return makeResponse({status:'method-not-allowed'},405);
 const key=globalThis.Netlify?.env?.get('GEMINI_API_KEY')||process.env.GEMINI_API_KEY;
 if(!key)return makeResponse({status:'unconfigured',service:'vision'},503);
 const type=request.headers.get('content-type')||'';if(!type.startsWith('application/json'))return makeResponse({status:'bad-request'},415);
 const text=await request.text();if(text.length>3700000)return makeResponse({status:'too-large'},413);
 let payload;try{payload=JSON.parse(text)}catch{return makeResponse({status:'bad-request'},400)}
 if(payload.mode!=='word'&&payload.mode!=='single')return makeResponse({status:'bad-request'},400);
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(payload.image||'');if(!match||match[2].length>3500000)return makeResponse({status:'bad-image'},400);
 const mime=match[1],b64=match[2];
 const instruction=`You are an image recognizer, NOT a tutor. Find separate physical Hangul consonant/vowel objects in the image (snack pieces or paper mockups). Supported classes ONLY: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ. Detect visible objects, including ambiguity from rotation or damage. For each detected object provide bbox [x,y,width,height] scaled 0..1000 relative to image and up to 3 class candidates with estimated confidence 0..1. Never invent pieces not visible. If not visually recognizable return []. Do not read printed instructions or QR codes as Jamo pieces. Mode: ${payload.mode}. Output JSON matching schema. `;
 const schema={type:'OBJECT',properties:{objects:{type:'ARRAY',items:{type:'OBJECT',properties:{bbox:{type:'ARRAY',items:{type:'NUMBER'}},topK:{type:'ARRAY',items:{type:'OBJECT',properties:{jamo:{type:'STRING'},confidence:{type:'NUMBER'}},required:['jamo','confidence']}}},required:['bbox','topK']}}},required:['objects']};
 const model=globalThis.Netlify?.env?.get('GEMINI_MODEL')||process.env.GEMINI_MODEL||'gemini-3.8-flash';
 const api=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
 try{const r=await fetch(api,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(22000),body:JSON.stringify({contents:[{role:'user',parts:[{text:instruction},{inline_data:{mime_type:mime,data:b64}}]}],generationConfig:{temperature:0.1,responseMimeType:'application/json',responseSchema:schema}})});if(!r.ok)return makeResponse({status:'upstream-error',service:'vision'},502);const answer=await r.json();const raw=answer.candidates?.[0]?.content?.parts?.find(p=>p.text)?.text||'{}';let parsed;try{parsed=JSON.parse(raw)}catch{return makeResponse({status:'invalid-model-output'},502)}return makeResponse({status:'ok',objects:validate(parsed),model,requiresConfirmation:true});}catch{return makeResponse({status:'upstream-error',service:'vision'},502)}
}
