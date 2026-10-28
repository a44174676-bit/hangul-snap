/**
 * Gemini Vision adapter — the model is a proposal generator, NOT a calibrated object detector.
 * Every returned object has verified bbox geometry, a derived center, and an explicit topK.
 * It never returns a model-generated completed word as a detection result.
 */
const JAMO = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ'];
const VALID = new Set(JAMO);
const send = (data, status = 200) => Response.json(data, {
  status, headers: {'cache-control':'no-store','x-content-type-options':'nosniff'}
});
const env = key => globalThis.Netlify?.env?.get(key) || process.env[key];
const isFinite01 = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;

export function parseModelJson(payload) {
  const raw = payload?.candidates?.[0]?.content?.parts?.filter(p => typeof p?.text === 'string').map(p => p.text).join('\n') || '';
  const content = raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try { return JSON.parse(content); } catch { return null; }
}

/** Fail closed on invalid geometry, impossible confidences, duplicate labels or IDs. */
export function validateDetections(data, mode) {
  if (!data || !Array.isArray(data.objects) || data.objects.length > 18) {
    return {ok:false, objects:[], warnings:['invalid-object-list']};
  }
  const objects = []; const seen = new Set(); const warnings = [];
  for (let i = 0; i < data.objects.length; i++) {
    const item = data.objects[i];
    const box = item?.bbox;
    if (!Array.isArray(box) || box.length !== 4 || !box.every(v => typeof v === 'number' && Number.isFinite(v))) {
      return {ok:false, objects:[], warnings:['invalid-bbox']};
    }
    const [x,y,w,h] = box;
    if (x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > 1000 || y+h > 1000) {
      return {ok:false, objects:[], warnings:['bbox-out-of-range']};
    }
    if (!Array.isArray(item.topK) || item.topK.length < 1 || item.topK.length > 3) {
      return {ok:false, objects:[], warnings:['invalid-top-k']};
    }
    const labels = new Set();
    const topK = [];
    for (const label of item.topK) {
      if (!VALID.has(label?.jamo) || !isFinite01(label.confidence) || labels.has(label.jamo)) {
        return {ok:false, objects:[], warnings:['invalid-jamo-confidence']};
      }
      labels.add(label.jamo);
      topK.push({jamo:label.jamo, confidence:label.confidence});
    }
    topK.sort((a,b) => b.confidence - a.confidence);
    const id = `obj-${i+1}`; // avoid untrusted IDs and duplicates
    if (seen.has(id)) return {ok:false, objects:[], warnings:['duplicate-id']};
    seen.add(id);
    objects.push({id, bbox:[x,y,w,h], center:[x+w/2,y+h/2], topK});
  }
  if (mode === 'single' && objects.length > 1) warnings.push('multiple-objects-in-single-mode');
  if (mode === 'word' && objects.length === 1) warnings.push('one-jamo-only-cannot-form-word');
  if (objects.length === 0) warnings.push('no-objects-detected');
  return {ok:true,objects,warnings};
}


const RESPONSE_SCHEMA = {
  type:'OBJECT',
  properties:{
    objects:{type:'ARRAY',items:{type:'OBJECT',properties:{
      bbox:{type:'ARRAY',items:{type:'NUMBER'}},
      topK:{type:'ARRAY',items:{type:'OBJECT',properties:{
        jamo:{type:'STRING',enum:JAMO}, confidence:{type:'NUMBER'}
      },required:['jamo','confidence']}}
    },required:['bbox','topK']}},
    warnings:{type:'ARRAY',items:{type:'STRING'}}
  },required:['objects','warnings']
};

