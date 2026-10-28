import {translationFor} from '../../site/js/vocabulary.js';
/**
 * Curated-for-development editorial mini-lexicon covering 42 word-card references
 * (24 distinct headwords). DOES NOT reproduce or claim official KRDICT entries.
 * A Korean-language educator must review meanings and pronunciation before commercial use.
 */
export const LEARNING_CARD_WORDS=Object.freeze(["가방", "가수", "고기", "나무", "나라", "노래", "다리", "도시", "바다", "라면", "노래", "다리", "모자", "마음", "나무", "바다", "비누", "가방", "사과", "시계", "가수", "우유", "아이", "가방", "나무", "바다", "가방", "어서", "서울", "언어", "고기", "모자", "노래", "나무", "우유", "구두", "으뜸", "그림", "기름", "고기", "다리", "아이"]);
export const LOCAL_WORDS=Object.freeze({
  "가방": {
    "pos": "명사",
    "definitionKo": "물건을 넣어 가지고 다니는 용구.",
    "translationVi": "túi xách",
    "pronunciation": "가방"
  },
  "가수": {
    "pos": "명사",
    "definitionKo": "노래를 부르는 일을 직업으로 하는 사람.",
    "translationVi": "ca sĩ",
    "pronunciation": "가수"
  },
  "고기": {
    "pos": "명사",
    "definitionKo": "사람이 먹을 수 있는 동물의 살.",
    "translationVi": "thịt",
    "pronunciation": "고기"
  },
  "나무": {
    "pos": "명사",
    "definitionKo": "줄기와 가지가 자라나는 여러해살이 식물.",
    "translationVi": "cây",
    "pronunciation": "나무"
  },
  "나라": {
    "pos": "명사",
    "definitionKo": "국민과 영토, 통치 제도를 갖춘 국가.",
    "translationVi": "đất nước",
    "pronunciation": "나라"
  },
  "노래": {
    "pos": "명사",
    "definitionKo": "가락에 말을 붙이거나 목소리로 부르는 음악.",
    "translationVi": "bài hát",
    "pronunciation": "노래"
  },
  "다리": {
    "pos": "명사",
    "definitionKo": "사람이나 동물이 걷거나 서는 데 쓰는 몸의 부분.",
    "translationVi": "chân",
    "pronunciation": "다리"
  },
  "도시": {
    "pos": "명사",
    "definitionKo": "사람과 건물, 교통시설이 모여 있는 큰 거주 지역.",
    "translationVi": "thành phố",
    "pronunciation": "도시"
  },
  "바다": {
    "pos": "명사",
    "definitionKo": "육지 사이에 넓게 펼쳐진 짠물의 영역.",
    "translationVi": "biển",
    "pronunciation": "바다"
  },
  "라면": {
    "pos": "명사",
    "definitionKo": "밀가루 면을 양념 국물에 끓여 먹는 식품.",
    "translationVi": "mì ramen",
    "pronunciation": "라면"
  },
  "모자": {
    "pos": "명사",
    "definitionKo": "머리에 쓰는 물건.",
    "translationVi": "mũ",
    "pronunciation": "모자"
  },
  "마음": {
    "pos": "명사",
    "definitionKo": "감정이나 생각이 일어나는 내면.",
    "translationVi": "tâm trí / tấm lòng",
    "pronunciation": "마음"
  },
  "비누": {
    "pos": "명사",
    "definitionKo": "손이나 몸을 씻을 때 사용하는 세정제.",
    "translationVi": "xà phòng",
    "pronunciation": "비누"
  },
  "사과": {
    "pos": "명사",
    "definitionKo": "둥글고 새콤달콤한 열매의 한 종류.",
    "translationVi": "táo",
    "pronunciation": "사과"
  },
  "시계": {
    "pos": "명사",
    "definitionKo": "시간을 알아보는 기구.",
    "translationVi": "đồng hồ",
    "pronunciation": "시계"
  },
  "우유": {
    "pos": "명사",
    "definitionKo": "소에서 얻은 젖으로 만든 음료.",
    "translationVi": "sữa",
    "pronunciation": "우유"
  },
  "아이": {
    "pos": "명사",
    "definitionKo": "나이가 어린 사람.",
    "translationVi": "trẻ em",
    "pronunciation": "아이"
  },
  "어서": {
    "pos": "부사",
    "definitionKo": "빨리 또는 지체하지 않고.",
    "translationVi": "nhanh lên",
    "pronunciation": "어서"
  },
  "서울": {
    "pos": "고유 명사",
    "definitionKo": "대한민국의 수도.",
    "translationVi": "Seoul",
    "pronunciation": "서울"
  },
  "언어": {
    "pos": "명사",
    "definitionKo": "사람이 뜻을 전할 때 쓰는 말과 기호의 체계.",
    "translationVi": "ngôn ngữ",
    "pronunciation": "언어"
  },
  "구두": {
    "pos": "명사",
    "definitionKo": "주로 가죽 등으로 만들어 발에 신는 신발.",
    "translationVi": "giày da",
    "pronunciation": "구두"
  },
  "으뜸": {
    "pos": "명사",
    "definitionKo": "여럿 가운데 가장 뛰어나거나 첫째인 것.",
    "translationVi": "hàng đầu",
    "pronunciation": "으뜸"
  },
  "그림": {
    "pos": "명사",
    "definitionKo": "선이나 색으로 모습을 표현한 작품.",
    "translationVi": "tranh",
    "pronunciation": "그림"
  },
  "기름": {
    "pos": "명사",
    "definitionKo": "음식 조리 등에 쓰는 미끄러운 액체.",
    "translationVi": "dầu",
    "pronunciation": "기름"
  }
});
export function localEntry(word,lang='vi',reason='offline'){
 const entry=LOCAL_WORDS[word];if(!entry)return null;
 return {status:'ok',source:'local_fallback',headword:word,targetCode:null,
  pronunciation:entry.pronunciation,
  senses:[{senseNo:1,pos:entry.pos,definitionKo:entry.definitionKo,
    translationVi:translationFor(word,lang,entry.translationVi)|| (lang==='vi'?entry.translationVi:''),definitionVi:'',translationSource:lang==='ko'?'none':'local_editorial'}],
  sourceUrl:null,attribution:'내장 학습용 편집 사전 — 국립국어원 공식 뜻풀이·번역 아님',
  isOfficial:false,quality:'educator_review_pending',reason,translationLang:lang,
  usedCards:LEARNING_CARD_WORDS.filter(w=>w===word).length};
}
