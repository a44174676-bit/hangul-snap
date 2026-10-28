import { CONSONANTS, LOCAL_LEXICON, VOWELS } from './jamo-data.js';
const L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
export const EMPTY = () => ({ L: null, V: null, T: null });
export function composeCell(cell) {
    if (!cell.L || !cell.V)
        return null;
    const l = L.indexOf(cell.L), v = V.indexOf(cell.V), t = T.indexOf(cell.T || '');
    if (l < 0 || v < 0 || t < 0)
        return null;
    return String.fromCharCode(0xac00 + 588 * l + 28 * v + t);
}
export const composeCells = (cells) => {
    const syllables = cells.map(c => composeCell(c) || '');
    return { text: syllables.join(''), valid: syllables.length > 0 && syllables.every(Boolean), syllables };
};
/** Preview cell layout: two 2D Korean syllable cells, each 500 x 1000 coordinate units. */
export function bboxFor(cell, slot, jamo, cellCount = 2) {
    const w = 1000 / cellCount, ox = w * cell;
    const vertical = ['ㅏ', 'ㅓ', 'ㅣ'].includes(jamo);
    if (slot === 'L')
        return [ox + w * .14, 200, w * .30, 280];
    if (slot === 'T')
        return [ox + w * .25, 750, w * .44, 135];
    return vertical ? [ox + w * .55, 190, w * .30, 300] : [ox + w * .22, 555, w * .57, 145];
}
export function objectsFromCells(cells) {
    return cells.flatMap((c, i) => ['L', 'V', 'T'].flatMap(slot => c[slot] ? [{ id: `manual-${i}-${slot}`, bbox: bboxFor(i, slot, c[slot], cells.length), topK: [{ jamo: c[slot], confidence: 1 }], correctedJamo: c[slot], correctedSlot: slot, correctedCell: i }] : []));
}
const center = (b) => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });
const slotOf = (o, j, cellWidth) => {
    if (o.correctedSlot)
        return o.correctedSlot;
    if (VOWELS.includes(j))
        return 'V';
    const c = center(o.bbox);
    // A consonant lying below the top writing area is a coda candidate.
    return c.y > 685 ? 'T' : 'L';
};
const selectedJamo = (o, choice = 0) => o.correctedJamo || o.topK[choice]?.jamo || o.topK[0]?.jamo;
function layout(objects, cellCount, changed) {
    const cells = Array.from({ length: cellCount }, EMPTY), warnings = [];
    let confidence = 0;
    let valid = true;
    for (const o of objects) {
        const j = (changed && changed.id === o.id ? changed.jamo : selectedJamo(o));
        if (!j) {
            valid = false;
            continue;
        }
        const cellIdx = o.correctedCell ?? Math.min(cellCount - 1, Math.max(0, Math.floor(center(o.bbox).x / 1000 * cellCount)));
        const slot = slotOf(o, j, 1000 / cellCount);
        if (slot === 'L' && !CONSONANTS.includes(j) || slot === 'V' && !VOWELS.includes(j) || slot === 'T' && !CONSONANTS.includes(j)) {
            valid = false;
            warnings.push(`slot-mismatch:${o.id}`);
            continue;
        }
        if (cells[cellIdx][slot]) {
            valid = false;
            warnings.push(`slot-conflict:${o.id}`);
            continue;
        }
        cells[cellIdx][slot] = j;
        const p = (changed && changed.id === o.id) ? o.topK.find(k => k.jamo === j)?.confidence ?? .2 : o.topK.find(k => k.jamo === j)?.confidence ?? 1;
        confidence += p;
    }
    return { cells, valid, confidence: objects.length ? confidence / objects.length : 0, warnings };
}
function makeCandidate(objects, n, changed) {
    const r = layout(objects, n, changed), composed = composeCells(r.cells);
    const inDict = LOCAL_LEXICON.has(composed.text);
    const visualScore = r.confidence;
    const layoutScore = r.valid && composed.valid ? 1 : 0;
    const grammarScore = composed.valid ? 1 : 0;
    const dictionaryScore = inDict ? 1 : 0;
    // Weights are a heuristic, NOT measured or patented effect.
    const score = Number((.55 * visualScore + .20 * layoutScore + .15 * grammarScore + .10 * dictionaryScore).toFixed(3));
    return { text: composed.text, score, syllables: composed.syllables, isInDictionary: inDict, autoCorrected: false, originalText: composed.text, valid: r.valid && composed.valid, cells: r.cells };
}
export function composeSpatial(input) {
    const objects = (input.userAdjustments?.length ? input.userAdjustments : input.objects).slice(0, 18);
    const cellCount = Math.max(1, Math.min(4, Math.trunc(input.cellCount || 2)));
    const original = makeCandidate(objects, cellCount);
    const candidates = [original];
    for (const obj of objects) {
        if (obj.correctedJamo)
            continue;
        for (const alt of obj.topK.slice(1, 3)) {
            const candidate = makeCandidate(objects, cellCount, { id: obj.id, jamo: alt.jamo });
            if (candidate.valid && !candidates.some(c => c.text === candidate.text))
                candidates.push(candidate);
        }
    }
    // NEVER automatically mutate the primary recognition, even for lexicon matches.
    const suggestions = candidates.slice(1).filter(c => c.valid).sort((a, b) => b.score - a.score).slice(0, 2);
    const all = [original, ...suggestions].map(({ cells: unused, ...rest }) => ({ ...rest, originalText: original.text }));
    const warningList = [];
    if (!original.valid)
        warningList.push('incomplete-or-conflicting-layout');
    if (objects.length === 0)
        warningList.push('no-objects');
    return { wordCandidates: all, requiresConfirmation: true, originalText: original.text, warnings: warningList, cells: original.cells };
}
/** Normalizes camera boxes. This is conservative; the caller must still ask for confirmation. */
export function normalizeObjects(values) {
    if (!Array.isArray(values))
        return [];
    return values.slice(0, 20).map((o, i) => {
        const numbers = (Array.isArray(o?.bbox) ? o.bbox : [0, 0, 0, 0]).slice(0, 4).map((n) => Number(n));
        if (numbers.length !== 4 || numbers.some((n) => !Number.isFinite(n)))
            return null;
        const box = numbers.map((v) => Math.max(0, Math.min(1000, v)));
        const topK = (Array.isArray(o?.topK) ? o.topK : []).filter((v) => v && (CONSONANTS.includes(v.jamo) || VOWELS.includes(v.jamo)) && Number.isFinite(Number(v.confidence))).slice(0, 3).map((v) => ({ jamo: v.jamo, confidence: Math.max(0, Math.min(1, Number(v.confidence))) }));
        return topK.length ? { id: String(o?.id || `object-${i}`).slice(0, 48), bbox: box, topK, ...(CONSONANTS.includes(o?.correctedJamo) || VOWELS.includes(o?.correctedJamo) ? { correctedJamo: o.correctedJamo } : {}), ...(['L', 'V', 'T'].includes(o?.correctedSlot) ? { correctedSlot: o.correctedSlot } : {}), ...(Number.isInteger(o?.correctedCell) && o.correctedCell >= 0 && o.correctedCell < 4 ? { correctedCell: o.correctedCell } : {}) } : null;
    }).filter((o) => o !== null);
}
