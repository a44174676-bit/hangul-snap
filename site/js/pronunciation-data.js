import { JAMO_BY_SLOT, fitsSlot } from './jamo-letters.js';
export const PRONUNCIATION_TOPICS = ['consonants', 'vowels', 'finals', 'changes'];
export const ONSET_GROUPS = [
    ['ㄱ', 'ㄷ', 'ㅂ', 'ㅅ', 'ㅈ'],
    ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'],
    ['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ'],
    ['ㄴ', 'ㄹ', 'ㅁ', 'ㅇ', 'ㅎ'],
];
export const ONSET_COMPARISONS = [
    ['가', '까', '카'], ['다', '따', '타'], ['바', '빠', '파'],
    ['사', '싸'], ['자', '짜', '차'],
];
export const VOWEL_GROUPS = {
    single: ['ㅏ', 'ㅐ', 'ㅓ', 'ㅔ', 'ㅗ', 'ㅚ', 'ㅜ', 'ㅟ', 'ㅡ', 'ㅣ'],
    glideJ: ['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ'],
    glideW: ['ㅘ', 'ㅙ', 'ㅝ', 'ㅞ'],
    ui: ['ㅢ'],
};
export const VOWEL_RECORDINGS = {
    ㅏ: '아', ㅐ: '애', ㅓ: '어', ㅔ: '에', ㅗ: '오', ㅚ: '외', ㅜ: '우', ㅟ: '위', ㅡ: '으', ㅣ: '이',
    ㅑ: '야', ㅒ: '얘', ㅕ: '여', ㅖ: '예', ㅛ: '요', ㅠ: '유',
    ㅘ: '와', ㅙ: '왜', ㅝ: '워', ㅞ: '스웨덴', ㅢ: '의심하다',
};
export const SIMPLE_FINALS = JAMO_BY_SLOT.T.filter(jamo => fitsSlot(jamo, 'L'));
export const FINAL_CLUSTERS = JAMO_BY_SLOT.T.filter(jamo => !fitsSlot(jamo, 'L'));
export const FINAL_SOUND_EXAMPLES = [
    ['ㄱ', '부엌', '[부억]'], ['ㄴ', '눈', '[눈]'], ['ㄷ', '꽃', '[꼳]'],
    ['ㄹ', '발', '[발]'], ['ㅁ', '밤', '[밤]'], ['ㅂ', '잎', '[입]'], ['ㅇ', '강', '[강]'],
];
export const UI_EXAMPLES = [
    ['의자', '[의자]'], ['희망', '[히망]'], ['성의', '[성의]', '[성이]'],
    ['우리의', '[우리의]', '[우리에]'],
];
export const SOUND_CHANGE_EXAMPLES = {
    finalSound: [['낮', '[낟]'], ['빛', '[빋]'], ['부엌', '[부억]']],
    liaison: [['언어', '[어너]'], ['낮에', '[나제]'], ['빛이', '[비치]'], ['부엌에', '[부어케]'], ['닭이', '[달기]'], ['강에', '[강에]']],
    hDeletion: [['많이', '[마ː니]'], ['좋아', '[조ː아]'], ['옳아', '[오라]'], ['닿아', '[다아]']],
    aspiration: [['놓다', '[노타]'], ['좋고', '[조ː코]'], ['옳다', '[올타]'], ['닿지', '[다치]'], ['입학', '[이팍]']],
};
export const PRACTICE_EXAMPLES = [['옷에', '[오세]'], ['놓아', '[노아]']];
export function exampleRecordingKey(word, readingIndex) {
    return readingIndex === 0 ? word : `${word}-${readingIndex + 1}`;
}
const LESSON_RECORDINGS = new Set([
    ...ONSET_COMPARISONS.flatMap(row => [...row, row.join('-')]),
    ...Object.values(VOWEL_RECORDINGS),
    ...FINAL_SOUND_EXAMPLES.map(([, word]) => word),
    ...[...UI_EXAMPLES, ...Object.values(SOUND_CHANGE_EXAMPLES).flat(), ...PRACTICE_EXAMPLES]
        .flatMap(([word, ...readings]) => readings.map((_, index) => exampleRecordingKey(word, index))),
]);
export function lessonRecordingPath(example) {
    return LESSON_RECORDINGS.has(example) ? `/audio/ko/pronunciation/${encodeURIComponent(example)}.mp3` : null;
}
