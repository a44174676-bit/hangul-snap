import {t} from './i18n.js';
import {JAMO_BY_SLOT} from './jamo-letters.js';
import {PRONUNCIATION_COPY} from './pronunciation-copy.js';
import {
  FINAL_CLUSTERS, FINAL_SOUND_EXAMPLES, H_COMPARISONS, LIAISON_COMPARISONS, ONSET_COMPARISONS, ONSET_GROUPS,
  PRACTICE_EXAMPLES, PRONUNCIATION_TOPICS, SIMPLE_FINALS, SOUND_CHANGE_EXAMPLES,
  UI_EXAMPLES, VOWEL_GROUPS, VOWEL_RECORDINGS, exampleRecordingKey, lessonRecordingPath,
} from './pronunciation-data.js';
import type {PronunciationTopic} from './pronunciation-data.js';
import type {Lang} from './types.js';

type LessonCopy = (typeof PRONUNCIATION_COPY)[Lang];
type Example = readonly [spelling: string, reading: string, ...variants: string[]];

function audioButton(text: string, label: string, body: string, reading = ''): string {
  return `<button class="btn pronunciation-audio" type="button" data-action="pronunciation-audio" data-value="${text}"
    data-reading="${reading}" aria-label="${label}">${body}</button>`;
}

function comparisonButton(words: readonly string[], copy: LessonCopy, body = copy.listenTogether): string {
  const order = words.join(' → ');
  return audioButton(words.join('-'), `${copy.listenTogether} ${order}`, body, order);
}

function exampleTable(examples: readonly Example[], copy: LessonCopy, listen: string): string {
  return `<table class="pronunciation-examples">
    <thead><tr><th scope="col">${copy.spelling}</th><th scope="col">${copy.reading}</th>
      <th scope="col"><span class="visually-hidden">${listen}</span></th></tr></thead>
    <tbody>${examples.map(([word, ...readings]) => {
      const controls = readings.map((reading, index) => {
        const key = exampleRecordingKey(word, index);
        if (!lessonRecordingPath(key)) {
          return `<small class="pronunciation-recording-pending"><span lang="ko">${reading}</span> · ${copy.recordingPending}</small>`;
        }
        const multiple = readings.length > 1;
        const label = multiple ? `${listen} ${word} ${reading}` : `${listen} ${word}`;
        const buttonText = multiple ? `<span lang="ko">${reading}</span>` : copy.listenShort;
        return audioButton(key, label, `<span aria-hidden="true">♫</span> ${buttonText}`, reading);
      });
      return `<tr><th scope="row" lang="ko">${word}</th><td lang="ko">${readings.join(' / ')}</td>
        <td><div class="pronunciation-example-audio">${controls.join('')}</div></td></tr>`;
    }).join('')}</tbody>
  </table>`;
}

function letterGroups(label: string, letters: readonly string[]): string {
  return `<section class="pronunciation-letter-group"><h3>${label} · ${letters.length}</h3>
    <p lang="ko">${letters.join(' ')}</p></section>`;
}

function consonants(copy: LessonCopy, listen: string): string {
  return `<h2>${copy.topics.consonants} · ${JAMO_BY_SLOT.L.length}</h2>
    <p>${copy.onsetNote}</p>
    <div class="pronunciation-groups">
      ${ONSET_GROUPS.map((letters, index) => letterGroups(copy.onsetGroups[index]!, letters)).join('')}
    </div>
    <h3>${copy.onsetCompare}</h3>
    <div class="pronunciation-comparisons">
      ${ONSET_COMPARISONS.map(row => `<div class="controls" role="group" aria-label="${row.join(' · ')}">
        ${row.map(syllable => audioButton(syllable, `${listen} ${syllable}`, `<span lang="ko">${syllable}</span><span aria-hidden="true">♫</span>`)).join('')}
        ${comparisonButton(row, copy)}
      </div>`).join('')}
    </div>`;
}

function vowels(copy: LessonCopy, listen: string): string {
  const {single, glideJ, glideW, ui} = VOWEL_GROUPS;
  const vowelButtons = (letters: readonly (typeof JAMO_BY_SLOT.V)[number][]) => `<div class="controls pronunciation-letters">
    ${letters.map(vowel => {
      const example = VOWEL_RECORDINGS[vowel];
      const word = [...example].length > 1 ? ` <small lang="ko">${example}</small>` : '';
      return audioButton(example, `${listen} ${vowel} · ${example}`, `<span lang="ko">${vowel}</span>${word}<span aria-hidden="true">♫</span>`);
    }).join('')}
  </div>`;
  return `<h2>${copy.topics.vowels} · ${JAMO_BY_SLOT.V.length}</h2>
    <p>${copy.vowelIntro}</p>
    <section class="pronunciation-block"><h3>${copy.singleVowels} · ${single.length}</h3>
      ${vowelButtons(single)}<p>${copy.vowelNote}</p>
    </section>
    <section class="pronunciation-block"><h3>${copy.doubleVowels} · ${glideJ.length + glideW.length + ui.length}</h3>
      <h4>${copy.glideJ} · ${glideJ.length}</h4>
      <p class="pronunciation-formula" lang="ko">/j/ + ㅏ → ㅑ</p>${vowelButtons(glideJ)}
      <h4>${copy.glideW} · ${glideW.length}</h4>
      <p class="pronunciation-formula" lang="ko">/w/ + ㅏ → ㅘ</p>${vowelButtons(glideW)}
      <h4 lang="ko">ㅢ · ${ui.length}</h4>${vowelButtons(ui)}
      <p>${copy.uiNote}</p>${exampleTable(UI_EXAMPLES, copy, listen)}
    </section>`;
}

