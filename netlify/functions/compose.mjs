import {composeSpatial, normalizeObjects} from '../../site/js/spatial.js';

const reply = (body, status = 200) => Response.json(body, {
  status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}
});

// Supports partial corrections by ID. Never replace the complete detection list
// with a smaller array of edits (this previously discarded unedited objects).
export function mergeAdjustments(objects, adjustments) {
  if (!Array.isArray(adjustments)) return objects;
  const byId = new Map(adjustments.filter(x => x && typeof x.id === 'string').map(x => [x.id,x]));
  return objects.map(original => {
    const edited = byId.get(original.id);
    if (!edited) return original;
    return {
      ...original,
      ...('correctedJamo' in edited ? {correctedJamo:edited.correctedJamo} : {}),
      ...('correctedSlot' in edited ? {correctedSlot:edited.correctedSlot} : {}),
      ...('correctedCell' in edited ? {correctedCell:edited.correctedCell} : {})
    };
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return reply({status:'method-not-allowed'},405);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return reply({status:'bad-content-type'},415);
  const raw = await request.text();
  if (raw.length > 40_000) return reply({status:'too-large'},413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({status:'invalid-json'},400); }
  if (!Array.isArray(body?.objects) || body.objects.length > 18 || !Number.isInteger(Number(body?.cellCount ?? 2))) {
    return reply({status:'invalid-request'},400);
  }
  const merged = mergeAdjustments(body.objects,body.userAdjustments);
  const objects = normalizeObjects(merged);
  if (objects.length !== merged.length) return reply({status:'invalid-detections'},400);
  const cellCount = Math.max(1,Math.min(4,Number(body.cellCount ?? 2)));
  const composed = composeSpatial({objects,cellCount});
  // Invariant: the first candidate is the literal reading, never a dictionary rewrite.
  // A missing word in the SMALL starter lexicon does NOT imply official dictionary absence.
  const candidates = composed.wordCandidates.map((c,i) => ({
    ...c,
    autoCorrected:false,
    originalText:composed.originalText,
    lexiconStatus:c.isInDictionary ? 'local_index_match' : 'not_in_local_index',
    isOriginal:i===0
  }));
  return reply({
    ...composed,
    wordCandidates:candidates,
    requiresConfirmation:true,
    actions:{keepOriginal:true,chooseAlternative:candidates.length>1,editJamo:true},
    message:candidates[0]?.lexiconStatus==='not_in_local_index'
      ? '로컬 목록에 없는 표현입니다. 직접 만든 단어일 수 있으며, 공식 사전 조회 전에는 미등재로 판단하지 않습니다.'
      : null
  });
}
