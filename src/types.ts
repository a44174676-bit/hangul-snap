/** Stable contracts shared by camera UI, composer and Netlify Functions. */
export type Lang = 'vi' | 'ko' | 'en' | 'ja' | 'zh';
export type Mode = 'single' | 'word';
export type Stage = 'choose' | 'capture' | 'singleResult' | 'candidates' | 'dictionary' | 'help';
export type InputTab = 'camera' | 'upload' | 'manual';
export type Jamo = 'ㄱ'|'ㄴ'|'ㄷ'|'ㄹ'|'ㅁ'|'ㅂ'|'ㅅ'|'ㅇ'|'ㅏ'|'ㅓ'|'ㅗ'|'ㅜ'|'ㅡ'|'ㅣ';
export type Slot = 'L'|'V'|'T';
export type BBox = [number, number, number, number]; // normalized [x,y,width,height] in 0..1000
export interface TopK { jamo:Jamo; confidence:number }
export interface DetectedObject { id:string; bbox:BBox; center?:[number,number]; topK:TopK[]; correctedJamo?:Jamo; correctedSlot?:Slot; correctedCell?:number }
export interface RecognitionResponse { objects:DetectedObject[]; warnings:string[]; status?:'ok'|'unconfigured'|'error' }
export interface ProductSet { setId:string; jamoList:Jamo[]; uiLangDefault:Lang; contentVersion:string; usageGuide:{ko:string;vi:string} }
export interface SyllableCell { L:Jamo|null; V:Jamo|null; T:Jamo|null }
export interface Candidate { text:string;score:number;syllables:string[];isInDictionary:boolean;autoCorrected:boolean;originalText:string; valid:boolean; lexiconStatus?:'local_index_match'|'not_in_local_index'; isOriginal?:boolean }
export interface ComposeRequest { objects:DetectedObject[];userAdjustments?:DetectedObject[];cellCount?:number }
export interface ComposeResponse {wordCandidates:Candidate[]; requiresConfirmation:boolean; originalText:string; warnings:string[]; cells:SyllableCell[]; actions?:{keepOriginal:boolean;chooseAlternative:boolean;editJamo:boolean};message?:string|null }
export type DictionaryStatus='found'|'ok'|'not_found'|'error';
export type TranslationSource='krdict_official'|'local_editorial'|'none';
export interface DictionarySense {senseNo:number;pos:string;definitionKo:string;translationVi:string;definitionVi:string;translationSource:TranslationSource }
export interface DictionaryResponse {source?:'local_fallback';isOfficial?:boolean;quality?:string;fallbackExample?:{source:'editorial_example';isOfficial:false;definitionKo:string;translationVi:string;pos:string}|null;status:DictionaryStatus;headword:string;targetCode:string|null;pronunciation:string|null;senses:DictionarySense[];sourceUrl:string|null;attribution:string;reason?:string}
export interface JamoLesson {jamo:Jamo;nameKo:string;nameVi:string;onsetKo:string;codaKo:string;onsetVi:string;codaVi:string;words:[string,string][] }
export interface WordExample {parts:Jamo[]; meaningKo:string;meaningVi:string;pos:string}
export interface AppState { lang:Lang;setId:string;step:Stage;mode:Mode;inputTab:InputTab;photo:string|null; objects:DetectedObject[];cells:SyllableCell[];cellCount:number; selectedCell:number;selectedSlot:Slot; selectedJamo:Jamo;recognized:boolean;candidates:Candidate[]; originalText:string;selectedText:string;dict:DictionaryResponse|null; statusMessage:string; notice:string;busy:boolean }