function finals(copy: LessonCopy, listen: string): string {
  return `<h2>${copy.topics.finals} · ${JAMO_BY_SLOT.T.length}</h2>
    <p>${copy.finalIntro}</p>
    <div class="pronunciation-groups">${letterGroups(copy.simpleFinals, SIMPLE_FINALS)}
      ${letterGroups(copy.finalClusters, FINAL_CLUSTERS)}
    </div>
    <p>${copy.finalNote}</p>
    <section class="pronunciation-block"><h3>${copy.finalSounds} · ${FINAL_SOUND_EXAMPLES.length}</h3>
      <div class="pronunciation-finals">${FINAL_SOUND_EXAMPLES.map(([letter, word, reading]) => {
        const text = `<strong lang="ko">${letter}</strong><span lang="ko">${word} ${reading}</span>`;
        return audioButton(word, `${listen} ${letter} ${word} ${reading}`, `${text}<span aria-hidden="true">♫</span>`, reading);
      }).join('')}</div>
    </section>`;
}

function changes(copy: LessonCopy, listen: string): string {
  const rules = Object.keys(SOUND_CHANGE_EXAMPLES) as (keyof typeof SOUND_CHANGE_EXAMPLES)[];
  return `<h2>${copy.topics.changes}</h2>
    <p>${copy.textExamples}</p>
    <p>${copy.lengthMark}</p>
    ${rules.map(rule => {
      const [title, description] = copy.rules[rule];
      const pairs = rule === 'liaison' ? LIAISON_COMPARISONS : rule === 'hDeletion' ? H_COMPARISONS : [];
      const comparisons = pairs.length ? `<p>${rule === 'liaison' ? copy.liaisonCompare : copy.hCompare}</p><div class="controls pronunciation-contrast">
        ${pairs.map(pair => comparisonButton(pair, copy, `<span lang="ko">${pair.join(' → ')}</span>`)).join('')}
      </div>` : '';
      return `<section class="pronunciation-block"><h3>${title}</h3><p>${description}</p>${comparisons}
        ${exampleTable(SOUND_CHANGE_EXAMPLES[rule], copy, listen)}</section>`;
    }).join('')}
    <div class="helper pronunciation-practice"><p>${copy.practice}</p><details>
      <summary>${copy.reveal}</summary>${exampleTable(PRACTICE_EXAMPLES, copy, listen)}</details></div>`;
}

const TOPIC_VIEWS = {consonants, vowels, finals, changes};

export function pronunciationView(lang: Lang, topic: PronunciationTopic, repeat = false): string {
  const copy = PRONUNCIATION_COPY[lang];
  return `<section class="panel pronunciation-lesson" aria-labelledby="pronunciation-title">
    <button class="btn ghost" type="button" data-action="home">← ${t(lang, 'back')}</button>
    <h1 id="pronunciation-title" tabindex="-1">${copy.title}</h1>
    <nav class="controls pronunciation-topics" aria-label="${copy.title}">
      ${PRONUNCIATION_TOPICS.map(key => `<button class="btn${key === topic ? ' chosen' : ''}" type="button"
        data-action="pronunciation-topic" data-value="${key}" aria-pressed="${key === topic}">${copy.topics[key]}</button>`).join('')}
    </nav>
    <div class="controls pronunciation-listening">
      <button class="btn${repeat ? ' chosen' : ''}" data-action="pronunciation-repeat" type="button"
        aria-pressed="${repeat}">${copy.repeatThree}</button>
      <button class="btn" data-action="pronunciation-stop" type="button">${copy.stopListening}</button>
    </div>
    <div class="pronunciation-content">${TOPIC_VIEWS[topic](copy, t(lang, 'speech'))}</div>
    <p class="pronunciation-source"><a href="https://www.korean.go.kr/kornorms/m/m_regltn.do?regltn_code=0002"
      target="_blank" rel="noopener noreferrer">${copy.source}</a> · <a href="/audio/ko/pronunciation/sources.html"
      target="_blank" rel="noopener noreferrer">${copy.recordingSources}</a></p>
    <p class="notice warn pronunciation-audio-status" id="tts-status" role="status"></p>
  </section>`;
}
