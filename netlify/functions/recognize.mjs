/**
 * OpenAI vision adapter — the model is a proposal generator, NOT a calibrated object detector.
 * Every returned object has verified bbox geometry, a derived center, and an explicit topK.
 * It never returns a model-generated completed word as a detection result.
 */
import {JAMO} from '../../site/js/jamo-data.js';
import {ALL_JAMO} from '../../site/js/jamo-letters.js';

const labelsForMode = mode => mode==='word' ? ALL_JAMO : JAMO;
const send = (data, status = 200) => Response.json(data, {
  status, headers: {'cache-control':'no-store','x-content-type-options':'nosniff'}
});
const env = key => globalThis.Netlify?.env?.get(key) || process.env[key];
const isFinite01 = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const DEFAULT_MODEL = 'gpt-4.1-mini';
const FALLBACK_MODEL = 'gpt-6-luna';
const BILLING_ERRORS = new Set(['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded',
  'project_spend_limit_exceeded','organization_usage_limit_exceeded','billing_hard_limit_reached']);

export const config = {
  path:'/api/recognize',
  rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}
};

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
  const allowedLabels = labelsForMode(mode);
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
      if (!allowedLabels.includes(label?.jamo) || !isFinite01(label.confidence) || labels.has(label.jamo)) {
        return {ok:false, objects:[], warnings:['invalid-jamo-confidence']};
      }
      labels.add(label.jamo);
      topK.push({jamo:label.jamo, confidence:label.confidence});
    }
    topK.sort((a,b) => b.confidence - a.confidence);
    const id = `obj-${i+1}`; // avoid untrusted IDs and duplicates
    if (seen.has(id)) return {ok:false, objects:[], warnings:['duplicate-id']};
    seen.add(id);
    const placement = mode==='word' ? {
      ...([0,1].includes(item.trayCell)?{trayCell:item.trayCell}:{}),
      ...(['L','V','T'].includes(item.traySlot)?{traySlot:item.traySlot}:{})
    } : {};
    objects.push({id, bbox:[x,y,w,h], center:[x+w/2,y+h/2], topK, ...placement});
  }
  if (mode === 'single' && objects.length > 1) warnings.push('multiple-objects-in-single-mode');
  if (mode === 'word' && objects.length === 1) warnings.push('one-jamo-only-cannot-form-word');
  if (objects.length === 0) warnings.push('no-objects-detected');
  return {ok:true,objects,warnings};
}


const shapeRules = labels => `Detect each separate, visible Hangul piece. Food pieces may have shine, soft edges or steam.
Allowed labels: ${labels.join(' ')}. Return zero to 18 objects. Use an empty array when there are no pieces.
Check the stroke directions in the tray's TOP orientation. ㅗ has its short stem above the horizontal bar (ㅗ); ㅜ has it below (ㅜ). ㅏ has its short arm to the right of the vertical stroke; ㅓ has it to the left. If the stem or arm is hard to see, include the other plausible vowel in topK.
For each piece, bbox must be [LEFT, TOP, WIDTH, HEIGHT], normalized 0–1000 against the full input image. Never use corner coordinates for width or height.
topK contains one to three distinct visual alternatives, highest confidence first. Confidence is a relative number from 0 to 1. Do not infer a piece from the word you expect.`;
const TRAY_PROMPT = `Read the separate Hangul pieces placed in the tray. Ignore printed tray labels, decorative food, logos, QR codes, examples and any completed word printed outside the wells.
Each of the two syllable cells has exactly three wells: upper left for the first consonant (L), upper right for the vowel (V), lower wide well for the optional final consonant (T). All vowel shapes, including ㅗ, ㅜ and ㅡ, go in the upper right well on this tray.
Identify trayCell 0 (left) or 1 (right) and traySlot L, V or T from the physical wells. Use the tray positions even when the photo is tilted, has large margins, or the tray is high or low in the frame. For a clear cutout or illustrated sample, use the visible piece and well boundaries. Do not read words written in the image or invent pieces in empty wells.
When a piece is visible but its tray or well is unclear, use null for the unknown position. For separate pieces arranged without visible wells, report the shapes and use null for positions you cannot determine.
Use one label for a visible double consonant such as ㄲ, a combined vowel such as ㅘ, or a final cluster such as ㄳ. Keep them distinct from their individual component letters.
${shapeRules(ALL_JAMO)}`;
const SINGLE_PROMPT = `Find the single separate Hangul piece placed near the middle of the picture. Ignore captions, tray labels and decorative background. If several clearly separate pieces are present, return each so the app can ask for a photo with one piece. Set trayCell and traySlot to null.
${shapeRules(JAMO)}`;


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

