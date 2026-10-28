# HANGUL SNAP v1.2 — PRD/특허 UI 리팩토링

**사업자:** VR MEDI TOUR & HOME(주)  
**기존 출원:** 대한민국 특허출원 10-2026-0208192 (출원 단계, 미등록)  
**1차 언어:** 베트남어(vi), 한국어(ko)

## 상태 안내

- **구현:** 초기 URL 언어 적용(첫 페인트 중립 로딩), basic14 세트 폴백, S01~S08 단계형 UI, 수동 자모·2D 단어 조합, 단어 후보 사용자 확인, Top-K/bbox 표시와 수정, 공식 사전 조회 함수, TTS 오류 상태, 카메라·사진 업로드, TOP/ROI/음절 가이드.
- **검증:** TypeScript 엄격모드 통과, Node 단위/함수 테스트 12건 통과.
- **미검증:** 실제 OEM 어포·다양한 스마트폰에서 AI 검출 성능, 공식 사전 실시간 인증키 응답, 한국어교육 전문가의 모든 예시·발음 검수, Netlify 실배포의 브라우저 E2E.
- **미구현:** 특허 독립 기술이라고 주장할 만한 학습·검증된 사전 기반 영상 오류보정 엔진. 현재는 **비자동 변경형 후보 평가 UX 및 실험용 로컬 표제어 인덱스**입니다. 단어가 사전에 없어도 강제로 바꾸지 않습니다.

## 폴더 구조

```text
hangul-snap/
├── src/
│   ├── types.ts       # 공통 API/앱 상태 계약
│   ├── i18n.ts        # ko/vi 화면 문자열
│   ├── jamo-data.ts   # 14자모 교육 예제 + 로컬 어휘 인덱스
│   ├── spatial.ts     # 2D L/V/T 셀 + 유니코드 조합 + 조건부 후보
│   ├── api.ts         # 서버리스 API 호출 모듈
│   └── main.ts        # S01~S08 상태 머신, 렌더링, 카메라/TTS
├── site/              # Netlify publish 디렉터리 (작성된 JS 포함)
│   ├── index.html
│   ├── styles.css
│   ├── js/*.js
│   ├── sw.js
│   ├── manifest.webmanifest
│   └── assets/icon.svg
├── netlify/functions/
│   ├── product-sets.mjs
│   ├── recognize.mjs
│   ├── compose.mjs
│   └── dictionary.mjs
├── tests/
│   ├── spatial.test.mjs
│   ├── api.test.mjs
│   └── functions.test.mjs
├── tsconfig.json
├── netlify.toml
├── package.json
└── .env.example
```

## 실행·시험

```bash
npm install
npm run build
npm test
python -m http.server 8888 --directory site
```

`http://localhost:8888/?set=basic14&lang=ko` 접속. 로컬 Python 서버에는 Netlify Functions가 없어 사전 API와 Gemini AI는 실행되지 않습니다. 수동 학습/단어조합은 앱 내부의 알고리즘 폴백으로 작동합니다.

## Netlify 배포

1. **중요:** ZIP 압축을 풀고 **그 안의 모든 파일 및 폴더를 GitHub 저장소 루트에 그대로** 올리십시오. 이전처럼 파일이 루트에 납작하게 모여서는 안 됩니다.
2. `netlify.toml`의 설정을 사용합니다. **Build command: `npm run build && npm test` / Publish directory: `site` / Functions directory: `netlify/functions`**.
3. 배포 시 Netlify가 TypeScript 개발 의존성을 설치하고 `npm run build && npm test`를 실행하여 `site/js`를 최신 코드로 갱신합니다. 로컬에서도 같은 명령으로 검증할 수 있습니다.
4. Project configuration → Environment variables에 Functions scope를 포함하여 `KRDICT_API_KEY`, `GEMINI_API_KEY`를 입력합니다. 모델 변경 시 `GEMINI_MODEL`을 등록합니다.
5. 라이브 점검 URL: `https://hangul-snap.netlify.app/?set=basic14&lang=ko` / 베트남어 `...?set=basic14&lang=vi`.
6. **운영 주의:** 공개된 AI API 함수에는 별도 호출횟수 제한, 예산경보 및 오용방지 설정이 필요합니다. 등록 없이 공개 운용하는 경우 예상치 못한 요금이 발생할 수 있습니다.

### GitHub 업로드 권장 절차 (폴더 보존)

