import assert from 'node:assert/strict';
import test from 'node:test';
import {JAMO_BY_SLOT} from '../site/js/jamo-letters.js';
import {
  FINAL_CLUSTERS, FINAL_SOUND_EXAMPLES, ONSET_GROUPS,
  PRONUNCIATION_TOPICS, SIMPLE_FINALS, VOWEL_GROUPS,
} from '../site/js/pronunciation-data.js';
import {pronunciationView} from '../site/js/pronunciation.js';

test('Pronunciation lesson groups cover the composer inventory exactly once', () => {
  assert.deepEqual(ONSET_GROUPS.flat().sort(), [...JAMO_BY_SLOT.L].sort());
  assert.deepEqual(Object.values(VOWEL_GROUPS).map(group => group.length), [10, 6, 4, 1]);
  assert.deepEqual(Object.values(VOWEL_GROUPS).flat().sort(), [...JAMO_BY_SLOT.V].sort());
  assert.equal(SIMPLE_FINALS.length, 16);
  assert.equal(FINAL_CLUSTERS.length, 11);
  assert.deepEqual([...SIMPLE_FINALS, ...FINAL_CLUSTERS].sort(), [...JAMO_BY_SLOT.T].sort());
  assert.ok(SIMPLE_FINALS.includes('ㄲ') && SIMPLE_FINALS.includes('ㅆ'));
  assert.deepEqual(FINAL_SOUND_EXAMPLES.map(([jamo]) => jamo), ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅇ']);
});

test('Sound-change examples keep spelling and the audio fallback distinct', () => {
  for (const lang of ['ko', 'vi', 'en', 'ja', 'zh']) {
    const html = pronunciationView(lang, 'changes');
    for (const [word, reading] of [['낮', '낟'], ['낮에', '나제'], ['빛이', '비치'], ['부엌에', '부어케'],
      ['닭이', '달기'], ['강에', '강에'], ['옳아', '오라'], ['옳다', '올타'], ['닿지', '다치']]) {
      assert.ok(html.includes(`data-value="${word}"\n    data-reading="[${reading}]"`), `${lang}: ${word}`);
    }
    assert.ok(html.includes('id="tts-status" role="status"'));
  }
});

test('The vowel lesson preserves permitted pronunciations of ㅢ', () => {
  const html = pronunciationView('ko', 'vowels');
  assert.ok(html.includes('data-value="의"'));
  assert.ok(html.includes('[히망]'));
  assert.ok(html.includes('[성의] / [성이]'));
  assert.ok(html.includes('[우리의] / [우리에]'));
  assert.equal(PRONUNCIATION_TOPICS.length, 4);
});
