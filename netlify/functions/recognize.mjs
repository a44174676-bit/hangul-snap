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
  const raw = payload?.output?.flatMap(item=>Array.isArray(item?.content)?item.content:[])
    .filter(part=>part?.type==='output_text'&&typeof part.text==='string')
    .map(part=>part.text).join('\n') || payload?.output_text || '';
  try { return JSON.parse(String(raw).trim()); } catch { return null; }
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
  type:'object',additionalProperties:false,
  properties:{
    objects:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      bbox:{type:'array',items:{type:'number'}},
      topK:{type:'array',items:{type:'object',additionalProperties:false,properties:{
        jamo:{type:'string',enum:JAMO},confidence:{type:'number'}
      },required:['jamo','confidence']}}
    },required:['bbox','topK']}},
    warnings:{type:'array',items:{type:'string'}}
  },required:['objects','warnings']
};

const prompt = `You are a visual detector for the large Hangul-jamo-shaped learning pieces shown in the two central work wells of a Hangul learning tray. Detect these target glyphs whether they are real eomuk, a photograph, a printed illustration, or displayed on a screen.
The tray has two side-by-side work wells, each showing large orange/golden jamo examples for initial consonant and vowel positions, plus a lower final-consonant position. Camera angle, perspective, glare, moiré, and framing may vary. Find the tray first, then inspect the work wells.
Detect EACH separate large orange/golden jamo-shaped glyph inside the work wells. The target can be flat artwork or a real raised food piece; do not require food texture, shadows, or depth. Draw one tight bbox around each glyph itself, not around the whole well.
Ignore small printed labels, Hangul instructions, captions, numbers, dashed slot outlines, QR codes, icons, mascots, logos, decorative food outside the work wells, and text elsewhere on a monitor or package. The target glyphs are the largest orange/golden letter-shaped forms in the wells, not the small explanatory text.
Return each glyph individually; never merge adjacent jamo into a syllable or word. Only these 14 jamo labels may appear: ${JAMO.join(' ')}.
Each item MUST be {"bbox":[x,y,width,height],"topK":[{"jamo":"ㄱ","confidence":0.75}]}.
The bbox is [LEFT,TOP,WIDTH,HEIGHT], relative to the ORIGINAL image, normalized 0..1000.
Confidence is an UNCALIBRATED relative guess, not a measured probability. Return up to 3 distinct alternatives sorted descending. If orientation or identity is unclear, express that uncertainty in topK rather than omitting a clearly visible target.
Return at most 18 target glyphs in image reading order. No word predictions, dictionary corrections, OCR-string answer, or commentary.
JSON only: {"objects":[{"bbox":[120,150,190,250],"topK":[{"jamo":"ㄱ","confidence":0.6},{"jamo":"ㄴ","confidence":0.3}]}],"warnings":[]}.`;


/**
 * Printed Hangul OCR is a separate exploratory mode and is NEVER represented
 * as spatial detections of physical snack pieces. User confirmation required.
 */
const PRINTED_SCHEMA={type:'object',additionalProperties:false,properties:{
 text:{type:'string'},
 confidence:{type:'number'},
 warnings:{type:'array',items:{type:'string'}}
},required:['text','confidence','warnings']};
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
  if (!key) return send({status:'unconfigured',objects:[],warnings:['openai-key-missing']},503);
  if (!/^application\\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return send({status:'bad-content-type'},415);
  const raw = await request.text();
  if (raw.length > 3_700_000) return send({status:'too-large'},413);
  let req;
  try { req = JSON.parse(raw); } catch { return send({status:'invalid-json'},400); }
  if (!['single','word'].includes(req?.mode) || req?.setId !== 'basic14') return send({status:'invalid-mode-or-set'},400);
  const target=req.target==='printed' && req.mode==='word'?'printed':'pieces';
  const matched = /^data:(image\\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.image || '');
  if (!matched || matched[2].length > 3_500_000) return send({status:'invalid-image'},400);
  const models=[...new Set([env('OPENAI_MODEL')||'gpt-4.1-mini',env('OPENAI_FALLBACK_MODEL')||'gpt-4o-mini'].filter(Boolean))];
  const schema=target==='printed'?PRINTED_SCHEMA:RESPONSE_SCHEMA;
  const inputText=target==='printed'?PRINTED_PROMPT:prompt;
  const input=[{role:'user',content:[
    {type:'input_text',text:inputText},
    {type:'input_image',image_url:'data:'+matched[1]+';base64,'+matched[2],detail:'high'}
  ]}];
  let diagnostic='provider-error';
  for(const model of models){
    for(let attempt=0;attempt<2;attempt++){
      let response;
      try{
        response=await fetch('https://api.openai.com/v1/responses',{
          method:'POST',
          headers:{authorization:'Bearer '+key,'content-type':'application/json'},
          body:JSON.stringify({
            model,input,max_output_tokens:1800,
            text:{format:{type:'json_schema',name:target==='printed'?'printed_hangul_text':'hangul_jamo_detections',strict:true,schema}}
          }),
          signal:AbortSignal.timeout(12000)
        });
      }catch(error){
        console.warn('[OpenAI]',{model,attempt,reason:error?.name||'network-error'});
        diagnostic=error?.name==='TimeoutError'?'provider-timeout':'provider-network-error';
        if(attempt===0){await new Promise(resolve=>setTimeout(resolve,700));continue;}
        break;
      }
      if(response.ok){
        const decoded=parseModelJson(await response.json());
        if(target==='printed'){
          const printed=validatePrintedText(decoded);
          if(!printed)return send({status:'invalid-model-output',objects:[],warnings:['invalid-printed-text-response']},502);
          return send({...printed,model});
        }
        const parsed=validateDetections(decoded,req.mode);
        if(!parsed.ok)return send({status:'invalid-model-output',objects:[],warnings:parsed.warnings},502);
        return send({status:parsed.objects.length?'ok':'no-objects',recognitionType:'physical-jamo',objects:parsed.objects,warnings:[...parsed.warnings,'uncalibrated-ai-scores-user-confirmation-required'],model});
      }
      const err=await response.json().catch(()=>({}));
      const explanation=String(err?.error?.message||'');
      const transient=[408,429,500,502,503,504].includes(response.status);
      console.warn('[OpenAI]',{model,attempt,httpStatus:response.status,reason:explanation.slice(0,240)});
      diagnostic=response.status===400?'provider-invalid-request':
        response.status===404?'model-unavailable':
        response.status===429?'rate-limited':
        response.status===401||response.status===403?'auth-or-model-access':
        transient?'provider-http-'+response.status:'provider-error';
      if(transient && attempt===0){
        await new Promise(resolve=>setTimeout(resolve,900));
        continue;
      }
      if(response.status===401||response.status===403) return send({status:diagnostic,objects:[],warnings:['openai-auth-error']},502);
      break;
    }
  }
  return send({status:diagnostic,objects:[],warnings:['openai-upstream-error']},502);
}
