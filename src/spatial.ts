import type {BBox, Candidate, ComposeRequest, ComposeResponse, DetectedObject, Jamo, Slot, SyllableCell} from './types.js';
import {CONSONANTS,LOCAL_LEXICON,VOWELS} from './jamo-data.js';
const L='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const V='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const T=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export const EMPTY=():SyllableCell=>({L:null,V:null,T:null});
export function composeCell(cell:SyllableCell):string|null{
 if(!cell.L||!cell.V)return null;
 const l=L.indexOf(cell.L),v=V.indexOf(cell.V),t=T.indexOf(cell.T||'');
 if(l<0||v<0||t<0)return null;
 return String.fromCharCode(0xac00+588*l+28*v+t);
}
export const composeCells=(cells:SyllableCell[]):{text:string;valid:boolean;syllables:string[]}=>{
 const syllables=cells.map(c=>composeCell(c)||'');
 return {text:syllables.join(''),valid:syllables.length>0&&syllables.every(Boolean),syllables};
};
/** Preview cell layout: two 2D Korean syllable cells, each 500 x 1000 coordinate units. */
export function bboxFor(cell:number,slot:Slot,jamo:Jamo,cellCount=2):BBox{
 const w=1000/cellCount,ox=w*cell;const vertical=['ㅏ','ㅓ','ㅣ'].includes(jamo);
 if(slot==='L')return [ox+w*.14,200,w*.30,280];
 if(slot==='T')return [ox+w*.25,750,w*.44,135];
 return vertical?[ox+w*.55,190,w*.30,300]:[ox+w*.22,555,w*.57,145];
}
export function objectsFromCells(cells:SyllableCell[]):DetectedObject[]{
 return cells.flatMap((c,i)=>(['L','V','T'] as Slot[]).flatMap(slot=>c[slot]?[{id:`manual-${i}-${slot}`,bbox:bboxFor(i,slot,c[slot]!,cells.length),topK:[{jamo:c[slot]!,confidence:1}],correctedJamo:c[slot]!,correctedSlot:slot,correctedCell:i}]:[]));
}
const center=(b:BBox)=>({x:b[0]+b[2]/2,y:b[1]+b[3]/2});
const selectedJamo=(o:DetectedObject,choice=0):Jamo|undefined=>o.correctedJamo||o.topK[choice]?.jamo||o.topK[0]?.jamo;
export function cellForObject(object:DetectedObject, cellCount:number):number {
 const cell=object.correctedCell??object.trayCell;
 if(cell!==undefined&&cell>=0&&cell<cellCount)return cell;
 return Math.min(cellCount-1,Math.max(0,Math.floor(center(object.bbox).x*cellCount/1000)));
}
function slotForObject(object:DetectedObject,jamo:Jamo,consonants:DetectedObject[]):Slot {
 if(object.correctedSlot)return object.correctedSlot;
 if(object.traySlot)return object.traySlot;
 if(VOWELS.includes(jamo))return 'V';

 // For legacy detections without tray positions, compare the consonants in
 // the same syllable. The tray may occupy any vertical part of the photo.
 if(consonants.length===2){
  const [upper,lower]=[...consonants].sort((a,b)=>center(a.bbox).y-center(b.bbox).y) as [DetectedObject,DetectedObject];
  const distance=center(lower.bbox).y-center(upper.bbox).y;
  if(distance>=Math.max(40,Math.min(upper.bbox[3],lower.bbox[3])*.45)){
   if(object===lower&&upper.correctedSlot!=='T'&&upper.traySlot!=='T')return 'T';
   if(object===upper&&lower.correctedSlot!=='L'&&lower.traySlot!=='L')return 'L';
  }
 }
 return center(object.bbox).y>685?'T':'L';
}
export function mergeAdjustments(objects:DetectedObject[],adjustments?:DetectedObject[]):DetectedObject[]{
 if(!Array.isArray(adjustments))return objects;
 const edits=new Map(adjustments.filter(item=>item&&typeof item.id==='string').map(item=>[item.id,item]));
 return objects.map(object=>{
  const edit=edits.get(object.id);
  if(!edit)return object;
  return {
   ...object,
   ...('correctedJamo' in edit?{correctedJamo:edit.correctedJamo}:{}),
   ...('correctedSlot' in edit?{correctedSlot:edit.correctedSlot}:{}),
   ...('correctedCell' in edit?{correctedCell:edit.correctedCell}:{}),
  };
 });
}
function layout(objects:DetectedObject[],cellCount:number,changed?:{id:string;jamo:Jamo}):{cells:SyllableCell[],valid:boolean,confidence:number,warnings:string[]}{
 const cells=Array.from({length:cellCount},EMPTY),warnings:string[]=[];
 const entries=objects.map(object=>({
  object,
  jamo:changed?.id===object.id?changed.jamo:selectedJamo(object),
  cell:cellForObject(object,cellCount)
 }));
 let confidence=0;let valid=true;
 for(const {object:o,jamo:j,cell:cellIdx} of entries){
  if(!j){valid=false;continue;}
  const consonants=entries.filter(entry=>entry.cell===cellIdx&&entry.jamo&&CONSONANTS.includes(entry.jamo)).map(entry=>entry.object);
  const slot=slotForObject(o,j,consonants);
  if(slot==='L'&&!CONSONANTS.includes(j)||slot==='V'&&!VOWELS.includes(j)||slot==='T'&&!CONSONANTS.includes(j)){valid=false;warnings.push(`slot-mismatch:${o.id}`);continue;}
  if(cells[cellIdx]![slot]){valid=false;warnings.push(`slot-conflict:${o.id}`);continue;}
  cells[cellIdx]![slot]=j;
  const p=(changed&&changed.id===o.id)?o.topK.find(k=>k.jamo===j)?.confidence ?? .2:o.topK.find(k=>k.jamo===j)?.confidence ?? 1;
  confidence+=p;
 }
 return {cells,valid,confidence:objects.length?confidence/objects.length:0,warnings};
}
function makeCandidate(objects:DetectedObject[],n:number,changed?:{id:string;jamo:Jamo}):Candidate & {cells:SyllableCell[]} {
 const r=layout(objects,n,changed),composed=composeCells(r.cells);
 const inDict=LOCAL_LEXICON.has(composed.text);
 const visualScore=r.confidence;
 const layoutScore=r.valid&&composed.valid?1:0;
 const grammarScore=composed.valid?1:0;
 const dictionaryScore=inDict?1:0;
 // Weights are a heuristic, NOT measured or patented effect.
 const score=Number((.55*visualScore+.20*layoutScore+.15*grammarScore+.10*dictionaryScore).toFixed(3));
 return {text:composed.text,score,syllables:composed.syllables,isInDictionary:inDict,autoCorrected:false,originalText:composed.text,valid:r.valid&&composed.valid,cells:r.cells};
}
export function composeSpatial(input:ComposeRequest):ComposeResponse {
 const objects=mergeAdjustments(input.objects,input.userAdjustments).slice(0,18);
 const cellCount=Math.max(1,Math.min(4,Math.trunc(input.cellCount||2)));
 const original=makeCandidate(objects,cellCount);
 const candidates=[original];
 for(const obj of objects){
  if(obj.correctedJamo)continue;
  for(const alt of obj.topK.slice(1,3)){
   const candidate=makeCandidate(objects,cellCount,{id:obj.id,jamo:alt.jamo});
   if(candidate.valid&&!candidates.some(c=>c.text===candidate.text))candidates.push(candidate);
  }
 }
 // NEVER automatically mutate the primary recognition, even for lexicon matches.
 const suggestions=candidates.slice(1).filter(c=>c.valid).sort((a,b)=>b.score-a.score).slice(0,2);
 const all=[original,...suggestions].map(({cells:unused,...rest})=>({...rest,originalText:original.text}));
 const warningList:string[]=[];
 if(!original.valid)warningList.push('incomplete-or-conflicting-layout');
 if(objects.length===0)warningList.push('no-objects');
 return {wordCandidates:all,requiresConfirmation:true,originalText:original.text,warnings:warningList,cells:original.cells};
}
/** Normalizes camera boxes. This is conservative; the caller must still ask for confirmation. */
export function normalizeObjects(values:unknown):DetectedObject[]{
 if(!Array.isArray(values))return [];
 return values.slice(0,20).map((o:any,i:number)=>{
  const numbers=(Array.isArray(o?.bbox)?o.bbox:[0,0,0,0]).slice(0,4).map((n:unknown)=>Number(n));
  if(numbers.length!==4||numbers.some((n:number)=>!Number.isFinite(n)||n<0))return null;
  const [x,y,w,h]=numbers as BBox;
  if(w<=0||h<=0||x+w>1000||y+h>1000)return null;
  const box:BBox=[x,y,w,h];
  const topK=(Array.isArray(o?.topK)?o.topK:[]).filter((v:any)=>v&&(CONSONANTS.includes(v.jamo)||VOWELS.includes(v.jamo))&&Number.isFinite(Number(v.confidence))).slice(0,3).map((v:any)=>({jamo:v.jamo as Jamo,confidence:Math.max(0,Math.min(1,Number(v.confidence)))}));
  return topK.length?{
   id:String(o?.id||`object-${i}`).slice(0,48),bbox:box,topK,
   ...([0,1].includes(o?.trayCell)?{trayCell:o.trayCell}:{}),
   ...(['L','V','T'].includes(o?.traySlot)?{traySlot:o.traySlot}:{}),
   ...(CONSONANTS.includes(o?.correctedJamo)||VOWELS.includes(o?.correctedJamo)?{correctedJamo:o.correctedJamo}:{}),
   ...(['L','V','T'].includes(o?.correctedSlot)?{correctedSlot:o.correctedSlot}:{}),
   ...(Number.isInteger(o?.correctedCell)&&o.correctedCell>=0&&o.correctedCell<4?{correctedCell:o.correctedCell}:{})
  }:null;
 }).filter((o:DetectedObject|null):o is DetectedObject=>o!==null);
}