function providerStatus(response, error){
  if(BILLING_ERRORS.has(error?.code)||BILLING_ERRORS.has(error?.type))return 'provider-billing-error';
  if(error?.code==='model_not_found'||response.status===404)return 'provider-model-unavailable';
  if(response.status===401)return 'provider-auth-error';
  if(response.status===403)return 'provider-access-error';
  if(response.status===429)return 'provider-rate-limited';
  if(response.status>=500)return 'provider-unavailable';
  return response.status===400?'provider-invalid-request':'provider-error';
}

export default async function handler(request) {
  if (request.method !== 'POST') return send({status:'method-not-allowed'},405);
  const key = env('OPENAI_API_KEY')?.trim();
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
  const configuredModel = env('OPENAI_VISION_MODEL')?.trim() || env('OPENAI_MODEL')?.trim();
  const model = configuredModel || DEFAULT_MODEL;
  const models = configuredModel ? [model] : [model,FALLBACK_MODEL];
  const promptText = target==='printed' ? PRINTED_PROMPT : req.mode==='single' ? SINGLE_PROMPT : TRAY_PROMPT;
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
          topK:{type:'array',items:{type:'object',additionalProperties:false,properties:{jamo:{type:'string',enum:labelsForMode(req.mode)},confidence:{type:'number'}},required:['jamo','confidence']}},
          trayCell:{type:['integer','null'],enum:[0,1,null]},
          traySlot:{type:['string','null'],enum:['L','V','T',null]}
        },required:['bbox','topK','trayCell','traySlot']}},
        warnings:{type:'array',items:{type:'string'}}
      },
      required: target==='printed' ? ['text','confidence','warnings'] : ['objects','warnings']
    }
  };
  try {
    const signal=AbortSignal.timeout(42000);
    for(const attemptModel of models){
      const response = await globalThis.fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'authorization':`Bearer ${key}`,'content-type':'application/json'},
        body:JSON.stringify({
          model:attemptModel,store:false,max_completion_tokens:1600,
          ...(/^gpt-6(?:-luna|-sol|\.1-terra)(?:-|$)/.test(attemptModel)?{reasoning_effort:'none'}:{}),
          ...(/^gpt-4\.1(?:-|$)/.test(attemptModel)?{temperature:0}:{}),
          response_format:{type:'json_schema',json_schema:jsonSchema},
          messages:[{role:'user',content:[
            {type:'text',text:promptText},
            {type:'image_url',image_url:{url:`data:${matched[1]};base64,${matched[2]}`,detail:'high'}}
          ]}]
        }),
        signal
      });
      if(!response.ok){
        const err=await response.json().catch(()=>null);
        const status=providerStatus(response,err?.error);
        console.warn('[OpenAI vision]',{httpStatus:response.status,status});
        if(status==='provider-model-unavailable'&&attemptModel===DEFAULT_MODEL&&!configuredModel)continue;
        return send({status,objects:[],warnings:['openai-upstream-error']},502);
      }
      const decoded=parseModelJson(await response.json());
      if(target==='printed'){
        const printed=validatePrintedText(decoded);
        if(!printed)return send({status:'invalid-model-output',objects:[],warnings:['invalid-printed-text-response']},502);
        return send({...printed,model:attemptModel});
      }
      const parsed=validateDetections(decoded,req.mode);
      if(!parsed.ok)return send({status:'invalid-model-output',objects:[],warnings:parsed.warnings},502);
      return send({
        status:parsed.objects.length?'ok':'no-objects',recognitionType:'jamo-shapes',
        objects:parsed.objects,warnings:[...parsed.warnings,'uncalibrated-ai-scores-user-confirmation-required'],
        model:attemptModel
      });
    }
    return send({status:'provider-model-unavailable',objects:[],warnings:['openai-upstream-error']},502);
  } catch(error){
    const status=error?.name==='TimeoutError'?'provider-timeout':'provider-network-error';
    console.warn('[OpenAI vision]',{status,errorName:error?.name||'unknown'});
    return send({status,objects:[],warnings:['openai-request-failed']},502);
  }
}