GitHub Desktop에서 `a44174676-bit/hangul-snap`을 Clone한 뒤, 다운로드한 ZIP **내부의** `src`, `site`, `netlify`, `tests` 등 전체 항목을 로컬 저장소 최상위에 복사합니다. **Commit to main → Push origin**합니다. 기존 루트에 잘못 업로드된 `index.html`, `app.js`, `dictionary.mjs` 등 중복 평면파일은 저장소에서 삭제해도 되지만, 올바른 새 폴더에 모든 파일이 있는지 먼저 확인하십시오.

GitHub 연결은 현재 제3자 API의 파일쓰기 권한이 거부되어, 이 전달용 ZIP만으로 자동 푸시되지는 않습니다. Netlify 프로덕션이 자동 갱신되었다고 가정하지 마십시오.

## 내부 API 계약

```text
GET  /api/product-sets/:setId → ProductSet
POST /api/recognize         → RecognitionResponse
POST /api/compose           → ComposeResponse
GET  /api/dictionary?word=나무&lang=vi → DictionaryResponse
```

bbox: `[x,y,width,height]`를 0–1000 정규화 좌표로 사용. AI 신뢰도는 모델이 제시한 미교정 값입니다. 자동 정답 확정에 사용하지 않습니다.

## 한국어기초사전 제공 조건

정식 조회는 `KRDICT_API_KEY`가 필요합니다. 검색 `/api/search` → `target_code`로 상세 `/api/view`를 별도 수행하며, 미수록과 오류를 구별합니다. 로컬 어휘 인덱스는 임의의 **소규모 제품 예시 목록**이며 국립국어원 전체 사전 캐시나 검증 결과가 아닙니다. 출처: <https://krdict.korean.go.kr/kor/openApi/openApiInfo>.

## 기술적 한계 및 특허 주의

현 단계의 합성 점수 `S=.55 vision +.20 layout +.15 hangul_valid +.10 dictionary`는 **실험 전의 휴리스틱**으로 정확도 개선이 입증된 신규 알고리즘이 아닙니다. 향후 실제 어포 이미지 데이터로 A/B 실험을 수행하고 개선효과를 측정해야 합니다. 이 앱이 특허 등록 또는 권리범위를 입증하는 것은 아닙니다.

## 개인정보

카메라는 명시적 권한이 있어야 켜집니다. 원본 이미지는 앱/서버에 기본 영구 저장하지 않지만, **AI 인식을 눌렀을 때 이미지가 Gemini API 제공업체로 전달될 수 있습니다.** 프로덕션 운영 전 개인정보처리방침 및 외부 API 데이터처리 약관을 검토하십시오.

## V1.1.1 최종 점검 (2026-10-28)

- API 리다이렉트: `/api/recognize`, `/api/compose`, `/api/dictionary`, `/api/dictionary-index`, `/api/product-sets/:setId`를 서버리스 함수로 연결합니다.
- Vision: 전체 단어를 반환하는 응답은 거절합니다. 각 조각의 `bbox=[x,y,width,height]` (0~1000), 중심좌표, 자모별 Top-K 후보를 검증합니다. Gemini의 confidence는 **보정된 통계적 확률이 아닙니다**.
- Compose: 원본 후보를 0번으로 유지하고 비사전어를 강제로 바꾸지 않습니다. `actions.keepOriginal=true`, `actions.editJamo=true`가 항상 제공됩니다. `userAdjustments`는 객체별 패치로 병합합니다.
- Dictionary: 경량 **자체 작성** 어휘 인덱스(`/api/dictionary-index`)는 공식 사전 수록 여부를 증명하지 않습니다. 확정된 어휘만 `/api/dictionary`에서 공식 검색 → 상세조회를 수행합니다. 공식 XML의 `sense_info`를 처리하고 서버 장애 시 오류와 편집 예제를 구분합니다.
- Netlify 환경변수 `KRDICT_API_KEY`와 `GEMINI_API_KEY`는 Functions scope로 설정해야 합니다. 실제 키를 저장소나 ZIP에 넣지 마십시오.
- 기존 GitHub `main`과 Netlify 운영 사이트는 이 패키지 생성만으로 바뀌지 않습니다. 새 버전을 먼저 프리뷰에 배포하고 E2E 점검 후 운영 반영을 권장합니다.


## 2026-10-28 v1.2 API & local fallback

- Default Gemini: `gemini-2.5-flash`; fallback: `gemini-3.8-flash` (2.0 Flash discontinued June 1 2026). `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` can override.
- If official KRDICT is unconfigured or unavailable, 42 learning-card slots (24 distinct words) return `status:ok,source:local_fallback`. Editorial definitions are **not verified official KRDICT text**; quality field `educator_review_pending`.
- `site/` generated via `npm run build` from `src/`. Do NOT flatten folders when copying into GitHub.
