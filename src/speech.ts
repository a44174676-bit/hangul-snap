/** Pre-recorded Korean pronunciation clips.
 * Korean voice synthesis must not be a prerequisite for supported lessons.
 * Durations are provider timestamp estimates; QA against original audio is needed.
 */
export interface AudioClip { path:string;start:number;end:number; }
const JAMO_NAMES=['기역','니은','디귿','리을','미음','비읍','시옷','이응','아','어','오','우','으','이'] as const;
const JAMO_TIMES:[[number,number],...[number,number][]]=[[0.3518,0.9541],[1.2553,1.8576],[2.1588,2.7612],[3.0624,3.7647],[4.1165,4.7682],[5.0694,5.6224],[5.8729,6.5259],[6.7765,7.2282],[7.3788,8.2071],[8.4835,9.0353],[9.2859,9.8388],[10.2400,10.3400],[10.3906,10.6918],[10.8929,11.1611]];
const WORDS=['가방','가수','고기','나무','나라','노래','다리','도시','바다','라면','모자','마음','비누','사과','시계','우유','아이','어서','서울','언어','구두','으뜸','그림','기름'] as const;
const WORD_TIMES:[[number,number],...[number,number][]]=[[0.4012,0.9541],[1.1541,1.7071],[1.9071,2.4600],[2.6600,3.3635],[3.6647,4.3671],[4.7188,5.3212],[5.5212,6.0482],[6.2247,6.9024],[7.1776,7.7553],[7.9812,8.7847],[9.1859,9.7129],[9.8882,10.4659],[10.6918,11.1435],[11.2941,11.8459],[11.9965,12.5741],[12.7494,13.2012],[13.3518,14.0047],[14.1553,14.6576],[14.8082,15.3094],[15.5106,16.0129],[16.2129,16.7153],[16.8659,17.4176],[17.5682,18.0706],[18.2212,18.5623]];
const clips=new Map<string,AudioClip>();
for(let i=0;i<JAMO_NAMES.length;i++){
 const [start,end]=JAMO_TIMES[i]!;
 clips.set(JAMO_NAMES[i]!,{path:'https://resource2.heygen.ai/text_to_speech/2eb500cb33a14682aca6899f36193460/02733a92a0db457aadf63b235d2aa457/id=d4e34dcb-8c95-4013-b734-cfbafbe95e88.wav',start:Math.max(0,start-.055),end:end+.04});
}
for(let i=0;i<WORDS.length;i++){
 const [start,end]=WORD_TIMES[i]!;
 clips.set(WORDS[i]!,{path:'https://resource2.heygen.ai/text_to_speech/2eb500cb33a14682aca6899f36193460/02733a92a0db457aadf63b235d2aa457/id=d29b8389-8c39-4130-ad0e-bfe995dfca03.wav',start:Math.max(0,start-.055),end:end+.04});
}
export function recordedClip(text:string):AudioClip|null{return clips.get(text.normalize('NFC').trim())||null;}
export function recordingCount():number{return clips.size;}
let active:HTMLAudioElement|null=null;
let activeInterval:number|undefined;
function stopActive(){
 if(activeInterval!==undefined){clearInterval(activeInterval);activeInterval=undefined;}
 if(active){active.pause();active.removeAttribute('src');active.load();active=null;}
}
export function stopSpeech():void{
 stopActive();
 if(typeof window!=='undefined' && 'speechSynthesis' in window)window.speechSynthesis.cancel();
}
async function fromRecording(clip:AudioClip):Promise<void>{
 const audio=new Audio(clip.path);
 active=audio; audio.preload='auto';
 try{
  await new Promise<void>((resolve,reject)=>{
   if(audio.readyState>=1){resolve();return;}
   audio.addEventListener('loadedmetadata',()=>resolve(),{once:true});
   audio.addEventListener('error',()=>reject(new Error('recording-unavailable')),{once:true});
   audio.load();
  });
  if(!Number.isFinite(audio.duration)||audio.duration<clip.end-.25)throw new Error('recording-incomplete');
  audio.currentTime=clip.start;
  await audio.play();
  activeInterval=window.setInterval(()=>{
    if(audio.currentTime>=clip.end||audio.ended||audio.error){stopActive();}
  },35);
 }catch(err){
  if(active===audio)stopActive();
  throw err;
 }
}
function synthSpeech(text:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){reject(new Error('tts-unavailable'));return;}
  const synth=window.speechSynthesis;
  const utter=new SpeechSynthesisUtterance(text);
  utter.lang='ko-KR';utter.rate=.85;utter.volume=1;
  const voices=synth.getVoices();
  const korean=voices.find(v=>v.lang.toLowerCase().replace(/_/g,'-')==='ko-kr') || voices.find(v=>v.lang.toLowerCase().replace(/_/g,'-').startsWith('ko'));
  if(korean)utter.voice=korean;
  let started=false,settled=false;
  const settle=(ok:boolean)=>{
   if(settled)return;settled=true;clearTimeout(watchdog);
   if(ok)resolve();else{ synth.cancel();reject(new Error('tts-playback-failed')); }
  };
  utter.onstart=()=>{started=true;settle(true);};
  utter.onerror=()=>settle(false);
  const watchdog=window.setTimeout(()=>{if(!started)settle(false);},2700);
  try{synth.cancel();synth.speak(utter);}
  catch{settle(false);}
 });
}
/** UTF-8 filenames URL-encoded by the browser; no static file yet means quick fallback. */
export function selfHostedAudioPath(text:string):string {
 return '/audio/ko/'+encodeURIComponent(text.normalize('NFC').trim())+'.mp3';
}
async function fromLocalAudio(text:string):Promise<void>{
 const audio=new Audio(selfHostedAudioPath(text));active=audio;audio.preload='auto';
 try {await audio.play();} catch(err){if(active===audio)stopActive();throw err;}
}
const INITIAL=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
const MEDIAL=['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const FINAL=['','k','k','ks','n','nj','nh','t','l','lk','lm','lb','ls','lt','lp','lh','m','p','ps','t','t','ng','t','t','k','t','p','h'];
const NAMED:Record<string,string>={기역:'gi-yeok',니은:'ni-eun',디귿:'di-geut',리을:'ri-eul',미음:'mi-eum',비읍:'bi-eup',시옷:'si-ot',이응:'i-eung'};
export function pronunciationGuide(text:string):string{
 const value=text.normalize('NFC').trim();if(NAMED[value])return NAMED[value];
 return [...value].map(c=>{const n=c.charCodeAt(0)-0xac00;
  if(n<0||n>=11172)return c;
  return (INITIAL[Math.floor(n/588)]||'')+(MEDIAL[Math.floor((n%588)/28)]||'')+(FINAL[n%28]||'');
 }).join('-');
}
/** Self-hosted recording → existing hosted recording → speechSynthesis. */
export async function speakKorean(text:string):Promise<'local'|'recording'|'device'>{
 stopSpeech();
 try{await fromLocalAudio(text);return 'local';}catch{/* missing local file, proceed */}
 const clip=recordedClip(text);
 if(clip){try{await fromRecording(clip);return 'recording';}catch{/* device backup */}}
 await synthSpeech(text);
 return 'device';
}
