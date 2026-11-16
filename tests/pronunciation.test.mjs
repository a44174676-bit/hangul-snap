import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {JAMO_BY_SLOT} from '../site/js/jamo-letters.js';
import {
  FINAL_CLUSTERS, FINAL_SOUND_EXAMPLES, ONSET_COMPARISONS, ONSET_GROUPS,
  PRACTICE_EXAMPLES, PRONUNCIATION_TOPICS, SIMPLE_FINALS, SOUND_CHANGE_EXAMPLES,
  UI_EXAMPLES, VOWEL_GROUPS, exampleRecordingKey, lessonRecordingPath,
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

test('Every pronunciation example and variant has a listen control in all languages', () => {
  for (const lang of ['ko', 'vi', 'en', 'ja', 'zh']) {
    const groups = [
      ['changes', [...Object.values(SOUND_CHANGE_EXAMPLES).flat(), ...PRACTICE_EXAMPLES]],
      ['vowels', UI_EXAMPLES],
    ];
    for (const [topic, examples] of groups) {
      const html = pronunciationView(lang, topic);
      for (const [word, ...readings] of examples) {
        assert.ok(html.includes(`>${word}</th><td lang="ko">${readings.join(' / ')}</td>`), `${lang}: ${word}`);
        for (const [index, reading] of readings.entries()) {
          const key = exampleRecordingKey(word, index);
          assert.ok(html.includes(`data-action="pronunciation-audio" data-value="${key}"\n    data-reading="${reading}"`),
            `${lang}: ${word} ${reading}`);
        }
      }
      assert.ok(html.includes('id="tts-status" role="status"'));
    }
  }
});

test('The vowel lesson preserves permitted pronunciations of ㅢ', () => {
  const html = pronunciationView('ko', 'vowels');
  assert.ok(html.includes('data-value="의심하다"'));
  assert.ok(html.includes('[히망]'));
  assert.ok(html.includes('[성의] / [성이]'));
  assert.ok(html.includes('[우리의] / [우리에]'));
  assert.equal(PRONUNCIATION_TOPICS.length, 4);
});

test('Every pronunciation lesson audio control plays a dedicated recording', () => {
  const recordings = new Set();
  for (const topic of PRONUNCIATION_TOPICS) {
    const html = pronunciationView('ko', topic);
    assert.ok(!html.includes('data-action="speak"'), topic);
    for (const match of html.matchAll(/data-action="pronunciation-audio" data-value="([^"]+)"/g)) recordings.add(match[1]);
  }
  const clips = [...recordings].map(example => {
    const path = lessonRecordingPath(example);
    assert.ok(path, example);
    const clip = readFileSync(new URL(`../site${path}`, import.meta.url));
    assert.ok(clip.length > 1000, example);
    return clip.toString('base64');
  });
  assert.equal(new Set(clips).size, clips.length, 'The examples have distinct media');
  for (const row of ONSET_COMPARISONS) {
    assert.ok(recordings.has(row.join('-')), row.join(' '));
    for (const syllable of row) assert.ok(recordings.has(syllable), syllable);
  }
});
