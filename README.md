# HANGUL SNAP

**사업자:** VR MEDI TOUR & HOME(주)  
**기존 출원:** 대한민국 특허출원 10-2026-0208192 (출원 단계, 미등록)  
**1차 언어:** 베트남어(vi), 한국어(ko)

## 상태 안내

- **구현:** 초기 URL 언어 적용(첫 페인트 중립 로딩), basic14 세트 폴백, S01~S08 단계형 UI, 수동 자모·2D 단어 조합, 단어 후보 사용자 확인, Top-K/bbox 표시와 수정, 공식 사전 조회 함수, TTS 오류 상태, 카메라·사진 업로드, TOP/ROI/음절 가이드.
- **촬영 안내:** 식판의 각 음절 영역에 초성·중성·종성 홈을 한 칸씩 표시합니다. 세로·가로 모음은 모두 실제 식판의 오른쪽 홈에 놓습니다. 인쇄 글자 읽기는 별도 모드입니다.
- **발음:** 기본 자모와 예시 단어는 앱에 포함된 음원을 사용합니다. 다른 단어는 기기의 한국어 음성 또는 발음 표기를 사용합니다.
- **배포 확인:** TypeScript 빌드와 자동 테스트에 더해 미리보기에서 두 음절과 받침, 빈 식판, 인쇄 글자, 발음을 확인합니다. 실제 어묵 조각은 휴대폰으로도 확인해야 합니다.
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

`http://localhost:8888/?set=basic14&lang=ko` 접속. 로컬 Python 서버에는 Netlify Functions가 없어 사전 API와 OpenAI 비전 AI는 실행되지 않습니다. 수동 학습/단어조합은 앱 내부의 알고리즘 폴백으로 작동합니다.

## Netlify 배포

1. GitHub의 수정 PR에서 **Netlify Deploy Preview**를 엽니다. 기존 Netlify 프로젝트가 이 저장소의 `main` 브랜치에 연결되어 있습니다.
2. 미리보기에서 실물 자모 조각, 인쇄 글자, 사전, 발음 듣기를 확인합니다. 각 환경에 적용할 `OPENAI_API_KEY`와 `KRDICT_API_KEY`는 Netlify의 Functions 범위에서 관리합니다.
3. 운영 반영은 GitHub PR의 **Merge pull request → Confirm merge**로 진행합니다. Netlify **Deploys**에서 최신 `main` 배포가 **Published**인지 확인합니다.
4. 운영 주소: <https://hangul-snap.netlify.app/?set=basic14&lang=ko>. 베트남어로 열려면 `lang=vi`를 사용합니다.

빌드 명령은 `npm run build && npm test`이며, 공개 폴더는 `site`, Functions 폴더는 `netlify/functions`입니다.
`/api/recognize`는 Netlify 함수에서 경로와 호출 제한을 지정합니다. 사진 인식은 IP와 사이트 조합당 분당 60건으로 제한됩니다.

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

카메라는 명시적 권한이 있어야 켜집니다. 원본 이미지는 앱/서버에 기본 영구 저장하지 않지만, **AI 인식을 눌렀을 때 이미지가 OpenAI API 제공업체로 전달될 수 있습니다.** 프로덕션 운영 전 개인정보처리방침 및 외부 API 데이터처리 약관을 검토하십시오.

## V1.1.1 최종 점검 (2026-10-28)

- API 경로: `/api/recognize`, `/api/compose`, `/api/dictionary`, `/api/dictionary-index`, `/api/product-sets/:setId`를 서버리스 함수로 연결합니다.
- Vision: 전체 단어를 반환하는 응답은 거절합니다. 각 조각의 `bbox=[x,y,width,height]` (0~1000), 중심좌표, 자모별 Top-K 후보를 검증합니다. OpenAI 모델의 confidence는 **보정된 통계적 확률이 아닙니다**.
- Compose: 원본 후보를 0번으로 유지하고 비사전어를 강제로 바꾸지 않습니다. `actions.keepOriginal=true`, `actions.editJamo=true`가 항상 제공됩니다. `userAdjustments`는 객체별 패치로 병합합니다.
- Dictionary: 경량 **자체 작성** 어휘 인덱스(`/api/dictionary-index`)는 공식 사전 수록 여부를 증명하지 않습니다. 확정된 어휘만 `/api/dictionary`에서 공식 검색 → 상세조회를 수행합니다. 공식 XML의 `sense_info`를 처리하고 서버 장애 시 오류와 편집 예제를 구분합니다.
- Netlify 환경변수 `KRDICT_API_KEY`와 `OPENAI_API_KEY`는 Functions scope로 설정해야 합니다. 실제 키를 저장소나 ZIP에 넣지 마십시오.
- 기존 GitHub `main`과 Netlify 운영 사이트는 이 패키지 생성만으로 바뀌지 않습니다. 새 버전을 먼저 프리뷰에 배포하고 E2E 점검 후 운영 반영을 권장합니다.


## 2026-10-28 v1.2 API & local fallback

- 기본 OpenAI 모델은 `gpt-6-luna`입니다. 모델 선택 값이 비어 있고 기본 모델을 사용할 수 없을 때 기존 `gpt-4.1-mini`를 시도합니다. 특정 모델은 `OPENAI_VISION_MODEL`로 설정합니다. OpenAI API 사용량은 ChatGPT 구독과 별도로 집계됩니다.
- If official KRDICT is unconfigured or unavailable, 42 learning-card slots (24 distinct words) return `status:ok,source:local_fallback`. Editorial definitions are **not verified official KRDICT text**; quality field `educator_review_pending`.
- `site/` generated via `npm run build` from `src/`. Do NOT flatten folders when copying into GitHub.