const prompt = `You are an object detector for a physical Hangul-jamo educational kit, NOT a text recognizer.
Find EACH SEPARATE VISIBLE PHYSICAL piece individually. Never return an entire word or a composed syllable as one box.
Only these 14 jamo labels may appear: ${JAMO.join(' ')}.
Each item MUST be {"bbox":[x,y,width,height],"topK":[{"jamo":"ㄱ","confidence":0.75}]}.
The bbox is [LEFT,TOP,WIDTH,HEIGHT], relative to the ORIGINAL image, normalized 0..1000.
Confidence is an UNCALIBRATED relative guess: never claim it is a measured probability. Return up to 3 distinct alternatives sorted descending.
Do not invent obscured pieces. If the photographed TOP direction is unclear, reflect the uncertainty between rotated glyphs in topK.
Return at most 18 physical items, in image reading order. No word predictions, no dictionary corrections, no OCR-string answer, no commentary.
JSON only: {"objects":[{"bbox":[120,150,190,250],"topK":[{"jamo":"ㄱ","confidence":0.6},{"jamo":"ㄴ","confidence":0.3}]}],"warnings":[]}.`;

export default async function handler(request) {
  if (request.method !== 'POST') return send({status:'method-not-allowed'},405);
  const key = env('GEMINI_API_KEY');
  if (!key) return send({status:'unconfigured',objects:[],warnings:['vision-key-missing']},503);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return send({status:'bad-content-type'},415);
  const raw = await request.text();
  if (raw.length > 3_700_000) return send({status:'too-large'},413);
  let req;
  try { req = JSON.parse(raw); } catch { return send({status:'invalid-json'},400); }
  if (!['single','word'].includes(req?.mode) || req?.setId !== 'basic14') return send({status:'invalid-mode-or-set'},400);
  const matched = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.image || '');
  if (!matched || matched[2].length > 3_500_000) return send({status:'invalid-image'},400);
  const primary = env('GEMINI_MODEL') || 'gemini-2.5-flash';
  // 2.0 Flash was shut down June 1 2026; use live 3.8 as fallback.
  const alternate = env('GEMINI_FALLBACK_MODEL') || 'gemini-3.8-flash';
  const models = [...new Set([primary,alternate].filter(Boolean))];
  const contents = [{parts:[{text:prompt},{inline_data:{mime_type:matched[1],data:matched[2]}}]}];
  let diagnostic = 'provider-error';
  for(const model of models){
    for(const withSchema of [true,false]){
      try {
        const body={contents,generationConfig:withSchema?
          {responseMimeType:'application/json',responseSchema:RESPONSE_SCHEMA}:
          {responseMimeType:'application/json'}};
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},
          body:JSON.stringify(body),signal:AbortSignal.timeout(18000)
        });
        if(response.ok){
          const parsed=validateDetections(parseModelJson(await response.json()),req.mode);
          if (!parsed.ok) return send({status:'invalid-model-output',objects:[],warnings:parsed.warnings},502);
          return send({status:'ok',objects:parsed.objects,warnings:[...parsed.warnings,'uncalibrated-ai-scores-user-confirmation-required'],model});
        }
        const err=await response.json().catch(()=>({}));
        const explanation=String(err?.error?.message||'');
        console.warn('[Gemini]',{model,httpStatus:response.status,schema:withSchema,reason:explanation.slice(0,300)});
        diagnostic=response.status===400?'provider-invalid-request':response.status===404?'model-unavailable':response.status===429?'rate-limited':response.status===401||response.status===403?'auth-or-model-access':'provider-error';
        // HTTP400: Retry JSON-only mode when responseSchema syntax is rejected.
        if(response.status===400 && withSchema && /schema|generation.?config|responseMimeType|response.?format|JSON payload/i.test(explanation))continue;
        // Missing or access-restricted model -> try next supported model, never deprecated 2.0.
        if([403,404].includes(response.status))break;
        return send({status:diagnostic,objects:[],warnings:['gemini-upstream-error']},502);
      } catch(error){
        console.warn('[Gemini]',{model,reason:error?.name||'network-error'});
        diagnostic=error?.name==='TimeoutError'?'provider-timeout':'provider-network-error';
        break;
      }
    }
  }
  return send({status:diagnostic,objects:[],warnings:['gemini-upstream-error']},502);
}
