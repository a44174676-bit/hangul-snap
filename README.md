# HANGUL SNAP V1 — 한글 어포 AI 학습 웹앱

**VR MEDI TOUR & HOME(주)** · KR Patent application `10-2026-0208192` (application filed, not granted).

모바일 우선 PWA. 포장지 QR 접속 → 자모 1개 촬영 → 발음·연관 단어 → 복수 자모 단어 촬영 → 국립국어원 한국어기초사전 뜻풀이·베트남어 대응어.

## 구현 상태 (투명하게 구분)

| 기능 | 상태 |
| --- | --- |
| 설치 없는 모바일 웹·vi/ko 언어 전환 | 구현 |
| 14자모 수동 선택·음성 TTS·학습 카드 | 구현 (예시는 자체 작성) |
| 자모 조합 및 샘플 4단어 | 구현 · 기본 조합규칙 (복잡한 겹받침 등 후속) |
| 카메라 실행, 촬영·사진 업로드 | 구현 (HTTPS/브라우저 권한 필요) |
| AI 이미지 추론 | Gemini API 연동 코드 구현 · 실제 운영하려면 API 키 설정 및 식품 이미지 검증 필요 |
| 국립국어원 사전 실제 조회 | Netlify Functions 연동 코드 구현 · `KRDICT_API_KEY` 설정 필요 |
| 실물 어포 영상인식 정확도 | **미검증** (OEM 제품·데이터셋 필요) |
| 사전 기반 인식오류 자동보정 | **특허 기술 고도화(P1), 미구현**. 현재 사용자 확인만 제공 |
| 회원가입·개인정보 DB·수집 | 없음 |

## 빠른 실행

```bash
python3 -m http.server 8888 --directory site
# open http://localhost:8888
node --test tests/*.test.mjs
```

로컬 `http.server`에서는 Netlify Functions가 동작하지 않아 사전은 **명확히 구분된 자체 작성 학습 예시**로 표시됩니다. 카메라는 `localhost` 또는 HTTPS에서 정상 동작합니다.

### GitHub → Netlify 배포

1. GitHub에 **새 저장소** `hangul-snap` 생성 후 이 폴더 내용 전체를 저장소 루트에 업로드합니다 (`.env` 제외).
2. Netlify 대시보드 → **Add new project → Import an existing project → GitHub** → `hangul-snap` 선택.
3. 기본 Netlify 구성: Build command 비움, Publish directory `site`, Functions directory `netlify/functions`. `netlify.toml` 자동 적용.
4. Netlify → Project configuration → Environment variables에서 `KRDICT_API_KEY`와 `GEMINI_API_KEY`를 등록합니다. 모델 선택은 기본 `gemini-3.8-flash`이며 `GEMINI_MODEL`로 변경 가능합니다.
5. 환경변수 변경 후 Deploys → Trigger deploy로 다시 빌드/배포합니다.
6. 실제 배포 주소 `https://<site>.netlify.app/learn?set=starter&lang=vi`로 접속하여 모바일 카메라와 AI·사전 API 기능을 검증합니다.
7. 배포 URL을 QR코드로 인쇄하기 전에 식품 OEM·규제·도메인 확정을 진행합니다.

### API 키

- 국립국어원 한국어기초사전 공식 설명: https://krdict.korean.go.kr/kor/openApi/openApiInfo
- Google Gemini API 키: https://aistudio.google.com/apikey
- 모델 문서: https://ai.google.dev/gemini-api/docs/models

**키를 대화창이나 GitHub 코드에 붙이지 마십시오.** 서버 환경변수에서만 읽으며 브라우저에는 노출하지 않습니다. Gemini의 구독/Google One 학생 플랜과 Gemini API 사용권·과금은 별개입니다.

### 보안·데이터와 품질

- 카메라는 명시적 권한이 있어야 켜집니다. 사진은 브라우저에서 축소되며 사용자가 AI 버튼을 누를 때만 전송합니다.
- Netlify Function은 기본적으로 이미지 원본을 저장하지 않지만 외부 Gemini API에 이미지가 전송됩니다. 실제 서비스 전 공급자 데이터 처리정책·베트남 개인정보요건을 확인해야 합니다.
- AI 출력을 그대로 공식 정답으로 확정하지 않습니다. 사용자가 자모/단어를 확인하고 수정합니다.
- API 비용·오남용 방지: 외부 공개 전 Netlify 사이트 보호·쿼터·사용량 제한을 추가하는 것을 권장합니다.
- 사전 응답은 국립국어원 출처로 표시하고, 예시 뜻풀이는 **자체 작성 예시로 분리**합니다.
- 공식 사전의 이용약관·출처 표시·로컬 캐시 정책은 운영 전 재검토합니다.
- 자모 세트 수량이 부족한 경우 실제 제품으로 샘플 단어를 만들지 못할 수 있으므로 OEM 조합 설계가 필요합니다.

## 폴더

- `site/index.html`, `site/styles.css` — 반응형 학습 UI
- `site/js/app.js`, `site/js/data.js`, `site/js/hangul.js`, `site/js/dictionary.js` — 프런트엔드·학습·음절 조합·API
- `netlify/functions/dictionary.mjs` — 국립국어원 API 비공개 프록시
- `netlify/functions/recognize.mjs` — Gemini 멀티모달 비전 추론 프록시 (옵션)
- `site/manifest.webmanifest`, `site/sw.js`, `site/assets/icon.svg` — PWA
- `tests/hangul.test.mjs` — Node 내장 테스트

## PRD

원본 요구사항: `한글어포_AI학습웹앱_PRD_v1.0_20261027.md`를 기준으로 구현. 영상 모델 성능 목표(자모 90%, 단어 80%)는 개발 목표이지 실측 결과가 아닙니다.
