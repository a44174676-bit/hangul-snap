// Modern Hangul in Unicode syllable order. The empty final is represented by null.
export const JAMO_BY_SLOT = {
 L: ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'],
 V: ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'],
 T: ['ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
} as const;

export type Slot = keyof typeof JAMO_BY_SLOT;
export type Jamo = (typeof JAMO_BY_SLOT)[Slot][number];
export const ALL_JAMO: readonly Jamo[] = [...new Set(Object.values(JAMO_BY_SLOT).flat())];
const knownJamo = new Set<string>(ALL_JAMO);

export function isJamo(value: unknown): value is Jamo {
 return typeof value === 'string' && knownJamo.has(value);
}

export function fitsSlot(jamo: Jamo, slot: Slot): boolean {
 const choices: readonly Jamo[] = JAMO_BY_SLOT[slot];
 return choices.includes(jamo);
}

export function isHorizontalVowel(jamo: Jamo): boolean {
 return ['ㅗ','ㅛ','ㅜ','ㅠ','ㅡ'].includes(jamo);
}
