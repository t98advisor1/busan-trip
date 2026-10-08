# 현장을 교실로 — 지도 기반 미션형 체험학습 앱

부산 수학여행에서 실제로 사용한 체험학습 웹앱입니다. 일정표·학습자료·현장 미션·소감문을 모바일 한 화면의 흐름으로 묶었습니다.

- 운영 주소: https://sch-trip.vercel.app/
- 공모: NWEC 26 (분야 1. 수업 지원 · 학습 활동)

## 한눈에 보기

| 흐름 | 학생이 하는 일 | 앱 화면 |
|---|---|---|
| **여행 전** | 팀을 고르고, 안전교육과 장소별 학습자료를 봅니다 | 홈 · 안전 · 학습 |
| **여행 중** | 팀·일차별 지도와 일정을 따라 이동하고, 장소 미션과 방탈출로 스탬프를 모읍니다 | 지도 · 일정 · 미션 · 여권 |
| **여행 후** | 일정별 메모와 사진을 돌아보고 소감문을 제출합니다 | 사진첩 · 기록 |

교사는 학생이 제출한 기록을 Google Sheets와 Drive에서 확인합니다.

## 실행하기

Node.js 22.13 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:3000
```

배포용으로 실행하려면 `npm run build` 후 `npm start`를 실행합니다.

Google 연결이 없어도 지도·일정·메모·사진첩·미션은 모두 동작합니다. 기록 제출과 공용 랭킹까지 쓰려면 아래 「Google 백엔드 연결」을 참고하세요.

## Vercel에 배포하기

1. 이 저장소를 Vercel에서 **Add New → Project**로 가져옵니다. 프레임워크는 Next.js로 자동 인식됩니다.
2. **Settings → Environment Variables**에 `TRIP_GOOGLE_SCRIPT_URL`을 추가합니다. 값은 Apps Script 웹앱의 `/exec` 주소입니다.
3. 배포한 뒤 **Settings → Domains**에서 원하는 `이름.vercel.app` 주소를 지정합니다.

## Google 백엔드 연결

1. 새 Google 스프레드시트를 만들고 **확장 프로그램 → Apps Script**를 엽니다.
2. `scripts/google-sheets-trip-backend.gs` 내용을 붙여 넣고 **배포 → 새 배포 → 웹 앱**으로 배포합니다. 실행 계정은 본인으로, 액세스 권한은 모든 사용자로 설정합니다.
3. 발급된 `/exec` 주소를 `.env.local`(로컬) 또는 Vercel 환경변수의 `TRIP_GOOGLE_SCRIPT_URL`에 넣습니다.

제출 기록은 `submissions`, `schedules`, `memories`, `answers`, `stamps`, `reflections`, `rankings` 시트에 쌓입니다. 사진은 Apps Script 실행 계정의 Drive 폴더에 학급·학생별로 정리됩니다.

---

## 우리 학교 체험학습으로 바꿔 쓰기

바꿀 내용은 대부분 `app/trip-app.tsx` **한 파일 안**에 모여 있습니다. 아래 순서대로 이름(상수·함수명)을 검색해서 고치면 됩니다. 줄 번호는 참고용이며, 코드를 수정하면 조금씩 달라질 수 있습니다.

### 1단계 · 팀과 일정표 바꾸기

| 바꿀 것 | 찾을 이름 | 위치(약) |
|---|---|---|
| 팀 이름·반·인원 | `tripTeamOrder`, `tripTeamMeta` | 272행 |
| 일차별 일정(시간·장소·설명·좌표) | `createTripSchedule` | 297–700행 |
| 팀마다 순서가 다른 일정 | `dayOneTeamEvents` 등 `team === "B"` 분기 | 같은 함수 안 |

일정 한 칸은 이렇게 생겼습니다.

```ts
event(0, "market", {            // 0 = 1일차, "market" = 일정 고유 이름(영문)
  time: "13:00",
  title: "국제시장 탐방",
  place: "국제시장",
  detail: "피란민의 삶과 부산 상권의 형성 과정을 관찰합니다.",
  subject: "사회문화",
  missionEventId: "market",     // 이 일정에 연결할 미션(없으면 생략)
  lat: 35.1016, lng: 129.0281,  // 지도 좌표(없으면 지도에 표시하지 않음)
}),
```

- **좌표 찾기:** 구글 지도에서 장소를 마우스 오른쪽 버튼으로 누르면 맨 위에 `위도, 경도`가 나옵니다. 그대로 `lat`, `lng`에 넣으면 됩니다.
- **이동 일정:** `move: true`를 붙이면 일정표에 '이동' 표시가 붙습니다.
- **팀이 하나뿐인 경우:** 팀별 분기를 지우고 모든 팀에 같은 일정을 쓰면 됩니다. 이때 `tripTeamOrder`는 `["A"]`처럼 하나만 남깁니다.

### 2단계 · 스탬프투어(장소 미션) 바꾸기

| 바꿀 것 | 찾을 이름 | 위치(약) |
|---|---|---|
| 장소별 퀴즈·스탬프·현장 코드 | `missions` | 709–1000행 |

```ts
{
  id: "market-migration",        // 미션 고유 이름
  eventId: "market",             // ← 1단계 일정의 missionEventId와 같아야 연결됩니다
  day: 0,
  place: "국제시장",
  subject: "사회문화",
  title: "피란민과 인구 이동",
  prompt: "질문 내용",
  options: ["보기1", "보기2", "보기3"],  // O/X 문제는 ["O", "X"]
  answer: 1,                      // 정답 번호(0부터 셈)
  stamp: "MARKET",                // 여권에 찍힐 스탬프 글자
  code: "국제시장",               // 교사가 현장에서 알려 줄 방문 코드
  reward: 12,                     // 점수
  explanation: "해설",
  resources: [{ label: "자료 이름", href: "https://..." }],
}
```

- 미션의 **`eventId`**와 일정의 **`missionEventId`**가 같아야 미션을 완료할 때 일정 체크와 지도 표시가 함께 바뀝니다.
- `code`는 교사가 현장에서 알려 주는 값입니다. 저장소가 공개되어 있으므로 **실제 운영 전에 새 값으로 바꾸세요.**

### 3단계 · 방탈출(이야기형 퀴즈) 바꾸기

| 바꿀 것 | 찾을 이름 | 위치(약) |
|---|---|---|
| 일차별 이야기·최종 암호 | `createEscapeChapters` | 1033–1150행 |
| 무작위 출제 문제은행 | `escapeQuestionSeeds` | 1152–1610행 |

- 각 챕터의 `challenges`는 2단계 `missions`의 `id`를 불러다 씁니다. 미션 id를 바꿨다면 여기에서도 똑같이 바꿔야 합니다. 이름이 맞지 않으면 `Unknown escape mission` 오류가 납니다.
- 아이템 조각(`fragment`)을 순서대로 이으면 최종 암호(`finalAnswers`)가 되도록 맞춥니다. 예: `BU + S + AN = BUSAN`
- 문제은행 문항의 `day`(0, 1, 2)는 해당 일차 챕터에 출제됩니다.

### 4단계 · 학습·안전 자료와 학교 정보

| 바꿀 것 | 찾을 이름 |
|---|---|
| 학습 탭 카드 | `learningCards` |
| 안전 탭 카드 | `safetyCards` |
| 게임 탭 링크 | `gameLinks` |
| 사용 안내 카드 | `guideCards` |
| 학교명·문구 | 파일 안에서 `신천고등학교`, `SCH` 검색 |
| 학교메일 형식 검사 | `sch.hs.kr` 검색 |
| 첫 화면 이미지·로고·공유 미리보기 | `public/` 폴더, `app/layout.tsx`의 `title`, `description` |

### 5단계 · 새 행사로 시작할 때 꼭 할 일

1. **기기 저장값 초기화:** `sincheon-trip-...-v1`로 시작하는 저장 키(1895행 부근)의 끝을 `-v2`처럼 바꿉니다. 그러면 학생 기기에 남아 있던 지난 행사의 체크·메모가 새 일정과 섞이지 않습니다.
2. **새 백엔드 사용:** 새 스프레드시트에 Apps Script를 설치하고 `TRIP_GOOGLE_SCRIPT_URL`을 교체합니다. 지난 행사의 학생 기록과 분리됩니다.
3. **확인:** `npm run build`가 오류 없이 끝나는지 확인한 뒤, 휴대폰 크기(390×844) 화면에서 팀 선택 → 지도 → 미션 → 기록 제출 순서로 한 번 따라가 봅니다.

## 학생 데이터 보호

- 이 저장소에는 학생 데이터, 운영 환경변수, 계정 비밀번호가 없습니다.
- 학생 기기의 체크·메모·사진첩은 그 기기의 브라우저(localStorage)에만 저장됩니다.
- 실제 운영 전에는 수집 항목, 보유기간, 삭제 절차, 교사 접근권한을 정해 학생과 보호자에게 안내하세요.

## 라이선스 고지

사용한 오픈소스(Next.js, React, Tailwind CSS, Leaflet 등)의 고지는 `THIRD_PARTY_NOTICES.txt`에 있습니다.
