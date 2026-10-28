/** A *small editorial starter lexicon*, NOT an authoritative copy of KRDICT. */
import {LOCAL_LEXICON} from '../../site/js/jamo-data.js';
const reply = (data,status=200) => Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export default async function handler(request) {
  if (request.method !== 'GET') return reply({status:'method-not-allowed'},405);
  const word=(new URL(request.url).searchParams.get('word')||'').normalize('NFC').trim();
  if (!/^[가-힣]{1,25}$/.test(word)) return reply({status:'invalid-word'},400);
  const known=LOCAL_LEXICON.has(word);
  return reply({word,status:known?'local_match':'not_in_local_index',source:'editorial_starter_lexicon',isOfficialDictionary:false});
}
