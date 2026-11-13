/**
 * OpenAI vision adapter — the model is a proposal generator, NOT a calibrated object detector.
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
  const responseText = payload?.choices?.[0]?.message?.content;
  if (typeof responseText === 'string') {
    const content = responseText.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try { return JSON.parse(content); } catch { return null; }
  }
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


const prompt = `You are a visual Hangul-jamo recognizer. Read clearly visible Hangul jamo shapes whether they are physical food pieces, paper cutouts, printed illustrations, or shown on a screen.
The pieces may be hot, glossy, slightly soft-edged, or give off steam. Do not reject a real food piece because of heat, gloss, or texture.
This learning tray has two large side-by-side work wells, each with positions for an initial consonant and vowel, plus a lower final-consonant position. Camera angle and framing may vary; follow the visible shapes and tray wells rather than fixed pixel coordinates.
Detect the prominent intended jamo shapes in the work wells. Ignore small tray labels, captions, instructions, QR codes, icons, logos, and decorative elements. If a composed Hangul syllable is shown as one clear shape in a well, return its constituent jamo only when they are visually separable; otherwise return the closest single visible jamo shape and do not invent others.
Find EACH SEPARATE VISIBLE jamo shape individually. Never return an entire word as one detection.
Only these 14 jamo labels may appear: ${JAMO.join(' ')}.
Each item MUST be {"bbox":[x,y,width,height],"topK":[{"jamo":"ㄱ","confidence":0.75}]}.
The bbox is [LEFT,TOP,WIDTH,HEIGHT], relative to the ORIGINAL image, normalized 0..1000.
Confidence is an UNCALIBRATED relative guess: never claim it is a measured probability. Return up to 3 distinct alternatives sorted descending.
Do not invent obscured pieces. If the photographed TOP direction is unclear, reflect the uncertainty between rotated glyphs in topK.
Return at most 18 physical items, in image reading order. No word predictions, no dictionary corrections, no OCR-string answer, no commentary.
JSON only: {"objects":[{"bbox":[120,150,190,250],"topK":[{"jamo":"ㄱ","confidence":0.6},{"jamo":"ㄴ","confidence":0.3}]}],"warnings":[]}.`;


/**
 * Printed Hangul OCR is a separate exploratory mode and is NEVER represented
 * as spatial detections of physical snack pieces. User confirmation required.
 */
const PRINTED_PROMPT=`Read only the single most prominent Korean Hangul word or syllable string in the photo, not the explanatory captions, instruction labels, numbers, or logos. This is a PREVIEW OCR mode for printed Korean words or words on a monitor; it is NOT detecting individual physical jamo snack pieces. Return a plain normalized NFC Korean word consisting exclusively of complete Hangul syllables (가 through 힣), 1-12 syllables long, or empty string if none. Do not silently change spelling to a dictionary word. Preserve EXACT printed spelling. confidence is an uncalibrated estimate from 0 to 1. Return JSON object: {"text":"보기","confidence":0.72,"warnings":[]}.`;
export function validatePrintedText(data){
 if(!data || typeof data.text!=='string' || !isFinite01(data.confidence))return null;
 const word=data.text.normalize('NFC').trim();
 if(word && !/^[가-힣]{1,12}$/.test(word))return null;
 return {status:word?'ok':'no-text',recognitionType:'printed-text',
   recognizedText:word,objects:[],warnings:['printed-text-mode-not-physical-jamo-detection','learner-confirmation-required'],
   confidence:data.confidence};
}

export default async function handler(request) {
  if (request.method !== 'POST') return send({status:'method-not-allowed'},405);
  const key = env('OPENAI_API_KEY');
  if (!key) return send({status:'unconfigured',objects:[],warnings:['vision-key-missing']},503);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return send({status:'bad-content-type'},415);
  const raw = await request.text();
  if (raw.length > 3_700_000) return send({status:'too-large'},413);
  let req;
  try { req = JSON.parse(raw); } catch { return send({status:'invalid-json'},400); }
  if (!['single','word'].includes(req?.mode) || req?.setId !== 'basic14') return send({status:'invalid-mode-or-set'},400);
  const target=req.target==='printed' && req.mode==='word'?'printed':'pieces';
  const matched = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.image || '');
  if (!matched || matched[2].length > 3_500_000) return send({status:'invalid-image'},400);
  const model = env('OPENAI_VISION_MODEL') || 'gpt-4.1-mini';
  const promptText = target==='printed' ? PRINTED_PROMPT : prompt;
  const jsonSchema = {
    name: target==='printed' ? 'printed_hangul' : 'jamo_detections',
    strict: true,
    schema: {
      type:'object', additionalProperties:false,
      properties: target==='printed' ? {
        text:{type:'string'}, confidence:{type:'number'}, warnings:{type:'array',items:{type:'string'}}
      } : {
        objects:{type:'array',items:{type:'object',additionalProperties:false,properties:{
          bbox:{type:'array',items:{type:'number'}},
          topK:{type:'array',items:{type:'object',additionalProperties:false,properties:{jamo:{type:'string',enum:JAMO},confidence:{type:'number'}},required:['jamo','confidence']}}
        },required:['bbox','topK']}},
        warnings:{type:'array',items:{type:'string'}}
      },
      required: target==='printed' ? ['text','confidence','warnings'] : ['objects','warnings']
    }
  };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},
      body:JSON.stringify({model,temperature:0,max_completion_tokens:1200,
        response_format:{type:'json_schema',json_schema},
        messages:[{role:'user',content:[
          {type:'text',text:promptText},
          {type:'image_url',image_url:{url:`data:${matched[1]};base64,${matched[2]}`,detail:'high'}}
        ]}]}),
      signal:AbortSignal.timeout(45000)
    });
    if(!response.ok){
      const err=await response.json().catch(()=>({}));
      const msg=String(err?.error?.message||'');
      console.warn('[OpenAI vision]',{httpStatus:response.status,reason:msg.slice(0,300)});
      const status=response.status===401||response.status===403?'provider-auth-error':response.status===429?'provider-rate-limited':response.status>=500?'provider-unavailable':response.status===400?'provider-invalid-request':'provider-error';
      return send({status,objects:[],warnings:['openai-upstream-error']},502);
    }
    const decoded=parseModelJson(await response.json());
    if(target==='printed'){
      const printed=validatePrintedText(decoded);
      if(!printed)return send({status:'invalid-model-output',objects:[],warnings:['invalid-printed-text-response']},502);
      return send({...printed,model});
    }
    const parsed=validateDetections(decoded,req.mode);
    if(!parsed.ok)return send({status:'invalid-model-output',objects:[],warnings:parsed.warnings},502);
    return send({status:parsed.objects.length?'ok':'no-objects',recognitionType:'jamo-shapes',objects:parsed.objects,warnings:[...parsed.warnings,'uncalibrated-ai-scores-user-confirmation-required'],model});
  } catch(error){
    const status=error?.name==='TimeoutError'?'provider-timeout':'provider-network-error';
    console.warn('[OpenAI vision]',{status});
    return send({status,objects:[],warnings:['openai-request-failed']},502);
  }
}
