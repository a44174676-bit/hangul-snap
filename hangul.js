// Hangul NFC composition for the starter Jamo set. Unknown or ambiguous sequences are not silently repaired.
const INITIAL='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIAL='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINAL=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const isC=j=>INITIAL.includes(j);const isV=j=>MEDIAL.includes(j);
export function composeJamo(input){const arr=Array.isArray(input)?input:[...String(input)];let result='',issues=[];for(let i=0;i<arr.length;){const initial=arr[i], medial=arr[i+1];if(!isC(initial)||!isV(medial)){issues.push({index:i,char:initial,reason:'Expected initial consonant + vowel'});result+=initial??'';i++;continue;}let final='',count=2;const next=arr[i+2];if(next && FINAL.includes(next) && next !== '' && !(isV(arr[i+3]))){final=next;count++;}const ci=INITIAL.indexOf(initial),vi=MEDIAL.indexOf(medial),fi=FINAL.indexOf(final);result+=String.fromCharCode(0xAC00+ci*588+vi*28+fi);i+=count;}return {text:result,valid:issues.length===0,issues};}
export function decomposeSyllables(word){const parts=[];for(const c of String(word)){const n=c.charCodeAt(0)-0xAC00;if(n>=0&&n<11172){parts.push(INITIAL[Math.floor(n/588)],MEDIAL[Math.floor(n%588/28)]);const f=FINAL[n%28];if(f)parts.push(f);}else parts.push(c);}return parts;}
export function sortDetectedObjects(objects){ // reading order for well-spaced horizontal learning board
 return [...objects].sort((a,b)=>{const ay=(a.bbox?.[1]??0)+(a.bbox?.[3]??0)/2,by=(b.bbox?.[1]??0)+(b.bbox?.[3]??0)/2;return Math.abs(ay-by)>180?ay-by:(a.bbox?.[0]??0)-(b.bbox?.[0]??0);});
}
