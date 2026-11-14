import {isHorizontalVowel} from './jamo-letters.js';
import type {Jamo} from './types.js';

export interface MissionSyllable{onset:Jamo;vowel:Jamo;final?:Jamo;result:string}
export interface LearningMission{word:string;meaningVi:string;syllables:readonly MissionSyllable[]}
export const BRAND_WORD='한글세끼';
const hangul=[
 {onset:'ㅎ',vowel:'ㅏ',final:'ㄴ',result:'한'},
 {onset:'ㄱ',vowel:'ㅡ',final:'ㄹ',result:'글'}
] as const;
const sekki=[
 {onset:'ㅅ',vowel:'ㅔ',result:'세'},
 {onset:'ㄲ',vowel:'ㅣ',result:'끼'}
] as const;
export const MISSIONS:LearningMission[]=[
{word:'한글',meaningVi:'Chữ Hàn',syllables:hangul},
{word:'세끼',meaningVi:'Ba bữa',syllables:sekki},
{word:BRAND_WORD,meaningVi:'SEKKI',syllables:[...hangul,...sekki]},
{word:'나무',meaningVi:'Cây',syllables:[{onset:'ㄴ',vowel:'ㅏ',result:'나'},{onset:'ㅁ',vowel:'ㅜ',result:'무'}]},
{word:'고기',meaningVi:'Thịt',syllables:[{onset:'ㄱ',vowel:'ㅗ',result:'고'},{onset:'ㄱ',vowel:'ㅣ',result:'기'}]},
{word:'바다',meaningVi:'Biển',syllables:[{onset:'ㅂ',vowel:'ㅏ',result:'바'},{onset:'ㄷ',vowel:'ㅏ',result:'다'}]},
{word:'아이',meaningVi:'Em bé',syllables:[{onset:'ㅇ',vowel:'ㅏ',result:'아'},{onset:'ㅇ',vowel:'ㅣ',result:'이'}]}];
export interface MissionLog{missionWord:string;isFirstTrySuccess:boolean;correctionCount:number;completionTimeMs:number;inputMode:'manual'|'camera'|'upload';timestamp:string}
export const MISSION_LOG_KEY='hangul_snap_mission_logs';
export function appendMissionLog(log:MissionLog,storage?:Pick<Storage,'getItem'|'setItem'>):boolean{
 try{const s=storage??(typeof localStorage==='undefined'?null:localStorage);if(!s)return false;
 const old=s.getItem(MISSION_LOG_KEY);let parsed:unknown=[];try{parsed=old?JSON.parse(old):[]}catch{parsed=[];}
 const items=Array.isArray(parsed)?parsed.slice(-99):[];items.push(log);
 s.setItem(MISSION_LOG_KEY,JSON.stringify(items));return true;}catch{return false}
}
export function missionBreakdown(m:LearningMission):{formula:string;position:'right'|'below'}[]{
 return m.syllables.map(s=>({
  formula:[s.onset,s.vowel,s.final].filter(Boolean).join(' + ')+' → '+s.result,
  position:isHorizontalVowel(s.vowel)?'below':'right'
 }));
}
