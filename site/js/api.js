import { composeSpatial } from './spatial.js';
import { SETS } from './jamo-data.js';
export async function getProductSet(setId) {
    try {
        const res = await fetch(`/api/product-sets/${encodeURIComponent(setId)}`, { cache: 'no-store' });
        if (res.ok)
            return await res.json();
    }
    catch { }
    return SETS.basic14;
}
export async function recognize(image, mode, setId) {
    const res = await fetch('/api/recognize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, mode, setId }) });
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.status === 'unconfigured' ? 'unconfigured' : 'vision-error');
    }
    return res.json();
}
export async function compose(req) {
    try {
        const r = await fetch('/api/compose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
        if (r.ok)
            return await r.json();
    }
    catch { }
    return composeSpatial(req);
}
export async function lookup(word, lang) {
    try {
        const r = await fetch(`/api/dictionary?${new URLSearchParams({ word, lang })}`, { cache: 'no-store' });
        const d = await r.json();
        if (d?.status === 'found' || d?.status === 'ok' || d?.status === 'not_found')
            return d;
        return { ...d, status: 'error' };
    }
    catch {
        return { status: 'error', headword: word, targetCode: null, pronunciation: null, senses: [], sourceUrl: null, attribution: '', reason: 'network' };
    }
}
/** Small, non-authoritative index. Must never be used to declare a word absent from KRDICT. */
export async function lookupLocalIndex(word) {
    const res = await fetch(`/api/dictionary-index?${new URLSearchParams({ word })}`, { cache: 'no-store' });
    if (!res.ok)
        throw new Error('local-index-unavailable');
    return res.json();
}
