import type {Jamo, JamoLesson, ProductSet, WordExample} from './types.js';
export const JAMO:Jamo[]=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ'];
export const CONSONANTS:Jamo[]=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ'];
export const VOWELS:Jamo[]=['ㅏ','ㅓ','ㅗ','ㅜ','ㅡ','ㅣ'];
export const SETS:Record<string,ProductSet>={basic14:{setId:'basic14',jamoList:JAMO,uiLangDefault:'vi',contentVersion:'1.2.0',usageGuide:{ko:'무늬 없는 학습판의 TOP 방향을 맞춰 한글 조각을 놓아주세요.',vi:'Đặt miếng chữ trên nền trơn, giữ chữ TOP hướng lên.'}}};
/** Editorial starter content; requires human Korean-language education review before paid educational distribution. */
export const LESSONS:Record<Jamo,JamoLesson>={
 'ㄱ':{jamo:'ㄱ',nameKo:'기역',nameVi:'giyeok',onsetKo:'초성: 연구개 파열음. 어두에서는 무성에 가깝고 모음 사이에서는 유성으로 날 수 있습니다.',codaKo:'종성: 받침 ㄱ은 [ㄱ̚] 계열의 닫힌 소리입니다.',onsetVi:'Đầu âm tiết: âm bật ở phần sau lưỡi, gần /k/ hoặc [ɡ] tùy ngữ cảnh.',codaVi:'Cuối âm tiết: âm ngậm cuối [k̚], không bật hơi.',words:[['가방','túi xách'],['가수','ca sĩ'],['고기','thịt']]},
 'ㄴ':{jamo:'ㄴ',nameKo:'니은',nameVi:'nieun',onsetKo:'초성: 혀끝을 윗잇몸에 대는 비음 [n].',codaKo:'종성: 받침 ㄴ도 비음 [n]으로 소리 납니다.',onsetVi:'Đầu âm tiết: âm mũi [n].',codaVi:'Cuối âm tiết: âm mũi [n].',words:[['나무','cây'],['나라','đất nước'],['노래','bài hát']]},
 'ㄷ':{jamo:'ㄷ',nameKo:'디귿',nameVi:'digeut',onsetKo:'초성: 어두에서 무성 [t] 계열, 모음 사이에서 [d]로 소리 날 수 있습니다.',codaKo:'종성: 받침 ㄷ은 [t̚]로 닫힙니다.',onsetVi:'Đầu âm tiết: gần [t] hoặc [d] tùy vị trí.',codaVi:'Cuối âm tiết: âm ngậm [t̚].',words:[['다리','chân / cầu'],['도시','thành phố'],['바다','biển']]},
 'ㄹ':{jamo:'ㄹ',nameKo:'리을',nameVi:'rieul',onsetKo:'초성: 위치에 따라 탄설음 [ɾ] 계열로 소리 납니다.',codaKo:'종성: 받침 ㄹ은 설측음 [l] 계열입니다.',onsetVi:'Đầu âm tiết: âm bật đầu lưỡi [ɾ].',codaVi:'Cuối âm tiết: gần âm [l].',words:[['라면','mì ramen'],['노래','bài hát'],['다리','chân / cầu']]},
 'ㅁ':{jamo:'ㅁ',nameKo:'미음',nameVi:'mieum',onsetKo:'초성: 두 입술을 붙이는 비음 [m].',codaKo:'종성: 받침 ㅁ도 비음 [m]입니다.',onsetVi:'Đầu âm tiết: âm mũi [m].',codaVi:'Cuối âm tiết: âm mũi [m].',words:[['모자','mũ'],['마음','tấm lòng'],['나무','cây']]},
 'ㅂ':{jamo:'ㅂ',nameKo:'비읍',nameVi:'bieup',onsetKo:'초성: 어두에서 무성 [p] 계열, 모음 사이에서 [b]로 날 수 있습니다.',codaKo:'종성: 받침 ㅂ은 [p̚]로 닫힙니다.',onsetVi:'Đầu âm tiết: gần [p] hoặc [b] tùy ngữ cảnh.',codaVi:'Cuối âm tiết: âm ngậm [p̚].',words:[['바다','biển'],['비누','xà phòng'],['가방','túi xách']]},
 'ㅅ':{jamo:'ㅅ',nameKo:'시옷',nameVi:'siot',onsetKo:'초성: 대개 [s], ㅣ 앞에서는 구개음화된 마찰음으로 실현됩니다.',codaKo:'종성: 받침 ㅅ은 단독으로 [t̚] 계열로 소리 납니다.',onsetVi:'Đầu âm tiết: âm xát gần [s], thay đổi trước ㅣ.',codaVi:'Cuối âm tiết: âm ngậm [t̚].',words:[['사과','táo'],['시계','đồng hồ'],['가수','ca sĩ']]},
 'ㅇ':{jamo:'ㅇ',nameKo:'이응',nameVi:'ieung',onsetKo:'초성: 자음 소리가 나지 않으며 음절의 모음 자리를 채웁니다.',codaKo:'종성: 받침 ㅇ은 비음 [ŋ]입니다.',onsetVi:'Đầu âm tiết: không phát âm.',codaVi:'Cuối âm tiết: âm mũi [ŋ].',words:[['우유','sữa'],['아이','em bé'],['가방','túi xách']]},
 'ㅏ':{jamo:'ㅏ',nameKo:'아',nameVi:'a',onsetKo:'모음 ㅏ는 [a] 계열의 소리입니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm gần [a].',codaVi:'Nguyên âm không dùng làm phụ âm cuối.',words:[['나무','cây'],['바다','biển'],['가방','túi xách']]},
 'ㅓ':{jamo:'ㅓ',nameKo:'어',nameVi:'eo',onsetKo:'모음 ㅓ는 [ʌ] 또는 [ə]에 가까운 소리로 실현될 수 있습니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm eo [ʌ~ə], khác ㅏ.',codaVi:'Không có âm cuối.',words:[['어서','mau lên'],['서울','Seoul'],['언어','ngôn ngữ']]},
 'ㅗ':{jamo:'ㅗ',nameKo:'오',nameVi:'o',onsetKo:'모음 ㅗ는 [o] 계열입니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm tròn môi [o].',codaVi:'Không có âm cuối.',words:[['고기','thịt'],['모자','mũ'],['노래','bài hát']]},
 'ㅜ':{jamo:'ㅜ',nameKo:'우',nameVi:'u',onsetKo:'모음 ㅜ는 [u] 계열입니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm tròn môi [u].',codaVi:'Không có âm cuối.',words:[['나무','cây'],['우유','sữa'],['구두','giày da']]},
 'ㅡ':{jamo:'ㅡ',nameKo:'으',nameVi:'eu',onsetKo:'모음 ㅡ는 평순 후설 고모음 [ɯ] 계열입니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm không tròn môi [ɯ], khác u tiếng Việt.',codaVi:'Không có âm cuối.',words:[['으뜸','hàng đầu'],['그림','tranh'],['기름','dầu']]},
 'ㅣ':{jamo:'ㅣ',nameKo:'이',nameVi:'i',onsetKo:'모음 ㅣ는 [i] 계열입니다.',codaKo:'모음에는 받침 음가가 없습니다.',onsetVi:'Nguyên âm [i].',codaVi:'Không có âm cuối.',words:[['고기','thịt'],['다리','chân / cầu'],['아이','em bé']]}
};
export const EXAMPLES:Record<string,WordExample>={
 '나무':{parts:['ㄴ','ㅏ','ㅁ','ㅜ'],meaningKo:'줄기와 가지가 있는 식물.',meaningVi:'cây',pos:'명사'},
 '고기':{parts:['ㄱ','ㅗ','ㄱ','ㅣ'],meaningKo:'동물의 살 중 음식으로 먹는 것.',meaningVi:'thịt',pos:'명사'},
 '바다':{parts:['ㅂ','ㅏ','ㄷ','ㅏ'],meaningKo:'육지와 구별되는 넓은 짠물의 공간.',meaningVi:'biển',pos:'명사'},
 '가방':{parts:['ㄱ','ㅏ','ㅂ','ㅏ','ㅇ'],meaningKo:'물건을 넣어 들고 다니는 용구.',meaningVi:'túi xách',pos:'명사'},
 '나라':{parts:['ㄴ','ㅏ','ㄹ','ㅏ'],meaningKo:'영토와 국민, 통치 체제를 갖춘 공동체.',meaningVi:'đất nước',pos:'명사'}
};
export const LOCAL_LEXICON=new Set(Object.keys(EXAMPLES).concat(['구기','바보','모자','다리','고구마','고무','노래','우유','사과','서울','마음','그림','가수','가구','가게','고래','나비']));
