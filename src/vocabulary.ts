/** Locally authored provisional translations. Do not label as official KRDICT translations. */
export const TRANSLATIONS:Record<string,{en:string;ja:string;zh:string}>={
 '가방':{en:'bag',ja:'かばん',zh:'包'},
 '가수':{en:'singer',ja:'歌手',zh:'歌手'},
 '고기':{en:'meat',ja:'肉',zh:'肉'},
 '나무':{en:'tree',ja:'木',zh:'树木'},
 '나라':{en:'country',ja:'国',zh:'国家'},
 '노래':{en:'song',ja:'歌',zh:'歌曲'},
 '다리':{en:'leg',ja:'脚',zh:'腿'},
 '도시':{en:'city',ja:'都市',zh:'城市'},
 '바다':{en:'sea',ja:'海',zh:'大海'},
 '라면':{en:'instant noodles',ja:'ラーメン',zh:'方便面'},
 '모자':{en:'hat',ja:'帽子',zh:'帽子'},
 '마음':{en:'heart / mind',ja:'心',zh:'内心'},
 '비누':{en:'soap',ja:'石けん',zh:'肥皂'},
 '사과':{en:'apple',ja:'りんご',zh:'苹果'},
 '시계':{en:'clock / watch',ja:'時計',zh:'钟表'},
 '우유':{en:'milk',ja:'牛乳',zh:'牛奶'},
 '아이':{en:'child',ja:'子ども',zh:'孩子'},
 '어서':{en:'quickly / come on',ja:'早く',zh:'快点'},
 '서울':{en:'Seoul',ja:'ソウル',zh:'首尔'},
 '언어':{en:'language',ja:'言語',zh:'语言'},
 '구두':{en:'dress shoes',ja:'革靴',zh:'皮鞋'},
 '으뜸':{en:'the best / first',ja:'一番',zh:'第一'},
 '그림':{en:'picture',ja:'絵',zh:'图画'},
 '기름':{en:'oil',ja:'油',zh:'油'}
};
const SOUNDS:Record<string,{onset:string;coda:string}>={
 'ㄱ':{onset:'[k] / [ɡ] depending on context',coda:'unreleased [k̚]'},
 'ㄴ':{onset:'nasal [n]',coda:'nasal [n]'},
 'ㄷ':{onset:'[t] / [d] depending on context',coda:'unreleased [t̚]'},
 'ㄹ':{onset:'flap [ɾ]',coda:'lateral [l]'},
 'ㅁ':{onset:'nasal [m]',coda:'nasal [m]'},
 'ㅂ':{onset:'[p] / [b] depending on context',coda:'unreleased [p̚]'},
 'ㅅ':{onset:'fricative [s], varies before ㅣ',coda:'unreleased [t̚]'},
 'ㅇ':{onset:'silent (no consonant sound)',coda:'nasal [ŋ]'},
 'ㅏ':{onset:'vowel [a]',coda:'not used as a final consonant'},
 'ㅓ':{onset:'vowel [ʌ ~ ə]',coda:'not used as a final consonant'},
 'ㅗ':{onset:'vowel [o]',coda:'not used as a final consonant'},
 'ㅜ':{onset:'vowel [u]',coda:'not used as a final consonant'},
 'ㅡ':{onset:'vowel [ɯ]',coda:'not used as a final consonant'},
 'ㅣ':{onset:'vowel [i]',coda:'not used as a final consonant'}
};
export function translationFor(word:string,lang:string,fallback=''):string{
 if(lang==='vi')return fallback;
 if(lang==='ko')return '';
 return TRANSLATIONS[word]?.[lang as 'en'|'ja'|'zh']||'';
}
export function soundFor(jamo:string,lang:string,position:'onset'|'coda'):string{
 const sound=SOUNDS[jamo]?.[position]||'';
 if(lang==='ja')return (position==='onset'?'初声：':'終声：')+sound;
 if(lang==='zh')return (position==='onset'?'初声：':'收音：')+sound;
 return (position==='onset'?'Syllable-initial: ':'Syllable-final: ')+sound;
}
