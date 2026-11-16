import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import test from 'node:test';
import {JAMO_BY_SLOT} from '../site/js/jamo-letters.js';
import {
  FINAL_CLUSTERS, FINAL_SOUND_EXAMPLES, H_COMPARISONS, LIAISON_COMPARISONS, ONSET_COMPARISONS, ONSET_GROUPS,
  PRACTICE_EXAMPLES, PRONUNCIATION_TOPICS, READINGS_NEEDING_RECORDINGS, SIMPLE_FINALS, SOUND_CHANGE_EXAMPLES,
  UI_EXAMPLES, VOWEL_GROUPS, exampleRecordingKey, lessonPlaybackPaths, lessonRecordingPath,
} from '../site/js/pronunciation-data.js';
import {pronunciationView} from '../site/js/pronunciation.js';
import {playLessonRecording, stopSpeech} from '../site/js/speech.js';

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

test('Every reading shows its own recording button or a missing recording notice', () => {
  for (const lang of ['ko', 'vi', 'en', 'ja', 'zh']) {
    const groups = [
      ['changes', [...Object.values(SOUND_CHANGE_EXAMPLES).flat(), ...PRACTICE_EXAMPLES]],
      ['vowels', UI_EXAMPLES],
    ];
    for (const [topic, examples] of groups) {
      const html = pronunciationView(lang, topic);
      for (const [word, ...readings] of examples) {
        const row = html.split(`>${word}</th><td lang="ko">${readings.join(' / ')}</td>`)[1]?.split('</tr>')[0];
        assert.ok(row, `${lang}: ${word}`);
        assert.doesNotMatch(row, /<a\b/);
        for (const [index, reading] of readings.entries()) {
          const key = exampleRecordingKey(word, index);
          if (READINGS_NEEDING_RECORDINGS.has(key)) {
            assert.ok(row.includes(`class="pronunciation-recording-pending"><span lang="ko">${reading}</span>`), key);
            assert.ok(!row.includes(`data-value="${key}"`), key);
            continue;
          }
          assert.ok(row.includes(`data-action="pronunciation-audio" data-value="${key}"\n    data-reading="${reading}"`),
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
    for (const match of html.matchAll(/data-action="pronunciation-audio" data-value="([^"]+)"/g)) {
      const paths = lessonPlaybackPaths(match[1]);
      assert.ok(paths.length, match[1]);
      for (const path of paths) recordings.add(decodeURIComponent(path.split('/').at(-1).slice(0, -4)));
    }
  }
  const paths = [...recordings].map(example => {
    const path = lessonRecordingPath(example);
    assert.ok(path, example);
    return [example, new URL(`../site${path}`, import.meta.url)];
  });
  assert.deepEqual(paths.filter(([, path]) => !existsSync(path)).map(([example]) => example), [],
    'Every enabled lesson button must have an audio file');
  const clips = paths.map(([example, path]) => {
    const clip = readFileSync(path);
    assert.ok(clip.length > 1000, example);
    return clip.toString('base64');
  });
  assert.equal(new Set(clips).size, clips.length, 'The examples have distinct media');
  const packagedClips = readdirSync(new URL('../site/audio/ko/pronunciation/', import.meta.url))
    .filter(name => name.endsWith('.mp3')).map(name => name.slice(0, -4));
  assert.deepEqual(packagedClips.sort(), [...recordings].sort());
  for (const row of [...ONSET_COMPARISONS, ...LIAISON_COMPARISONS, ...H_COMPARISONS]) {
    assert.deepEqual(lessonPlaybackPaths(row.join('-')), row.map(lessonRecordingPath));
  }
  assert.deepEqual(lessonPlaybackPaths('나제-임의조합'), []);
});

test('Lesson playback waits for each clip, repeats in order and cancels the pause on Stop', async t => {
  const played = [];
  const loaded = [];
  const pending = new Map();
  let lastTimer = 0;
  let audio;
  const mockWindow = {
    setTimeout(run, delay) { pending.set(++lastTimer, {run, delay}); return lastTimer; },
    clearTimeout(id) { pending.delete(id); },
  };
  const oldWindow = globalThis.window;
  const oldAudio = globalThis.Audio;
  globalThis.window = mockWindow;
  globalThis.Audio = class extends EventTarget {
    constructor() { super(); audio = this; }
    set src(path) { this.path = path; loaded.push(path); }
    getAttribute(name) { return name === 'src' ? this.path ?? null : null; }
    play() { played.push(this.path); return Promise.resolve(); }
    pause() {}
    load() {}
    removeAttribute() {}
  };
  t.after(() => {
    stopSpeech();
    globalThis.window = oldWindow;
    globalThis.Audio = oldAudio;
  });
  function advance(delay) {
    const [[id, next]] = pending.entries();
    assert.equal(next.delay, delay);
    pending.delete(id);
    next.run();
  }
  const paths = lessonPlaybackPaths('가-까-카');
  const listening = playLessonRecording(paths, 3);
  assert.deepEqual(played, paths.slice(0, 1));
  for (let round = 0; round < 3; round += 1) {
    for (let index = 0; index < paths.length; index += 1) {
      audio.dispatchEvent(new Event('ended'));
      if (index < paths.length - 1) advance(720);
      else if (round < 2) advance(1250);
    }
  }
  await listening;
  assert.deepEqual(played, [...paths, ...paths, ...paths]);
  const stopped = playLessonRecording(paths, 3);
  audio.dispatchEvent(new Event('ended'));
  const abort = assert.rejects(stopped, {name: 'AbortError'});
  stopSpeech();
  await abort;
  assert.equal(pending.size, 0);
  assert.equal(played.length, 10);

  const single = lessonPlaybackPaths('닿아');
  const loadsBeforeSingle = loaded.length;
  const singleListening = playLessonRecording(single, 3);
  for (let round = 0; round < 3; round += 1) {
    audio.currentTime = 0.8;
    audio.dispatchEvent(new Event('ended'));
    if (round === 2) break;
    advance(1250);
    assert.equal(audio.currentTime, 0);
  }
  await singleListening;
  assert.deepEqual(played.slice(-3), [...single, ...single, ...single]);
  assert.deepEqual(loaded.slice(loadsBeforeSingle), single);
});
