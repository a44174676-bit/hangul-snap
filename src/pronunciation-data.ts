import {JAMO_BY_SLOT, fitsSlot} from './jamo-letters.js';

export const PRONUNCIATION_TOPICS = ['consonants', 'vowels', 'finals', 'changes'] as const;
export type PronunciationTopic = (typeof PRONUNCIATION_TOPICS)[number];

export const ONSET_GROUPS = [
  ['ㄱ', 'ㄷ', 'ㅂ', 'ㅅ', 'ㅈ'],
  ['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ'],
  ['ㅋ', 'ㅌ', 'ㅍ', 'ㅊ'],
  ['ㄴ', 'ㄹ', 'ㅁ', 'ㅇ', 'ㅎ'],
] as const satisfies readonly (readonly (typeof JAMO_BY_SLOT.L)[number][])[];

export const ONSET_COMPARISONS = [
  ['가', '까', '카'], ['다', '따', '타'], ['바', '빠', '파'],
  ['사', '싸'], ['자', '짜', '차'],
] as const;

type Vowel = (typeof JAMO_BY_SLOT.V)[number];
export const VOWEL_GROUPS = {
  single: ['ㅏ', 'ㅐ', 'ㅓ', 'ㅔ', 'ㅗ', 'ㅚ', 'ㅜ', 'ㅟ', 'ㅡ', 'ㅣ'],
  glideJ: ['ㅑ', 'ㅒ', 'ㅕ', 'ㅖ', 'ㅛ', 'ㅠ'],
  glideW: ['ㅘ', 'ㅙ', 'ㅝ', 'ㅞ'],
  ui: ['ㅢ'],
} as const satisfies Record<string, readonly Vowel[]>;

export const SIMPLE_FINALS = JAMO_BY_SLOT.T.filter(jamo => fitsSlot(jamo, 'L'));
export const FINAL_CLUSTERS = JAMO_BY_SLOT.T.filter(jamo => !fitsSlot(jamo, 'L'));

export const FINAL_SOUND_EXAMPLES = [
  ['ㄱ', '밖', '[박]'], ['ㄴ', '산', '[산]'], ['ㄷ', '낮', '[낟]'],
  ['ㄹ', '달', '[달]'], ['ㅁ', '점', '[점]'], ['ㅂ', '앞', '[압]'], ['ㅇ', '강', '[강]'],
] as const;

export const UI_EXAMPLES = [
  ['의자', '[의자]'], ['희망', '[히망]'], ['성의', '[성의] / [성이]'],
  ['우리의', '[우리의] / [우리에]'],
] as const;

export const SOUND_CHANGE_EXAMPLES = {
  finalSound: [['낮', '[낟]'], ['빛', '[빋]'], ['부엌', '[부억]']],
  liaison: [['낮에', '[나제]'], ['빛이', '[비치]'], ['부엌에', '[부어케]'], ['닭이', '[달기]'], ['강에', '[강에]']],
  hDeletion: [['좋아', '[조ː아]'], ['옳아', '[오라]'], ['닿아', '[다아]']],
  aspiration: [['좋고', '[조ː코]'], ['옳다', '[올타]'], ['닿지', '[다치]'], ['입학', '[이팍]']],
} as const;

export const PRACTICE_EXAMPLES = [['옷에', '[오세]'], ['놓아', '[노아]']] as const;
