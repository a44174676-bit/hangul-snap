import {CAPTURE_COPY} from './capture-copy.js';
import {speakKorean,stopSpeech,pronunciationGuide} from './speech.js';
import {MISSIONS,appendMissionLog,missionBreakdown} from './missions.js';
import {translationFor,soundFor} from './vocabulary.js';
import type {AppState,DictionaryResponse,Jamo,Lang,Slot} from './types.js';
import {SETS,JAMO,CONSONANTS,VOWELS,EXAMPLES,LESSONS} from './jamo-data.js';
import {t} from './i18n.js';
import {cellForObject,composeCells,composeSpatial,objectsFromCells,EMPTY,normalizeObjects} from './spatial.js';
import {recognize,compose,lookup} from './api.js';
const APP_NAME = '한끼 HANKKI';
const root=document.getElementById('app')!;
const qp=new URLSearchParams(location.search);const rawSet=qp.get('set');
const supportedLanguages:Lang[]=['vi','ko','en','ja','zh'];
function preferredLanguage():Lang {
 const requested=qp.get('lang') as Lang|null;
 if(requested&&supportedLanguages.includes(requested))return requested;
 try{
  const saved=localStorage.getItem('hs:language') as Lang|null;
  if(saved&&supportedLanguages.includes(saved))return saved;
 }catch{/* storage may be blocked */}
 return 'vi';
}
const initialLang=preferredLanguage();
const validSet=rawSet&&Object.prototype.hasOwnProperty.call(SETS,rawSet)?rawSet:'basic14';
const state:AppState={lang:initialLang,setId:validSet,step:'choose',mode:'single',inputTab:'camera',recognitionTarget:'pieces',photo:null,objects:[],cells:[EMPTY(),EMPTY()],cellCount:2,selectedCell:0,selectedSlot:'L',selectedJamo:'ㄱ',recognized:false,candidates:[],originalText:'',selectedText:'',dict:null,statusMessage:'',notice:(rawSet&&rawSet!==validSet)?'badSet':'',busy:false};
let returnStage:AppState['step']='choose';
let selectedMission:string|null=null;
let missionStartedAt=0,missionAttempts=0,missionCorrections=0,missionCompleted=false;
let lastInputMode:'manual'|'camera'|'upload'='manual';
let cameraFallback=false;
let media:MediaStream|null=null;
let toastTimeout:ReturnType<typeof setTimeout>|null=null;
let cameraOpening=false;
let cameraRequest=0;
let requestVersion=0;
let recognitionAbort:AbortController|null=null;
let captureError='';
let printedText='';
let dictionaryBack:'candidates'|'printedReview'='candidates';
const say=(key:string)=>t(state.lang,key);
const captureCopy=()=>CAPTURE_COPY[state.lang];
const esc=(x:unknown)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
const percent=(v:number)=>`${Math.round(v*100)}%`;
const sv=(x:string)=>`data-action="${x}"`;
function toast(msg:string){state.statusMessage=msg;const el=document.getElementById('toast');if(el){el.textContent=msg;el.hidden=false;}if(toastTimeout)clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{const e=document.getElementById('toast');if(e)e.hidden=true;},4600);}
function changeURL(){const u=new URL(location.href);u.searchParams.set('lang',state.lang);u.searchParams.set('set',state.setId);history.replaceState(null,'',u);}
function stopCam(){
 cameraRequest++;
 cameraOpening=false;
 for(const track of media?.getTracks()||[])track.stop();
 media=null;
}
function cancelPending(){
 requestVersion++;
 recognitionAbort?.abort();
 recognitionAbort=null;
 state.busy=false;
}
function resetImage(){
 cancelPending();
 stopCam();
 state.photo=null;
 state.objects=[];
 state.recognized=false;
 state.candidates=[];
 state.selectedText='';
 state.originalText='';
 state.dict=null;
 captureError='';
 printedText='';
}
function setStage(step:AppState['step']){
 if(step!==state.step)stopSpeech();
 if(step!=='capture')stopCam();
 state.step=step;
 window.scrollTo({top:0,behavior:'instant'});
 render();
}
const top=()=>`<header class="topbar"><div class="brand-cluster"><a class="parent-brand" href="https://vr-meditour.com/" target="_blank" rel="noopener noreferrer" aria-label="VR MEDI TOUR & HOME 기업 홈페이지"><span class="parent-mark">VR</span><span><span class="parent-name">VR MEDI TOUR <strong>& HOME</strong></span><span class="parent-caption">OFFICIAL COMPANY PLATFORM</span></span></a><span class="brand-divider" aria-hidden="true"></span><a href="/?set=${encodeURIComponent(state.setId)}&lang=${state.lang}" class="brand" data-action="home"><span class="mark">한</span><span><span class="brand-title">${APP_NAME}</span><br/><span class="brand-sub">A VR MEDI TOUR & HOME LEARNING SERVICE</span></span></a></div><div class="bar-actions"><span class="set-badge" title="basic14">${esc(say('setLabel'))}: ${esc(say('basic14'))} (${esc(state.setId)})</span><button class="btn small" data-action="help" title="${say('help')}">?</button><label class="lang-control"><span class="visually-hidden">${say('switch')}</span><select aria-label="Language / 언어 선택" data-language-select><option value="vi" ${state.lang==='vi'?'selected':''}>🇻🇳 Tiếng Việt</option><option value="ko" ${state.lang==='ko'?'selected':''}>🇰🇷 한국어</option><option value="en" ${state.lang==='en'?'selected':''}>🇬🇧 English</option><option value="ja" ${state.lang==='ja'?'selected':''}>🇯🇵 日本語</option><option value="zh" ${state.lang==='zh'?'selected':''}>🇨🇳 中文</option></select></label></div></header>`;
const hanmo=(mood:'welcome'|'success'|'thinking',message:string)=>`<aside class="hanmo-guide" aria-label="HANMO Korean tutor"><img src="/assets/hanmo/${mood}.svg" alt="한모" width="90" height="112" loading="lazy"/><div class="hanmo-guide-text"><b>HANMO · 한모</b><p>${esc(message)}</p></div></aside>`;
const hanmoLine=(key:'welcome'|'success'|'thinking')=>({welcome:{ko:'한 조각으로 시작해 볼까요?',vi:'Bắt đầu với một miếng chữ nhé!',en:'Ready to learn your first Hangul piece?',ja:'一つのハングルから始めましょう！',zh:'从一个韩文字母开始吧！'},success:{ko:'좋아요! 글자의 이름과 발음을 확인해 보세요.',vi:'Tốt lắm! Hãy xem tên và nghe cách phát âm.',en:'Great! Check the letter name and pronunciation.',ja:'よくできました！文字の名前と発音を確認しましょう。',zh:'做得好！看看字母名称并听发音吧。'},thinking:{ko:'다른 후보도 확인해 볼까요? 원래 인식 결과도 유지할 수 있어요.',vi:'Hãy kiểm tra các lựa chọn khác. Bạn cũng có thể giữ kết quả ban đầu.',en:'Check alternative candidates. You can keep the original recognition.',ja:'ほかの候補も確認できます。元の認識結果を残せます。',zh:'可以查看其他候选，也可以保留原始识别结果。'}}[key][state.lang]);
const progress=()=>{const n=state.step==='choose'?0:state.step==='capture'?1:state.step==='singleResult'||state.step==='candidates'?2:3;return `<div class="step-indicator" aria-label="${say('step')} ${n+1}">${[0,1,2,3].map(i=>`<span class="${i<=n?'active':''}"></span>`).join('')}</div>`};
function mainChoose(){return `<div class="hero-mini"><span class="eyebrow" style="color:#e8b980">VR MEDI TOUR & HOME · LEARNING APP</span><h1>${say('title')}</h1><p>${say('tagline')} · ${say('download')}</p></div>${hanmo('welcome',hanmoLine('welcome'))}<section aria-label="${say('home')}"><div class="mode-grid"><button class="mode" data-action="mode" data-value="single"><span class="glyph">ㄱ</span><h3>${say('single')} ↗</h3><p>${say('singleDesc')}</p></button><button class="mode" data-action="mode" data-value="word"><span class="glyph">가</span><h3>${say('word')} ↗</h3><p>${say('wordDesc')}</p></button></div></section><details class="helper"><summary>${say('help')}</summary><p>1. QR / 2. ${say('single')} · ${say('word')} / 3. ${say('capture')} · ${say('manual')}</p></details>`;}
function cameraGuide(){
 if(state.mode==='word'&&state.recognitionTarget==='printed')return '';
 const positionLabels=['L','V','T'].map(slot=>`<span class="guide-slot ${slot.toLowerCase()}">${say('slot'+slot)}</span>`).join('');
 return `<div class="camera-guide ${state.mode}" aria-hidden="true">
  <span class="top-marker">▲ TOP · ${say('top')}</span>
  ${state.mode==='single'?'<div class="roi"></div>':`<div class="guide-grid">${[0,1].map(()=>`<div class="guide-cell">${positionLabels}</div>`).join('')}</div>`}
 </div>`;
}
function detectionOverlay(){
 return `<div class="detection-layer">${state.objects.map((object,index)=>{
  const [x,y,w,h]=object.bbox;
  const label=object.correctedJamo||object.topK[0]?.jamo||'?';
  return `<button class="detected" style="left:${x/10}%;top:${y/10}%;width:${w/10}%;height:${h/10}%"
   data-action="focus-object" data-value="${index}" aria-label="${esc(label)} ${index+1}"><span>${esc(label)}</span></button>`;
 }).join('')}</div>`;
}
function photoFrame(review=false){
 if(!state.photo&&state.inputTab==='upload')return `<p class="hint">${captureCopy().uploadReady}</p>`;
 const showDetections=state.recognized&&state.objects.length>0;
 const showGuide=!review&&!showDetections;
 const mediaView=state.photo
  ? `<img alt="${captureCopy().photo}" src="${state.photo}"/>`
  : '<video id="camera-video" autoplay playsinline muted></video>';
 return `<div class="camera-wrap" id="camera-frame">
  ${mediaView}
  <div class="camera-image-area">${showGuide?cameraGuide():''}${showDetections?detectionOverlay():''}</div>
 </div>`;
}
function attachCameraFrame(){
 const frame=root.querySelector<HTMLElement>('#camera-frame');
 const layer=frame?.querySelector<HTMLElement>('.camera-image-area');
 const preview=frame?.querySelector<HTMLImageElement|HTMLVideoElement>('img,video');
 if(!frame||!layer||!preview)return;
 const align=()=>{
  const isVideo=preview instanceof HTMLVideoElement;
  const width=isVideo?preview.videoWidth:preview.naturalWidth;
  const height=isVideo?preview.videoHeight:preview.naturalHeight;
  if(!width||!height)return;
  const scale=Math.min(frame.clientWidth/width,frame.clientHeight/height);
  layer.style.width=`${width*scale}px`;
  layer.style.height=`${height*scale}px`;
 };
 const observer=new ResizeObserver(align);
 cameraFrameObserver=observer;
 observer.observe(frame);
 if(preview instanceof HTMLVideoElement){
  preview.addEventListener('loadedmetadata',align);
  preview.addEventListener('resize',align);
  if(media)preview.srcObject=media;
 }else preview.addEventListener('load',align);
 align();
}
let cameraFrameObserver:ResizeObserver|null=null;
const grid=(jamo:Jamo[],action:string,selected:Jamo|null)=>`<div class="jamo-grid">${jamo.map(j=>`<button data-action="${action}" data-value="${j}" class="${selected===j?'active':''}" aria-label="${j}">${j}</button>`).join('')}</div>`;
function missionStrip():string {
 const m=MISSIONS.find(x=>x.word===selectedMission);
 const chips=MISSIONS.map(x=>`<button class="mission-chip" data-action="example" data-value="${x.word}" aria-pressed="${selectedMission===x.word}">${x.word}<small>${x.meaningVi}</small></button>`).join('');
 return `<section class="mission-strip"><h3>${state.lang==='vi'?'Nhiệm vụ ghép chữ':'한글 조합 미션'}</h3><div class="mission-chips">${chips}</div>${m?`<div class="mission-target" id="mission-target">${state.lang==='vi'?'Nhiệm vụ':'미션'}: ${m.meaningVi} (${m.word}) · 2 ${state.lang==='vi'?'âm tiết':'음절'}</div>`:''}</section>`;
}
function cameraFallbackUi():string {
 if(!cameraFallback)return '';
 return `<section class="camera-fallback" role="alert"><h3>${state.lang==='vi'?'Không thể mở camera trực tiếp trong trình duyệt này.':'현재 브라우저에서 카메라를 열 수 없습니다.'}</h3><p>${state.lang==='vi'?'Nhấn vào biểu tượng [⋯] ở góc trên bên phải và chọn "Mở bằng trình duyệt" (Chrome / Safari).':'오른쪽 상단 메뉴에서 Chrome 또는 Safari로 열어 주세요.'}</p><p>${state.lang==='vi'?'Hoặc bạn có thể tải ảnh chụp sẵn lên / chuyển sang chế độ ghép chữ thủ công ngay bên dưới.':'사진을 업로드하거나 수동 조합 모드로 학습할 수 있습니다.'}</p><div class="controls"><label class="btn" for="camera-fallback-upload">${state.lang==='vi'?'📷 Tải ảnh lên':'📷 사진 찍어 올리기'}</label><input id="camera-fallback-upload" type="file" accept="image/*" capture="environment" hidden/><button class="btn primary" data-action="camera-fallback-manual">${state.lang==='vi'?'🧩 Ghép chữ thủ công':'🧩 수동 조합으로 시작'}</button></div></section>`;
}
function manualWord(){const cells=state.cells;const preview=composeCells(cells);return `<div><h3>${say('manualReady')}</h3><p class="hint">${say('chooseCell')} → ${say('chooseSlot')} → ${say('manual')}</p><div class="cell-layout">${cells.map((c,i)=>`<div class="syllable ${state.selectedCell===i?'current':''}"><div class="cell-label">${say('chooseCell')} ${i+1}</div><div class="layout final"><button class="l ${state.selectedCell===i&&state.selectedSlot==='L'?'active':''}" data-action="slot" data-value="${i}:L" aria-label="${say('slotL')}">${c.L||'＋'}</button><button class="v ${c.V&&['ㅗ','ㅜ','ㅡ'].includes(c.V)?'horizontal':''} ${state.selectedCell===i&&state.selectedSlot==='V'?'active':''}" data-action="slot" data-value="${i}:V" aria-label="${say('slotV')}">${c.V||'＋'}</button><button class="t ${state.selectedCell===i&&state.selectedSlot==='T'?'active':''}" data-action="slot" data-value="${i}:T" aria-label="${say('slotT')}">${c.T||'＋'}</button></div></div>`).join('')}</div><div class="slot-tabs">${(['L','V','T'] as Slot[]).map(s=>`<button class="btn small ${state.selectedSlot===s?'chosen':''}" data-action="set-slot" data-value="${s}">${say('slot'+s)}</button>`).join('')}</div>${grid(state.selectedSlot==='V'?VOWELS:CONSONANTS,'insert-jamo',state.cells[state.selectedCell]?.[state.selectedSlot]||null)}<div class="preview"><div class="word">${esc(preview.syllables.map(x=>x||'□').join(''))}</div><span class="sub">${say('wordResult')}</span></div><div class="controls" style="margin-top:14px"><button class="btn" data-action="clear-cells">${say('clear')}</button><button class="btn primary" data-action="manual-compose">${say('compose')} →</button></div></div>`;}
function singleManual(){return `<div><h3>${say('singleManual')}</h3>${grid(JAMO,'select-single',state.selectedJamo)}<button class="btn primary full" data-action="show-single">${say('lesson')} →</button></div>`;}
function captureView(){
 const copy=captureCopy();
 const wordMode=state.mode==='word';
 const manual=state.inputTab==='manual';
 const usingCamera=state.inputTab==='camera';
 const description=manual?'':!wordMode?say('guideSingle'):state.recognitionTarget==='printed'?copy.printed:copy.tray;
 const cameraLabel=cameraOpening?copy.opening:media?say('capture'):state.photo?copy.retake:copy.startCamera;
 const targets=wordMode&&!manual?`<div class="recognition-target">
  <label><input type="radio" name="recognition-target" value="pieces" ${state.recognitionTarget==='pieces'?'checked':''}/> ${copy.piecesLabel}</label>
  <label><input type="radio" name="recognition-target" value="printed" ${state.recognitionTarget==='printed'?'checked':''}/> ${copy.printedLabel}</label>
 </div>`:'';
 const tabs=`<div class="tabs" role="tablist">${(['camera','upload','manual'] as const).map(tab=>`<button role="tab"
  aria-selected="${state.inputTab===tab}" class="${state.inputTab===tab?'active':''}" data-action="input-tab" data-value="${tab}">${say(tab)}</button>`).join('')}</div>`;
 const source=usingCamera
  ? `<button class="btn accent" data-action="camera-toggle" ${cameraOpening?'disabled':''}>${cameraLabel}</button>`
  : `<label class="btn upload-button" for="file-upload">${say('upload')}</label><input id="file-upload" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp"/>`;
 return `<div class="panel">
  <h2>${wordMode?say('word'):say('single')}</h2>
  ${wordMode?missionStrip():''}
  ${usingCamera?cameraFallbackUi():''}
  ${tabs}${targets}
  ${description?`<p class="hint">${description}</p>`:''}
  ${manual?(wordMode?manualWord():singleManual()):`${photoFrame()}
   <div class="controls capture-controls">${source}
    <button class="btn primary" data-action="analyze" ${!state.photo||state.busy||cameraOpening?'disabled':''}>${state.busy?say('loading'):say('analyze')}</button>
   </div>
   ${captureError?`<p class="notice warn" role="alert">${esc(recognitionMessage(captureError))}</p>`:''}
   <p class="privacy">${say('privacy')}</p>`}
  <div class="navigation"><button class="btn ghost" data-action="home">← ${say('back')}</button></div>
 </div>`;
}
function singleResult(){const l=LESSONS[state.selectedJamo],o=state.objects[0];const confidence=o?.topK[0]?.confidence;const alternatives=o?.topK.slice(1)||[];return `<div class="panel"><span class="eyebrow">S04 / ${say('lesson')}</span>${hanmo('success',hanmoLine('success'))}<div class="result-hero"><div class="jamo-icon"><span class="big-jamo">${state.selectedJamo}</span></div><div class="result-meta"><h2>${l.nameKo}</h2><small>${l.nameVi}</small><br/>${confidence!==undefined?`<span class="score">${say('confidence')} ${percent(confidence)}</span>`:`<span class="score">${say('manualReady')}</span>`}<button class="btn small" data-action="speak" data-value="${l.nameKo}">♫ ${say('speech')}</button></div></div>${alternatives.length?`<p class="hint">${say('uncertain')}</p><div class="controls">${alternatives.map(a=>`<button class="btn small" data-action="select-single" data-value="${a.jamo}">${a.jamo} (${percent(a.confidence)})</button>`).join('')}</div>`:''}<div class="details-grid"><div class="detail"><span>${say('name')}</span><p>${l.nameKo} (${l.nameVi})</p></div><div class="detail"><span>${say('onset')}</span><p>${state.lang==='ko'?l.onsetKo:state.lang==='vi'?l.onsetVi:soundFor(state.selectedJamo,state.lang,'onset')}</p></div><div class="detail"><span>${say('coda')}</span><p>${state.lang==='ko'?l.codaKo:state.lang==='vi'?l.codaVi:soundFor(state.selectedJamo,state.lang,'coda')}</p></div><div class="detail"><span>${say('sample')}</span><p>${say('sample')}</p></div></div><h3>${say('words')}</h3><div class="word-list">${l.words.map(([w,vi])=>`<div class="word-mini"><b>${w}</b><span>${esc(translationFor(w,state.lang,vi)||vi)}</span><button class="btn small" data-action="speak" data-value="${w}">♫ ${say('speech')}</button></div>`).join('')}</div><p class="hint" id="tts-status" role="status"></p><div class="controls"><button class="btn" data-action="single-retry">${say('other')}</button><button class="btn primary" data-action="home">${say('done')}</button></div></div>`;}
function objectEditor(){if(!state.objects.length)return '';return `<h3>${say('correct')}</h3><div class="bbox-list">${state.objects.map((o,i)=>`<div class="bbox-item"><label for="obj-${i}">#${i+1} · ${esc(o.id)}</label><select id="obj-${i}" data-edit-object="${i}" aria-label="${say('correct')} ${i+1}">${JAMO.map(j=>`<option value="${j}" ${(o.correctedJamo||o.topK[0]?.jamo)===j?'selected':''}>${j} ${o.topK.find(k=>k.jamo===j)?`(${percent(o.topK.find(k=>k.jamo===j)!.confidence)})`:''}</option>`).join('')}</select><div class="controls"><select aria-label="${say('chooseCell')}" data-edit-cell="${i}">${Array.from({length:state.cellCount},(_,c)=>`<option value="${c}" ${cellForObject(o,state.cellCount)===c?'selected':''}>${say('chooseCell')} ${c+1}</option>`).join('')}</select><select aria-label="${say('chooseSlot')}" data-edit-slot="${i}">${(['auto','L','V','T'] as const).map(s=>`<option value="${s}" ${(o.correctedSlot||'auto')===s?'selected':''}>${s==='auto'?'AUTO':say('slot'+s)}</option>`).join('')}</select></div></div>`).join('')}</div><button class="btn" data-action="recompose">${say('compose')}</button>`;}
function candidatesView(){const original=state.candidates[0];const suggestions=state.candidates.slice(1);return `<div class="panel"><span class="eyebrow">S06 / ${say('candidates')}</span><h2>${say('wordResult')}</h2><p class="hint">${say('uncertain')}</p>${hanmo('thinking',hanmoLine('thinking'))}${state.photo&&state.recognized?photoFrame(true):''}<div class="candidate-list">${original?`<div class="candidate original"><div><p>${say('keep')}</p><b>${esc(original.text||'□')}</b><p>${state.lang==='ko'?'상대점수(실험용)':'Điểm tương đối (thử nghiệm)'}: ${percent(original.score)} · ${say('localIndex')}: ${original.isInDictionary?'✓':'–'}</p></div><button class="btn primary" data-action="choose-word" data-value="0" ${!original.valid?'disabled':''}>${say('keep')}</button></div>`:''}${suggestions.map((c,i)=>`<div class="candidate"><div><p>${say('suggestion')} ${i+1}</p><b>${esc(c.text)}</b><p>${state.lang==='ko'?'상대점수(실험용)':'Điểm tương đối (thử nghiệm)'}: ${percent(c.score)}</p></div><button class="btn" data-action="choose-word" data-value="${i+1}">${say('change')}</button></div>`).join('')}</div>${(!original?.valid)?`<p class="notice warn">${say('invalid')}</p>`:''}<button class="btn" data-action="edit-objects">${say('edit')}</button>${objectEditor()}<div class="controls"><button class="btn" data-action="back-capture">${say('back')}</button><button class="btn" data-action="home">${say('reset')}</button></div></div>`;}
function helpView(){return `<div class="panel"><span class="eyebrow">S08 / HELP</span><h2>${say('help')}</h2><div class="helper"><h3>01 · TOP ▲</h3><p>${say('guideSingle')}</p><p>${captureCopy().tray}</p></div><div class="helper"><h3>02 · ${say('camera')}</h3><p>${say('cameraDenied')}</p><p>${say('privacy')}</p></div><div class="helper"><h3>03 · ${say('dictionary')}</h3><p>${say('notFound')}</p><p>${say('apiError')}</p></div><button class="btn primary" data-action="return-help">← ${say('back')}</button></div>`;}
function dictionaryView(){const d=state.dict;const reason=d?.reason||'';return `<div class="panel"><span class="eyebrow">S07 / ${say('dictionary')}</span><h2 class="dict-word">${esc(state.selectedText)}</h2>${missionResult(state.selectedText)}<p class="hint">${say('wordConfirmed')} · ${say('uncertain')}</p><div class="controls" style="margin:12px 0"><button class="btn" data-action="speak" data-value="${esc(state.selectedText)}">♫ ${say('speech')}</button><button class="btn" data-action="candidates">← ${say('back')}</button></div><p class="hint" id="tts-status" role="status"></p>${state.busy?`<p class="notice" role="status">${say('loading')}</p>`:(d?.status==='found'||d?.status==='ok')?`<div class="sense-card"><p>${say('dictionary')} · ${d.pronunciation?esc(d.pronunciation):''}</p><div class="sense-tabs" role="tablist">${d.senses.map((s,i)=>`<button class="btn small ${i===0?'chosen':''}" data-action="sense" data-value="${i}">${say('sense')} ${s.senseNo||i+1}</button>`).join('')}</div><div id="sense-body">${senseHtml(d,0)}</div></div><div class="helper"><p>${d.source==='local_fallback'?`<span class="pill">${say('localFallback')}</span><span>${esc(d.attribution)}</span>`:`<a target="_blank" rel="noreferrer" href="${esc(d.sourceUrl||'https://krdict.korean.go.kr/')}">${esc(d.attribution||'국립국어원 한국어기초사전')}</a>`}</p></div>`:`<div class="notice ${d?.status==='error'?'warn':''}">${d?.status==='not_found'?say('notFound'):say('apiError')} ${reason==='unconfigured'?say('unconfigured'):''}</div>${EXAMPLES[state.selectedText]?`<div class="helper"><span class="pill">${say('sample')}</span><p>${esc(EXAMPLES[state.selectedText]!.meaningKo)} · ${esc(translationFor(state.selectedText,state.lang,EXAMPLES[state.selectedText]!.meaningVi)||EXAMPLES[state.selectedText]!.meaningVi)}</p></div>`:''}<button class="btn" data-action="dictionary-retry">${say('retry')}</button>`}<div class="navigation"><button class="btn primary" data-action="home">${say('done')}</button></div></div>`;}
function senseHtml(d:DictionaryResponse,n:number){const s=d.senses[n];if(!s)return '';return `<div class="sense"><span class="pill">${esc(s.pos)} · ${say('sense')} ${s.senseNo}</span><p><strong>${say('definition')}</strong><br>${esc(s.definitionKo)}</p>${state.lang==='ko'?'':`<p><strong>${say('translation')}</strong><br>${esc(s.translationVi||s.definitionVi||say('none'))}</p>${s.definitionVi&&s.translationVi?`<p class="secondary-translation">${esc(s.definitionVi)}</p>`:''}<span class="source-label">${s.translationSource==='krdict_official'?say('official'):s.translationSource==='machine_translation'?(state.lang==='vi'?'Dịch hỗ trợ bằng AI · cần kiểm tra':state.lang==='en'?'AI-assisted translation · review required':state.lang==='ja'?'AI補助翻訳・要確認':state.lang==='zh'?'AI辅助翻译・需核对':'AI 보조 번역 · 검수 필요'):s.translationSource==='local_editorial'?say('localFallback'):say('none')}</span>`}</div>`;}
function printedReview(){
 const copy=captureCopy();
 return `<div class="panel"><h2>${copy.confirmText}</h2><p class="hint">${copy.reviewText}</p>
  <label for="recognized-word">${copy.confirmText}</label>
  <input class="recognized-word" id="recognized-word" maxlength="12" value="${esc(printedText)}" autocomplete="off" inputmode="text"/>
  <div class="controls">
   <button class="btn primary" data-action="printed-confirm">${copy.confirmDictionary}</button>
   <button class="btn" data-action="back-capture">${say('back')}</button>
  </div></div>`;
}
function render(){cameraFrameObserver?.disconnect();cameraFrameObserver=null;document.documentElement.lang=state.lang;document.title=`${APP_NAME} — ${say('title')}`;root.innerHTML=`<div class="shell">${top()}<main class="container"><div class="stage">${progress()}${state.step==='choose'?mainChoose():state.step==='capture'?captureView():state.step==='singleResult'?singleResult():state.step==='candidates'?candidatesView():state.step==='printedReview'?printedReview():state.step==='help'?helpView():dictionaryView()}</div></main><footer class="footer"><span>© 2026 VR MEDI TOUR & HOME(주) · 출원 10-2026-0208192</span><span>${say('sample')}</span><a class="footer-corporate" href="https://vr-meditour.com/" target="_blank" rel="noopener noreferrer">${say('website')==='website'?(state.lang==='ko'?'법인 공식 홈페이지':'Trang web công ty'):say('website')} ↗</a><a href="https://krdict.korean.go.kr/kor/openApi/openApiInfo" target="_blank" rel="noreferrer">KRDICT</a></footer><div id="toast" hidden role="alert"></div></div>`;attachCameraFrame();if(state.notice){toast(say(state.notice));state.notice='';}}
function selectMission(word:string){
 const mission=MISSIONS.find(item=>item.word===word);
 if(!mission||selectedMission===mission.word)return;
 cancelPending();
 selectedMission=mission.word;
 missionStartedAt=Date.now();
 missionAttempts=0;
 missionCorrections=0;
 missionCompleted=false;
 state.cellCount=2;
 state.cells=[EMPTY(),EMPTY()];
 state.selectedCell=0;
 state.selectedSlot='L';
 render();
}
function missionResult(text:string):string {
 const mission=MISSIONS.find(x=>x.word===selectedMission);
 if(!mission||text!==mission.word||!missionCompleted)return '';
 const breakdown=missionBreakdown(mission).map((s,i)=>`<p><b>${i+1}.</b> ${esc(s.formula)} · ${s.position==='right'?(state.lang==='vi'?'Nguyên âm bên phải':'세로모음: 초성 오른쪽'):(state.lang==='vi'?'Nguyên âm bên dưới':'가로모음: 초성 아래')}</p>`).join('');
 return `<section class="mission-success"><h3>${state.lang==='vi'?'Hoàn thành nhiệm vụ!':'미션 성공!'}</h3><div class="mission-breakdown">${breakdown}</div><p>${mission.word} · ${mission.meaningVi}</p><button class="btn primary" data-action="speak" data-value="${mission.word}">♫ ${say('speech')}</button></section>`;
}
async function doCompose(fromRecognition=false){
 if(state.busy&&!fromRecognition)return;
 const manual=state.inputTab==='manual'&&state.step==='capture';
 if(manual){
  lastInputMode='manual';
  if(selectedMission)missionAttempts++;
 }
 const version=++requestVersion;
 const objects=manual?objectsFromCells(state.cells):state.objects;
 const cellCount=manual?state.cells.length:state.cellCount;
 state.busy=true;
 render();
 const result=manual?composeSpatial({objects,cellCount}):await compose({objects,cellCount});
 if(version!==requestVersion)return;
 state.candidates=result.wordCandidates;
 state.originalText=result.originalText;
 state.cells=result.cells;
 state.objects=objects;
 state.busy=false;
 if(manual)state.recognized=false;
 setStage('candidates');
}
async function doDictionary(word:string){
 const version=++requestVersion;
 const mission=MISSIONS.find(item=>item.word===selectedMission);
 if(mission&&!missionCompleted&&word===mission.word&&dictionaryBack==='candidates'){
  missionCompleted=true;
  appendMissionLog({missionWord:mission.word,isFirstTrySuccess:missionAttempts===1&&missionCorrections===0,
   correctionCount:missionCorrections,completionTimeMs:Math.max(0,Date.now()-missionStartedAt),
   inputMode:lastInputMode,timestamp:new Date().toISOString()});
 }
 state.selectedText=word;
 state.dict=null;
 state.busy=true;
 setStage('dictionary');
 const data=await lookup(word,state.lang);
 if(version!==requestVersion)return;
 state.dict=data;
 state.busy=false;
 render();
}
function recognitionMessage(reason:string){
 const copy=captureCopy();
 switch(reason){
  case 'no-objects':return copy.noPieces;
  case 'no-text':return copy.noText;
  case 'multiple-pieces':return copy.multiplePieces;
  case 'unconfigured':case 'provider-auth-error':case 'provider-access-error':case 'provider-model-unavailable':return copy.auth;
  case 'provider-billing-error':return copy.quota;
  case 'provider-rate-limited':case 'http-429':return copy.requestLimit;
  default:return copy.retryVision;
 }
}
async function analyze(){
 if(!state.photo||state.busy)return;
 const version=++requestVersion;
 const controller=new AbortController();
 recognitionAbort=controller;
 captureError='';
 state.objects=[];
 state.recognized=false;
 state.busy=true;
 if(selectedMission&&state.recognitionTarget==='pieces')missionAttempts++;
 render();
 try{
  const result=await recognize(state.photo,state.mode,state.setId,state.recognitionTarget,controller.signal);
  if(version!==requestVersion)return;
  if(result.recognitionType==='printed-text'){
   if(!result.recognizedText)throw new Error('no-text');
   printedText=result.recognizedText;
   state.busy=false;
   setStage('printedReview');
   return;
  }
  const objects=normalizeObjects(result.objects);
  if(!objects.length)throw new Error('no-objects');
  if(state.mode==='single'&&objects.length!==1)throw new Error('multiple-pieces');
  state.objects=objects;
  state.recognized=true;
  if(state.mode==='single'){
   state.selectedJamo=objects[0]!.topK[0]!.jamo;
   state.busy=false;
   setStage('singleResult');
  }else{
   state.cellCount=2;
   await doCompose(true);
  }
 }catch(error){
  if(version!==requestVersion)return;
  captureError=error instanceof Error?error.message:'provider-error';
  state.busy=false;
  render();
 }finally{
  if(recognitionAbort===controller)recognitionAbort=null;
 }
}
async function openCamera(){
 if(cameraOpening||media)return;
 const attempt=++cameraRequest;
 cameraOpening=true;
 cameraFallback=false;
 render();
 try{
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(attempt!==cameraRequest){for(const track of stream.getTracks())track.stop();return;}
  cancelPending();
  state.photo=null;
  state.objects=[];
  state.recognized=false;
  captureError='';
  media=stream;
  cameraOpening=false;
  render();
 }catch{
  if(attempt!==cameraRequest)return;
  stopCam();
  cameraFallback=true;
  render();
 }
}
function usePhoto(source:CanvasImageSource,width:number,height:number,input:'camera'|'upload'){
 const canvas=document.createElement('canvas');
 const scale=Math.min(1,1536/Math.max(width,height));
 canvas.width=Math.max(1,Math.round(width*scale));
 canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d');
 if(!ctx)throw new Error('canvas-unavailable');
 ctx.fillStyle='#fff';
 ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(source,0,0,canvas.width,canvas.height);
 resetImage();
 state.photo=canvas.toDataURL('image/jpeg',.84);
 lastInputMode=input;
 cameraFallback=false;
 render();
}
function takePhoto(){
 const video=root.querySelector<HTMLVideoElement>('#camera-video');
 if(!video?.videoWidth||video.readyState<2){toast(captureCopy().opening);return;}
 try{usePhoto(video,video.videoWidth,video.videoHeight,'camera');}
 catch{toast(captureCopy().decodeFile);}
}
async function filePhoto(file:File){
 const photoType=/^image\/(jpeg|png|webp)$/.test(file.type)||(!file.type&&/\.(jpe?g|png|webp)$/i.test(file.name));
 if(!photoType||file.size>12_000_000){toast(captureCopy().inputFile);return;}
 cancelPending();
 const version=requestVersion;
 try{
  if(typeof createImageBitmap==='function'){
   const bitmap=await createImageBitmap(file);
   try{if(version===requestVersion)usePhoto(bitmap,bitmap.width,bitmap.height,'upload');}
   finally{bitmap.close();}
  }else{
   const url=URL.createObjectURL(file);
   try{
    const img=new Image();
    img.src=url;
    await img.decode();
    if(version===requestVersion)usePhoto(img,img.naturalWidth,img.naturalHeight,'upload');
   }finally{URL.revokeObjectURL(url);}
  }
 }catch{if(version===requestVersion){render();toast(captureCopy().decodeFile);}}
}
async function speak(text:string){
 const status=document.getElementById('tts-status');
 if(!status)return;
 status.textContent='';
 try{await speakKorean(text);}
 catch(error){
  if(error instanceof Error&&error.name==='AbortError')return;
  if(status.isConnected)status.textContent=`${say('ttsFail')} ${text} [${pronunciationGuide(text)}]`;
 }
}
root.addEventListener('change',event=>{
 const input=event.target as HTMLInputElement;
 if(input.name==='recognition-target'){
  cancelPending();
  captureError='';
  state.objects=[];
  state.recognized=false;
  state.recognitionTarget=input.value==='printed'?'printed':'pieces';
  render();
  return;
 }
 if(input.hasAttribute('data-language-select')){
  const language=input.value as Lang;
  if(!supportedLanguages.includes(language))return;
  state.lang=language;
  try{localStorage.setItem('hs:language',language);}catch{/* storage may be blocked */}
  changeURL();
  if(state.step==='dictionary'&&state.selectedText)void doDictionary(state.selectedText);
  else render();
  return;
 }
 if(input.id==='file-upload'&&input.files?.[0])void filePhoto(input.files[0]);
 if(input.id==='camera-fallback-upload'&&input.files?.[0]){
  stopCam();
  state.inputTab='upload';
  void filePhoto(input.files[0]);
 }
 const field=input.dataset.editObject!==undefined?'correctedJamo':input.dataset.editCell!==undefined?'correctedCell':input.dataset.editSlot!==undefined?'correctedSlot':null;
 const object=state.objects[Number(input.dataset.editObject??input.dataset.editCell??input.dataset.editSlot)];
 if(!field||!object)return;
 if(field==='correctedJamo')object.correctedJamo=input.value as Jamo;
 if(field==='correctedCell')object.correctedCell=Number(input.value);
 if(field==='correctedSlot')object.correctedSlot=input.value==='auto'?undefined:input.value as Slot;
 if(selectedMission)missionCorrections++;
});
root.addEventListener('click',e=>{const clicked=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!clicked)return;const action=clicked.dataset.action,value=clicked.dataset.value||'';switch(action){
 case 'home':resetImage();setStage('choose');break;
 case 'help':returnStage=state.step;cancelPending();setStage('help');break;
 case 'return-help':setStage(returnStage);break;
 case 'lang':state.lang=value as Lang;try{localStorage.setItem('hs:language',state.lang)}catch{}changeURL();render();break;
 case 'mode':resetImage();selectedMission=null;cameraFallback=false;state.mode=value==='word'?'word':'single';state.inputTab='camera';state.recognitionTarget='pieces';state.cells=[EMPTY(),EMPTY()];state.cellCount=2;state.selectedCell=0;state.selectedSlot='L';setStage('capture');break;
 case 'input-tab':if(value===state.inputTab)break;cancelPending();stopCam();state.inputTab=value as AppState['inputTab'];cameraFallback=false;render();break;
 case 'camera-fallback-manual':cancelPending();stopCam();state.inputTab='manual';cameraFallback=false;lastInputMode='manual';render();break;
 case 'camera-toggle':if(media)takePhoto();else void openCamera();break;
 case 'analyze':void analyze();break;
 case 'printed-confirm':{const input=document.getElementById('recognized-word') as HTMLInputElement|null;const word=(input?.value||'').normalize('NFC').trim();if(!/^[가-힣]{1,12}$/.test(word)){toast(captureCopy().invalidText);return;}printedText=word;dictionaryBack='printedReview';void doDictionary(word);break;}
 case 'select-single':state.selectedJamo=value as Jamo;if(state.step==='singleResult'){render();}else render();break;
 case 'show-single':state.objects=[];setStage('singleResult');break;
 case 'single-retry':state.inputTab='manual';setStage('capture');break;
 case 'speak':speak(value);break;
 case 'set-slot':state.selectedSlot=value as Slot;render();break;
 case 'slot':{const [idx,slot]=value.split(':');state.selectedCell=Number(idx);state.selectedSlot=(slot||'L') as Slot;render();break;}
 case 'insert-jamo':{const cell=state.cells[state.selectedCell];if(cell){if(cell[state.selectedSlot]&&cell[state.selectedSlot]!==value&&selectedMission)missionCorrections++;cell[state.selectedSlot]=value as Jamo;}render();break;}
 case 'clear-cells':state.cells=Array.from({length:state.cellCount},EMPTY);if(selectedMission)missionCorrections++;render();break;
 case 'example':selectMission(value);break;
 case 'manual-compose':void doCompose();break;
 case 'recompose':void doCompose();break;
 case 'back-capture':cancelPending();setStage('capture');break;
 case 'choose-word':{const c=state.candidates[Number(value)];if(c?.valid&&c.text){dictionaryBack='candidates';void doDictionary(c.text);}else toast(say('invalid'));break;}
 case 'candidates':cancelPending();setStage(dictionaryBack);break;
 case 'dictionary-retry':void doDictionary(state.selectedText);break;
 case 'sense':{const s=state.dict;const body=document.getElementById('sense-body');if(s&&body){body.innerHTML=senseHtml(s,Number(value));document.querySelectorAll('.sense-tabs .btn').forEach((b,i)=>b.classList.toggle('chosen',i===Number(value)));}break;}
 case 'edit-objects':document.querySelector('.bbox-list')?.scrollIntoView({block:'center',behavior:'smooth'});break;
 case 'focus-object':{const index=Number(value);const selector=document.getElementById(`obj-${index}`);if(state.step==='candidates'){selector?.scrollIntoView({block:'center',behavior:'smooth'});selector?.focus({preventScroll:true});}else toast(say('edit'));break;}
 }});
render();

if('serviceWorker' in navigator && location.protocol==='https:') { window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});}); }
