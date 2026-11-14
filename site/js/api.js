import { composeSpatial } from './spatial.js';
import { PRODUCT_SET } from './jamo-data.js';
export async function getProductSet(setId) {
    try {
        const res = await fetch(`/api/product-sets/${encodeURIComponent(setId)}`, { cache: 'no-store' });
        if (res.ok)
            return await res.json();
    }
    catch { }
    return PRODUCT_SET;
}
export async function recognize(image, mode, setId, target = 'pieces', signal) {
    let res;
    try {
        res = await fetch('/api/recognize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, mode, setId, target }), signal });
    }
    catch {
        throw new Error('network-error');
    }
    if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.status === 'string' ? data.status : `http-${res.status}`);
    }
    return res.json();
}
export async function compose(req) {
    try {
        const response = await fetch('/api/compose', { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req), signal: AbortSignal.timeout(8000) });
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.wordCandidates) && Array.isArray(data?.cells))
                return data;
        }
    }
    catch { /* the browser can compose locally */ }
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
