import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MISSIONS,appendMissionLog,missionBreakdown,MISSION_LOG_KEY} from '../site/js/missions.js';
import {pronunciationGuide,selfHostedAudioPath,recordedClip} from '../site/js/speech.js';
const html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../site/js/main.js',import.meta.url),'utf8');
test('four CV-only basic14 mission pairs',()=>{assert.deepEqual(MISSIONS.map(m=>m.word),['나무','고기','바다','아이']);assert.ok(MISSIONS.every(m=>m.syllables.length===2));});
test('syllable geometry explains right vs below correctly',()=>{assert.deepEqual(missionBreakdown(MISSIONS[0]).map(x=>x.position),['right','below']);assert.deepEqual(missionBreakdown(MISSIONS[0]).map(x=>x.formula),['ㄴ + ㅏ → 나','ㅁ + ㅜ → 무']);});
test('anonymous local telemetry capped at 100 records and resilient to corrupt state',()=>{
const s={m:new Map(),getItem(k){return this.m.get(k)||null},setItem(k,v){this.m.set(k,v)}};
const x={missionWord:'나무',isFirstTrySuccess:true,correctionCount:0,completionTimeMs:4200,inputMode:'manual',timestamp:'2026-10-29T00:00:00.000Z'};
for(let i=0;i<105;i++)assert.equal(appendMissionLog(x,s),true);
assert.equal(JSON.parse(s.getItem(MISSION_LOG_KEY)).length,100);
assert.deepEqual(Object.keys(JSON.parse(s.getItem(MISSION_LOG_KEY))[0]).sort(),Object.keys(x).sort());
s.setItem(MISSION_LOG_KEY,'invalid');assert.equal(appendMissionLog(x,s),true);});
test('speech local path and romanization',()=>{
assert.equal(selfHostedAudioPath('나무'),'/audio/ko/'+encodeURIComponent('나무')+'.mp3');assert.equal(pronunciationGuide('나무'),'na-mu');assert.ok(recordedClip('나무'));});
test('OG + mobile fallback + mission handlers in built output',()=>{
for(const x of ['og:title','og:description','twitter:card','HANMO_FINAL_CENTERED_512.png'])assert.ok(html.includes(x));
for(const x of ['camera-fallback-upload','camera-fallback-manual','mission-target','appendMissionLog','speech-visual-assist'])assert.ok(app.includes(x));});
