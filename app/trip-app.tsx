"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    L?: any;
    __tripLeafletLoading?: Promise<void>;
  }
}

type TripEvent = {
  id: string;
  time: string;
  title: string;
  place: string;
  detail: string;
  subject: string;
  missionEventId?: string;
  move?: boolean;
  lat?: number;
  lng?: number;
};

type TripTeam = "A" | "B" | "C";

type MapViewportMode = "fit" | "focus" | "preserve";

type TripDay = {
  id: number;
  label: string;
  date: string;
  theme: string;
  events: TripEvent[];
};

type Mission = {
  id: string;
  eventId: string;
  day: number;
  place: string;
  subject: string;
  title: string;
  prompt: string;
  options: string[];
  answer: number;
  stamp: string;
  code: string;
  reward: number;
  explanation?: string;
  resources?: {
    label: string;
    href: string;
  }[];
};

type StudentProfile = {
  studentNo: string;
  name: string;
  group?: string;
  email?: string;
};

type MissionLog = {
  missionId: string;
  place: string;
  question: string;
  answer: string;
  correctAnswer: string;
  isCorrect: boolean;
  earnedScore?: number;
  elapsedSeconds?: number;
  submittedAt: string;
};

type SubmitStatus = "idle" | "saving" | "saved" | "missing-config" | "error";

type RankingStatus = "idle" | "syncing" | "live" | "offline";
type VisitorSource = "loading" | "shared" | "local";

type LadderPair = {
  name: string;
  result: string;
};

type LadderBar = {
  id: string;
  railIndex: number;
  left: string;
  top: string;
  width: string;
};

type ActiveOverlay = "mission" | "ladder" | "random" | "map" | "guide" | null;

type AppPageId =
  | "home"
  | "map"
  | "schedule"
  | "missions"
  | "photo"
  | "passport"
  | "learning"
  | "record"
  | "safety"
  | "games";

type AppPageDefinition = {
  id: AppPageId;
  label: string;
  hash: string;
};

const appPages: AppPageDefinition[] = [
  { id: "home", label: "홈", hash: "top" },
  { id: "map", label: "지도", hash: "schedule" },
  { id: "schedule", label: "일정", hash: "checklist" },
  { id: "missions", label: "미션", hash: "missions" },
  { id: "photo", label: "사진첩", hash: "photo-album" },
  { id: "passport", label: "여권", hash: "stamp-passport" },
  { id: "learning", label: "학습", hash: "learning" },
  { id: "record", label: "기록", hash: "submit-record" },
  { id: "safety", label: "안전", hash: "safety" },
  { id: "games", label: "게임", hash: "games" },
];

function getAppPageNumber(pageId: AppPageId) {
  const pageIndex = appPages.findIndex((page) => page.id === pageId);
  return String(pageIndex + 1).padStart(2, "0");
}

function getAppPageFromHash(hash: string): AppPageId {
  const normalized = hash.replace(/^#/, "");
  if (normalized === "ladder-game" || normalized === "random-draw") return "games";
  return appPages.find((page) => page.hash === normalized)?.id ?? "home";
}

type ScoreSubmitKind = "stamp" | "escape";

type LearningSlide = {
  subject: string;
  title: string;
  body: string;
  href: string;
  mediaLabel: string;
  videoReward?: number;
  minimumSeconds?: number;
};

type SafetySlide = {
  category: string;
  title: string;
  summary: string;
  points: string[];
  action: string;
};

type EscapeRankEntry = {
  id: string;
  studentNo: string;
  name: string;
  group?: string;
  tripTeam?: TripTeam;
  tripClasses?: string;
  missionId: string;
  missionTitle: string;
  place: string;
  score: number;
  videoLearningScore?: number;
  elapsedSeconds: number;
  createdAt: string;
  ownerKey?: string;
};

type VideoLearningProgress = Record<
  string,
  {
    startedAt: number;
    completedAt?: string;
  }
>;

type EscapeStage = "briefing" | "challenge" | "final" | "result";

type EscapeInventoryItem = {
  icon: string;
  label: string;
  fragment: string;
  detail: string;
};

type EscapeChallenge = {
  id: string;
  questionId: string;
  missionId: string;
  stageIndex: number;
  grantsItem: boolean;
  scene: string;
  typeLabel: string;
  kind: "choice" | "short";
  title: string;
  prompt: string;
  options?: string[];
  answer?: number;
  acceptedAnswers?: string[];
  explanation: string;
  hint: string;
  item: EscapeInventoryItem;
};

type EscapeQuestion = {
  id: string;
  day: number;
  typeLabel: string;
  kind: "choice" | "short";
  title: string;
  prompt: string;
  options?: string[];
  answer?: number;
  acceptedAnswers?: string[];
  explanation: string;
  hint: string;
};

type EscapeChapter = {
  id: string;
  day: number;
  title: string;
  subtitle: string;
  briefing: string;
  objective: string;
  finalPrompt: string;
  finalAnswers: string[];
  finalHint: string;
  challenges: EscapeChallenge[];
};

type VisitorCounts = {
  today: number;
  total: number;
  source: VisitorSource;
};

type PhotoFormat = "mini" | "square" | "wide";
type PhotoFrame = "classic" | "paper" | "rounded" | "mint" | "coral" | "film" | "stamp";

type TripPhoto = {
  id: string;
  src: string;
  caption: string;
  sticker: string;
  tone: string;
  icon?: string;
  format?: PhotoFormat;
  frame?: PhotoFrame;
  showTags?: boolean;
  showCredit?: boolean;
  createdAt: string;
};

type ScheduleEdit = Partial<Pick<TripEvent, "time" | "title" | "place" | "detail">>;

type TripMemory = {
  note: string;
  photos?: TripPhoto[];
  photo?: string;
  updatedAt?: string;
};

type SubmittedPhoto = {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const tripTeamOrder: TripTeam[] = ["A", "B", "C"];

const tripTeamMeta: Record<TripTeam, { classes: string; students: number; teachers: number; total: number }> = {
  A: { classes: "2·3·5·8반", students: 100, teachers: 8, total: 108 },
  B: { classes: "1·4·7반", students: 84, teachers: 6, total: 90 },
  C: { classes: "6·9·10반", students: 78, teachers: 5, total: 83 },
};

const yachtBoardingLocation = {
  place: "시타딘 커넥트 호텔 하리 부산 입구",
  detail:
    "업체 변경으로 승선 장소가 부산광역시 영도구 동삼오션로 58로 바뀌었습니다. 호텔 입구에서 인원을 확인하고 구명조끼 착용과 승선 안전수칙을 확인합니다.",
  lat: 35.0696105,
  lng: 129.0824974,
};

function makeTripEvent(
  team: TripTeam,
  day: number,
  slug: string,
  event: Omit<TripEvent, "id">,
): TripEvent {
  return { id: `${team.toLowerCase()}-d${day + 1}-${slug}`, ...event };
}

function createTripSchedule(team: TripTeam): TripDay[] {
  const event = (day: number, slug: string, data: Omit<TripEvent, "id">) =>
    makeTripEvent(team, day, slug, data);

  const dayOneTeamEvents: Record<TripTeam, TripEvent[]> = {
    A: [
      event(0, "blue-line", {
        time: "14:30/14:45",
        title: "블루라인파크 미포 출발",
        place: "해운대 블루라인파크 미포정거장",
        detail: "2·3반 52명은 14:30, 5·8반 56명은 14:45에 출발합니다.",
        subject: "해양 관광",
        missionEventId: "blue-line",
        lat: 35.1595,
        lng: 129.1711,
      }),
      event(0, "yacht", {
        time: "16:00",
        title: "요트 체험",
        ...yachtBoardingLocation,
        subject: "해양 안전",
        missionEventId: "yacht",
      }),
      event(0, "dinner", {
        time: "18:20",
        title: "석식",
        place: "쿠우쿠우 해운대점",
        detail: "인원 확인 후 지정된 자리에서 저녁 식사를 합니다.",
        subject: "식사",
        lat: 35.1697,
        lng: 129.1767,
      }),
    ],
    B: [
      event(0, "yacht", {
        time: "14:30",
        title: "요트 체험",
        ...yachtBoardingLocation,
        subject: "해양 안전",
        missionEventId: "yacht",
      }),
      event(0, "blue-line", {
        time: "16:40",
        title: "블루라인파크 송정 출발",
        place: "해운대 블루라인파크 송정정거장",
        detail: "승차 인원은 90명이며, 16:30까지 집결해 출발 안내를 확인합니다.",
        subject: "해양 관광",
        missionEventId: "blue-line",
        lat: 35.1817,
        lng: 129.202,
      }),
      event(0, "dinner", {
        time: "18:20",
        title: "석식",
        place: "쿠우쿠우 해운대점",
        detail: "인원 확인 후 지정된 자리에서 저녁 식사를 합니다.",
        subject: "식사",
        lat: 35.1697,
        lng: 129.1767,
      }),
    ],
    C: [
      event(0, "yacht", {
        time: "14:30",
        title: "요트 체험",
        ...yachtBoardingLocation,
        subject: "해양 안전",
        missionEventId: "yacht",
      }),
      event(0, "blue-line", {
        time: "17:00",
        title: "블루라인파크 미포 출발",
        place: "해운대 블루라인파크 미포정거장",
        detail: "6·9반 55명은 16:30, 10반 28명은 16:45에 승차 안내를 확인합니다.",
        subject: "해양 관광",
        missionEventId: "blue-line",
        lat: 35.1595,
        lng: 129.1711,
      }),
      event(0, "dinner", {
        time: "18:30",
        title: "석식",
        place: "애슐리 롯데아울렛 동부산점",
        detail: "인원 확인 후 지정된 자리에서 저녁 식사를 합니다.",
        subject: "식사",
        lat: 35.1923,
        lng: 129.2127,
      }),
    ],
  };

  const dayTwoLearningEvent =
    team === "B"
      ? event(1, "science-center", {
          time: "15:00",
          title: "부산과학체험관",
          place: "부산과학체험관",
          detail: "체험 전시를 통해 과학 원리를 관찰하고 활동 기록을 남깁니다.",
          subject: "과학",
          lat: 35.1238,
          lng: 129.0454,
        })
      : event(1, "maritime-museum", {
          time: "15:30",
          title: "국립해양박물관",
          place: "국립해양박물관",
          detail: "해양 생태와 교류 자료를 보며 항구 도시 부산의 특징을 살펴봅니다.",
          subject: "해양 문화",
          missionEventId: "maritime-museum",
          lat: 35.0788,
          lng: 129.0805,
        });

  const dayThreeLearningEvent =
    team === "B"
      ? event(2, "maritime-museum", {
          time: "10:30",
          title: "국립해양박물관",
          place: "국립해양박물관",
          detail: "해양 생태와 교류 자료를 보며 항구 도시 부산의 특징을 살펴봅니다.",
          subject: "해양 문화",
          missionEventId: "maritime-museum",
          lat: 35.0788,
          lng: 129.0805,
        })
      : event(2, "science-center", {
          time: "10:30",
          title: "부산과학체험관",
          place: "부산과학체험관",
          detail: "체험 전시를 통해 과학 원리를 관찰하고 활동 기록을 남깁니다.",
          subject: "과학",
          lat: 35.1238,
          lng: 129.0454,
        });

  const dayThreeLunch =
    team === "C"
      ? event(2, "lunch", {
          time: "12:30",
          title: "중식",
          place: "쿠우쿠우 부산광복점",
          detail: "인원 확인 후 지정된 자리에서 점심 식사를 합니다.",
          subject: "식사",
          lat: 35.0998,
          lng: 129.0327,
        })
      : event(2, "lunch", {
          time: "12:30",
          title: "중식",
          place: "애슐리 문현점",
          detail: "인원 확인 후 지정된 자리에서 점심 식사를 합니다.",
          subject: "식사",
          lat: 35.1383,
          lng: 129.0666,
        });

  return [
    {
      id: 0,
      label: "1일차",
      date: "8월 24일 (월)",
      theme:
        team === "A"
          ? "국제시장 → 블루라인 미포 → 요트"
          : team === "B"
            ? "국제시장 → 요트 → 블루라인 송정"
            : "국제시장 → 요트 → 블루라인 미포",
      events: [
        event(0, "seoul-gather", {
          time: "07:10",
          title: "서울역 집결 및 인원 파악",
          place: "서울역",
          detail: "팀별 집결 장소에서 출석, 건강 상태, 준비물을 확인합니다.",
          subject: "집결",
        }),
        event(0, "seoul-departure", {
          time: "08:12",
          title: "서울역 출발",
          place: "서울역 KTX",
          detail: "좌석과 안전수칙을 확인하고 부산으로 이동합니다.",
          subject: "이동",
          move: true,
        }),
        event(0, "busan-arrival", {
          time: "11:33",
          title: "부산역 도착",
          place: "부산역",
          detail: "하차 후 팀별 인원을 확인하고 국제시장으로 이동합니다.",
          subject: "이동",
          lat: 35.1152,
          lng: 129.0422,
        }),
        event(0, "market-lunch", {
          time: "12:00",
          title: "중식 · 국제시장 자유식",
          place: "국제시장",
          detail: "정해진 구역과 집결 시간을 지키며 자유식으로 점심을 먹습니다.",
          subject: "식사",
          lat: 35.1016,
          lng: 129.0281,
        }),
        event(0, "market", {
          time: "13:00",
          title: "국제시장 탐방",
          place: "국제시장",
          detail: "피란민의 삶과 부산 상권의 형성 과정을 현장에서 관찰합니다.",
          subject: "사회문화",
          missionEventId: "market",
          lat: 35.1016,
          lng: 129.0281,
        }),
        ...dayOneTeamEvents[team],
        event(0, "hotel", {
          time: "19:40",
          title: "숙소 도착 및 방 배정",
          place: "해운대 엘시티",
          detail: "객실을 배정받고 비상 대피로, 점호 장소, 생활 수칙을 확인합니다.",
          subject: "숙소",
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(0, "lights-out", {
          time: "22:00",
          title: "점호 및 취침",
          place: "해운대 엘시티",
          detail: "인원과 건강 상태를 확인한 뒤 휴대전화를 정리하고 취침합니다.",
          subject: "생활 안전",
          lat: 35.1607,
          lng: 129.1706,
        }),
      ],
    },
    {
      id: 1,
      label: "2일차",
      date: "8월 25일 (화)",
      theme:
        team === "B"
          ? "롯데월드 → 부산과학체험관 → 레크리에이션"
          : "롯데월드 → 국립해양박물관 → 레크리에이션",
      events: [
        event(1, "breakfast", {
          time: "07:30",
          title: "기상 및 조식",
          place: "해운대 엘시티",
          detail: "07:30 기상 후 준비하며 조식 예정 시각은 08:30입니다.",
          subject: "자기관리",
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(1, "hotel-departure", {
          time: "09:30",
          title: "숙소 출발",
          place: "해운대 엘시티",
          detail: "팀별 인원을 확인하고 롯데월드로 이동합니다.",
          subject: "이동",
          move: true,
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(1, "lotte-world", {
          time: "10:00",
          title: "롯데월드 입장 및 체험",
          place: "롯데월드 어드벤처 부산",
          detail: "안전수칙과 팀별 집결 장소를 확인한 뒤 체험 활동을 시작합니다.",
          subject: "체험",
          missionEventId: "lotte-world",
          lat: 35.196,
          lng: 129.2135,
        }),
        event(1, "lotte-lunch", {
          time: "활동 중",
          title: "중식 · 롯데월드 밀쿠폰",
          place: "롯데월드 어드벤처 부산",
          detail: "팀별 안내에 따라 밀쿠폰으로 점심 식사를 합니다.",
          subject: "식사",
          lat: 35.196,
          lng: 129.2135,
        }),
        event(1, "lotte-finish", {
          time: "14:30",
          title: "롯데월드 집결",
          place: "롯데월드 어드벤처 부산",
          detail: "지정 장소에 모여 인원을 확인하고 다음 체험 장소로 이동합니다.",
          subject: "집결",
          lat: 35.196,
          lng: 129.2135,
        }),
        dayTwoLearningEvent,
        event(1, "dinner", {
          time: "17:30",
          title: "석식",
          place: "오채담",
          detail: "인원 확인 후 지정된 자리에서 저녁 식사를 합니다.",
          subject: "식사",
          lat: 35.0803,
          lng: 129.0686,
        }),
        event(1, "recreation", {
          time: "19:00",
          title: "레크리에이션",
          place: "레크리에이션 행사장",
          detail: "학급과 팀이 함께 참여하며 안전하게 활동합니다.",
          subject: "공동체",
          missionEventId: "recreation",
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(1, "hotel-arrival", {
          time: "21:30",
          title: "숙소 도착",
          place: "해운대 엘시티",
          detail: "객실 복귀 후 개인 물품과 건강 상태를 확인합니다.",
          subject: "숙소",
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(1, "lights-out", {
          time: "22:30",
          title: "점호 및 취침",
          place: "해운대 엘시티",
          detail: "인원과 건강 상태를 확인한 뒤 취침합니다.",
          subject: "생활 안전",
          lat: 35.1607,
          lng: 129.1706,
        }),
      ],
    },
    {
      id: 2,
      label: "3일차",
      date: "8월 26일 (수)",
      theme:
        team === "B"
          ? "해운대 단체사진 → 국립해양박물관 → 귀경"
          : "해운대 단체사진 → 부산과학체험관 → 귀경",
      events: [
        event(2, "breakfast-checkout", {
          time: "07:30/08:00",
          title: "조식 및 체크아웃 준비",
          place: "해운대 엘시티",
          detail: "07:30 조식 후 짐을 모두 내려놓고, 08:00 인원과 객실 상태를 확인합니다.",
          subject: "체크아웃",
          lat: 35.1607,
          lng: 129.1706,
        }),
        event(2, "group-photo", {
          time: "09:00",
          title: "해운대 해수욕장 단체사진",
          place: "해운대 해수욕장",
          detail: "팀별 집결 위치와 촬영 안내를 확인하고 단체사진을 촬영합니다.",
          subject: "추억 기록",
          lat: 35.1587,
          lng: 129.1604,
        }),
        event(2, "hotel-departure", {
          time: "10:00",
          title: "숙소 출발",
          place: "해운대 엘시티",
          detail: "짐과 인원을 최종 확인한 뒤 팀별 체험 장소로 이동합니다.",
          subject: "이동",
          move: true,
          lat: 35.1607,
          lng: 129.1706,
        }),
        dayThreeLearningEvent,
        dayThreeLunch,
        event(2, "busan-station-arrival", {
          time: "14:30",
          title: "부산역 도착",
          place: "부산역",
          detail: "승차권과 인원을 확인하고 귀경 준비를 합니다.",
          subject: "집결",
          lat: 35.1152,
          lng: 129.0422,
        }),
        event(2, "busan-departure", {
          time: "15:43",
          title: "부산역 출발",
          place: "부산역 KTX",
          detail: "좌석과 안전수칙을 확인하고 서울로 이동합니다.",
          subject: "이동",
          missionEventId: "busan-return",
          move: true,
          lat: 35.1152,
          lng: 129.0422,
        }),
        event(2, "seoul-arrival", {
          time: "18:22",
          title: "서울역 도착",
          place: "서울역",
          detail: "하차 후 팀별 집결 장소에서 마지막 인원을 확인합니다.",
          subject: "도착",
        }),
        event(2, "dismissal", {
          time: "도착 후",
          title: "인원 파악 및 해산",
          place: "서울역",
          detail: "보호자 연락과 귀가 방법을 확인한 뒤 선생님의 안내에 따라 해산합니다.",
          subject: "귀가 안전",
        }),
      ],
    },
  ];
}

const tripSchedules: Record<TripTeam, TripDay[]> = {
  A: createTripSchedule("A"),
  B: createTripSchedule("B"),
  C: createTripSchedule("C"),
};

const missions: Mission[] = [
  {
    id: "market-migration",
    eventId: "market",
    day: 0,
    place: "국제시장",
    subject: "사회문화",
    title: "피란민과 인구 이동",
    prompt: "6.25 전쟁 당시 전국 각지에서 부산으로 사람들이 몰려든 현상을 설명하는 사회학적 개념으로 가장 적절한 것은?",
    options: ["이촌향도", "강제적·사회적 인구 이동", "젠트리피케이션", "역도시화", "다문화주의"],
    answer: 1,
    stamp: "MARKET",
    code: "국제시장",
    reward: 12,
    explanation: "전쟁, 재난, 정치적 상황 등으로 사람들이 기존 생활 터전을 떠나 이동하는 현상은 강제적·사회적 인구 이동으로 볼 수 있습니다.",
    resources: [
      { label: "부산 중구 문화관광: 국제시장", href: "https://www.bsjunggu.go.kr/board/view.junggu?boardId=LIFE&dataSid=55996&menuCd=DOM_000000201001000000" },
    ],
  },
  {
    id: "market-informal-economy",
    eventId: "market",
    day: 0,
    place: "국제시장",
    subject: "사회문화",
    title: "도떼기시장과 비공식 경제",
    prompt: "국제시장이 '도떼기시장'으로 불리며 급격히 성장할 수 있었던 배경과 가장 거리가 먼 것은?",
    options: ["피란민들의 생계유지 활동", "미군 군수물자와 구호품의 유입", "국가 주도의 계획적인 신도시 개발", "외래 문물과 밀수품의 거래", "비공식 경제 부문의 팽창"],
    answer: 2,
    stamp: "MARKET+",
    code: "도떼기시장",
    reward: 14,
    explanation: "국제시장은 광복과 전쟁, 피란민 생계 활동, 군수물자 유입 등이 얽혀 자연발생적으로 성장한 시장으로 이해할 수 있습니다.",
    resources: [
      { label: "부산 중구 문화관광: 국제시장", href: "https://www.bsjunggu.go.kr/board/view.junggu?boardId=LIFE&dataSid=55996&menuCd=DOM_000000201001000000" },
    ],
  },
  {
    id: "market-book-alley",
    eventId: "market",
    day: 0,
    place: "보수동 책방골목",
    subject: "사회문화",
    title: "자생적 문화 공간",
    prompt: "보수동 책방골목은 전쟁 당시 교육의 기회가 부족했던 피란민과 학생들에게 지식의 보급소 역할을 하며 형성된 자생적 문화 공간이다.",
    options: ["O", "X"],
    answer: 0,
    stamp: "BOOK",
    code: "책방골목",
    reward: 10,
    explanation: "피란 시기 책과 교육 자료의 유통은 단순한 상업 활동을 넘어 지식과 문화가 모이는 생활 공간을 만들었습니다.",
    resources: [
      { label: "부산 문화관광", href: "https://www.visitbusan.net/" },
    ],
  },
  {
    id: "yacht-symbolic-place",
    eventId: "yacht",
    day: 0,
    place: "영도 하리 해양 체험",
    subject: "사회문화",
    title: "장소의 상징성",
    prompt: "달맞이공원의 문탠로드처럼 자연환경에 문화적·감성적 의미를 부여하여 새로운 가치를 창출하는 것은 문화의 어떤 속성과 관련이 깊을까요?",
    options: ["상징성 또는 의미 부여", "문화 지체", "관료제화", "문화 사대주의", "아노미"],
    answer: 0,
    stamp: "MOON",
    code: "상징성",
    reward: 13,
    explanation: "같은 자연 공간도 사회 구성원이 부여하는 의미에 따라 산책로, 데이트 명소, 관광 자원 등으로 새롭게 해석됩니다.",
    resources: [
      { label: "부산 관광 공식 사이트", href: "https://www.visitbusan.net/" },
      { label: "부산튜브", href: "https://www.youtube.com/@Busan_is_good" },
    ],
  },
  {
    id: "rail-place-change",
    eventId: "blue-line",
    day: 0,
    place: "블루라인파크",
    subject: "지리·문화",
    title: "공간 의미의 변동성",
    prompt: "과거 피란민의 애환이 서린 장소가 현재 SNS를 통해 젊은 세대에게 관광지로 소비되는 것처럼, 동일한 공간의 의미가 시대와 세대에 따라 다르게 해석되는 현상은 문화의 어떤 특성 때문일까요?",
    options: ["변동성", "보편성", "획일성", "생물학적 유전", "불변성"],
    answer: 0,
    stamp: "RAIL",
    code: "변동성",
    reward: 15,
    explanation: "문화는 고정되어 있지 않고 시대적 상황, 미디어, 세대 경험에 따라 의미가 달라질 수 있습니다.",
    resources: [
      { label: "부산 관광 공식 사이트", href: "https://www.visitbusan.net/" },
    ],
  },
  {
    id: "lotte-socialization",
    eventId: "lotte-world",
    day: 1,
    place: "롯데월드 어드벤처 부산",
    subject: "사회문화",
    title: "또래 집단과 사회화",
    prompt: "수학여행이라는 단체 활동을 통해 학생들이 규칙을 지키고 협동심을 기르는 과정은 사회학적 관점에서 어떤 과정에 해당할까요?",
    options: ["재사회화 및 또래 집단을 통한 사회화", "계급 재생산", "관료제화", "아노미 현상", "문화 지체"],
    answer: 0,
    stamp: "TEAM",
    code: "사회화",
    reward: 14,
    explanation: "또래와 함께 이동하고 약속을 지키는 경험은 학교 밖에서도 규범과 역할을 배우는 사회화 과정입니다.",
    resources: [
      { label: "사회화 개념 살펴보기", href: "https://ko.wikipedia.org/wiki/%EC%82%AC%ED%9A%8C%ED%99%94" },
    ],
  },
  {
    id: "maritime-acculturation",
    eventId: "maritime-museum",
    day: 1,
    place: "국립해양박물관",
    subject: "사회문화",
    title: "항구 도시와 문화 접변",
    prompt: "부산은 항구 도시로서 외부 세계와의 교류가 활발했습니다. 서로 다른 두 문화가 지속적으로 접촉하여 새로운 문화 요소가 만들어지거나 변화하는 현상을 무엇이라고 할까요?",
    options: ["문화 접변", "문화 절대주의", "역도시화", "관료제", "문화 지체"],
    answer: 0,
    stamp: "OCEAN",
    code: "문화접변",
    reward: 16,
    explanation: "항구는 사람, 물자, 정보가 오가는 접점이므로 문화 접변을 관찰하기 좋은 장소입니다.",
    resources: [
      { label: "국립해양박물관", href: "https://www.mmk.or.kr/" },
    ],
  },
  {
    id: "maritime-global-busan",
    eventId: "maritime-museum",
    day: 1,
    place: "국립해양박물관",
    subject: "사회문화",
    title: "글로벌 항구의 문화 변화",
    prompt: "6.25 전쟁 당시 한국에 파병된 여러 나라 청년들의 문화가 부산에 유입되면서 나타났을 사회적 현상으로 예측하기 어려운 것은?",
    options: ["서구식 식문화의 도입", "언어적 차이로 인한 소통의 어려움", "팝 문화의 확산", "전통 유교 규범의 절대적 강화", "새로운 형태의 대중문화 형성"],
    answer: 3,
    stamp: "GLOBAL",
    code: "글로벌부산",
    reward: 15,
    explanation: "외부 문화와의 접촉은 새로운 음식, 언어, 음악, 대중문화의 확산과 관련되지만 전통 규범의 절대적 강화만으로 설명하기는 어렵습니다.",
    resources: [
      { label: "국립해양박물관", href: "https://www.mmk.or.kr/" },
      { label: "부산튜브", href: "https://www.youtube.com/@Busan_is_good" },
    ],
  },
  {
    id: "science-public-learning",
    eventId: "science-center",
    day: 1,
    place: "부산 과학·해양 학습",
    subject: "과학사회",
    title: "과학 기술의 대중화",
    prompt: "부산과학체험관과 같은 교육 시설은 현대 사회에서 과학 기술의 발전을 대중에게 보급하고 사회화하는 기관의 역할을 수행한다.",
    options: ["O", "X"],
    answer: 0,
    stamp: "SCIENCE",
    code: "과학사회화",
    reward: 12,
    explanation: "과학관과 체험관은 지식을 전시하고 체험하게 하여 과학 기술을 시민의 일상 학습으로 연결합니다.",
    resources: [
      { label: "부산과학체험관", href: "https://home.pen.go.kr/scinuri/main.do" },
    ],
  },
  {
    id: "recreation-group-norm",
    eventId: "recreation",
    day: 1,
    place: "레크리에이션",
    subject: "공동체",
    title: "규칙과 공동체 문화",
    prompt: "모둠 활동에서 규칙을 함께 정하고 지키는 과정이 중요한 이유로 가장 적절한 것은?",
    options: ["공동체의 예측 가능성과 신뢰를 높이기 때문이다", "모든 학생의 의견을 없애기 위해서다", "경쟁을 완전히 금지하기 위해서다", "교사의 지시만 남기기 위해서다", "개인의 기록을 삭제하기 위해서다"],
    answer: 0,
    stamp: "CREW",
    code: "공동체",
    reward: 12,
    explanation: "규칙은 개인을 억누르기 위한 장치가 아니라 함께 움직이는 상황에서 안전과 신뢰를 만드는 약속입니다.",
    resources: [
      { label: "교육부", href: "https://www.moe.go.kr/" },
    ],
  },
  {
    id: "gamcheon-terrace",
    eventId: "gamcheon",
    day: 2,
    place: "감천문화마을",
    subject: "사회문화",
    title: "계단식 주거와 지형 순응",
    prompt: "감천문화마을의 좁은 골목과 계단식 주택처럼 산비탈이라는 환경을 극복하고 앞집의 햇빛을 가리지 않도록 형성된 주거 형태를 무엇이라 부를까요?",
    options: ["계단식 주택 또는 지형순응형 주거", "고층 아파트 단지", "계획 신도시", "역도시화 주거", "폐쇄형 리조트"],
    answer: 0,
    stamp: "VILLAGE",
    code: "계단식주택",
    reward: 18,
    explanation: "감천문화마을의 주거 경관은 자연환경과 피란민의 생활 조건이 함께 만든 지형순응형 공간으로 볼 수 있습니다.",
    resources: [
      { label: "감천문화마을 공식 사이트", href: "https://gamcheon.or.kr/" },
      { label: "국가건축정책위원회: 감천문화마을", href: "https://pcap.go.kr/sub.cs?m=56" },
    ],
  },
  {
    id: "gamcheon-regeneration",
    eventId: "gamcheon",
    day: 2,
    place: "감천문화마을",
    subject: "사회문화",
    title: "마을미술과 도시 재생",
    prompt: "2009년 마을미술 프로젝트를 통해 낡고 낙후되었던 감천문화마을이 문화 예술 공간으로 재탄생한 현상을 도시 사회학에서는 무엇이라고 부를까요?",
    options: ["도시 재생", "역도시화", "문화 지체", "관료제화", "인구 고령화"],
    answer: 0,
    stamp: "ART",
    code: "도시재생",
    reward: 18,
    explanation: "도시 재생은 오래된 공간을 철거만 하는 것이 아니라 지역의 역사와 생활, 문화 자원을 살려 새 가치를 만드는 과정입니다.",
    resources: [
      { label: "감천문화마을 공식 사이트", href: "https://gamcheon.or.kr/" },
      { label: "대한민국역사박물관: 감천문화마을", href: "https://archive.much.go.kr/data/01/folderView.do?jobdirSeq=962" },
    ],
  },
  {
    id: "gamcheon-touristification",
    eventId: "gamcheon",
    day: 2,
    place: "감천문화마을",
    subject: "사회문화",
    title: "지속 가능한 도시 재생",
    prompt: "관광객 증가로 소음, 쓰레기, 임대료 상승이 생길 때 역사적 상징성을 지키면서 주민 삶의 질을 보호하는 방안으로 가장 적절한 것은?",
    options: ["관광 수익 일부를 주민 환경 개선에 환원하고 방문 예절을 제도화한다", "주민 생활 공간을 모두 관광 상점으로 바꾼다", "역사 해설을 없애고 사진 촬영만 장려한다", "쓰레기 처리 책임을 주민에게만 맡긴다", "관광객 수가 많을수록 무조건 성공으로 본다"],
    answer: 0,
    stamp: "FAIR",
    code: "지속가능",
    reward: 20,
    explanation: "지속 가능한 도시 재생은 관광객 만족, 주민의 주거권, 장소의 역사적 기억 사이의 균형을 찾는 과정입니다.",
    resources: [
      { label: "감천문화마을 공식 사이트", href: "https://gamcheon.or.kr/" },
    ],
  },
  {
    id: "un-collective-memory",
    eventId: "busan-return",
    day: 2,
    place: "재한유엔기념공원",
    subject: "사회문화",
    title: "집단 기억과 평화",
    prompt: "재한유엔기념공원이 지니는 사회문화적 의미로 가장 적절한 것은?",
    options: ["지역 경제 활성화를 위한 상업적 공간", "국제 사회의 연대와 평화를 상징하는 집단 기억의 공간", "특정 국가의 영토 확장을 기념하는 공간", "배타적 민족주의를 강화하는 공간", "전통문화의 보존만을 위한 공간"],
    answer: 1,
    stamp: "PEACE",
    code: "평화기억",
    reward: 16,
    explanation: "기념공원은 전쟁의 희생을 기억하고 국제 연대와 평화의 가치를 되새기는 집단 기억의 장소입니다.",
    resources: [
      { label: "재한유엔기념공원", href: "https://www.unmck.or.kr/" },
      { label: "Turn Toward Busan 소개", href: "https://www.unmck.or.kr/kor/05_board/?kd=title&kw=&mcode=0405010000&mode=2&no=6838&page=62" },
    ],
  },
  {
    id: "un-transnational-solidarity",
    eventId: "busan-return",
    day: 2,
    place: "재한유엔기념공원",
    subject: "사회문화",
    title: "초국적 연대",
    prompt: "매년 11월 11일 세계가 부산을 향해 묵념하는 Turn Toward Busan 행사는 물리적 거리를 넘어 가치와 규범을 공유하는 초국적 연대의 사례로 볼 수 있다.",
    options: ["O", "X"],
    answer: 0,
    stamp: "UN",
    code: "턴투워드부산",
    reward: 14,
    explanation: "서로 다른 국가의 사람들이 같은 시간에 같은 기억을 공유하는 행위는 초국적 연대의 상징적 실천입니다.",
    resources: [
      { label: "재한유엔기념공원", href: "https://www.unmck.or.kr/" },
    ],
  },
  {
    id: "final-essay",
    eventId: "gamcheon",
    day: 2,
    place: "최종 서술형 과제",
    subject: "서술형",
    title: "지속 가능한 도시 재생 제안",
    prompt: "역사적 상징성을 잃지 않으면서 원주민의 삶의 질을 보호하고 관광객도 만족할 수 있는 지속 가능한 도시 재생 방안을 2가지 이상 제시한다면?",
    options: ["마을 보존 기금과 주민 환원", "방문 시간·동선 관리와 쓰레기 책임제", "공공 임대 상가와 생활권 보호", "주민 해설사·지역 상점 우선 참여", "위 방안들을 조합해 소감문에 서술하기"],
    answer: 4,
    stamp: "ESSAY",
    code: "서술형",
    reward: 22,
    explanation: "소감문에는 개념 이해, 문제 인식, 창의성과 실현성, 논리성을 기준으로 자신의 해결 방안을 적어 보세요.",
    resources: [
      { label: "감천문화마을 공식 사이트", href: "https://gamcheon.or.kr/" },
      { label: "도시재생종합정보체계", href: "https://www.city.go.kr/" },
    ],
  },
];

function createEscapeChallenge(
  missionId: string,
  scene: string,
  hint: string,
  item: EscapeInventoryItem,
): EscapeChallenge {
  const mission = missions.find((entry) => entry.id === missionId);
  if (!mission) throw new Error(`Unknown escape mission: ${missionId}`);
  return {
    id: `story-${missionId}`,
    questionId: missionId,
    missionId,
    stageIndex: 0,
    grantsItem: true,
    scene,
    typeLabel: mission.options.length === 2 ? "O/X" : "객관식",
    kind: "choice",
    title: mission.title,
    prompt: mission.prompt,
    options: mission.options,
    answer: mission.answer,
    explanation: mission.explanation ?? "정답과 관련된 사회문화 개념을 여행 장소와 연결해 보세요.",
    hint,
    item,
  };
}

function createEscapeChapters(team: TripTeam): EscapeChapter[] {
  const dayOneMissionIds =
    team === "A"
      ? ["market-migration", "rail-place-change", "yacht-symbolic-place"]
      : ["market-migration", "yacht-symbolic-place", "rail-place-change"];
  const dayOneScenes: Record<string, string> = {
    "market-migration": "국제시장의 오래된 가게 셔터에서 피란 시기의 장부 한 장을 발견했습니다.",
    "rail-place-change": "블루라인 승차권 뒷면에 시대에 따라 달라진 부산의 풍경이 겹쳐 보입니다.",
    "yacht-symbolic-place": "요트의 항해 장치가 멈췄습니다. 바다에 새겨진 장소의 의미를 찾아야 합니다.",
  };
  const dayOneItems = [
    { icon: "▣", label: "시장 장부 조각", fragment: "BU", detail: "첫 번째 여권 복구 문자" },
    { icon: "▤", label: "블루라인 승차권", fragment: "S", detail: "이동 순서가 표시된 두 번째 문자" },
    { icon: "◈", label: "요트 해도", fragment: "AN", detail: "항구 좌표에 숨은 마지막 문자" },
  ];

  if (team !== "A") {
    dayOneItems[1] = { icon: "◈", label: "요트 해도", fragment: "S", detail: "항구 좌표에 숨은 두 번째 문자" };
    dayOneItems[2] = { icon: "▤", label: "블루라인 승차권", fragment: "AN", detail: "이동 순서가 표시된 마지막 문자" };
  }

  const learningMissionId = team === "B" ? "science-public-learning" : "maritime-acculturation";
  const returnMissionId = team === "B" ? "maritime-acculturation" : "science-public-learning";
  const learningPlace = team === "B" ? "부산과학체험관" : "국립해양박물관";
  const returnPlace = team === "B" ? "국립해양박물관" : "부산과학체험관";

  return [
    {
      id: "story-day-1",
      day: 0,
      title: "항구도시의 첫 번째 열쇠",
      subtitle: `${team}팀 실제 이동 순서로 여권 조각을 회수합니다.`,
      briefing: "부산역 도착 직후 디지털 여행 여권의 첫 페이지가 잠겼습니다. 국제시장과 해양 코스에 흩어진 세 조각을 이동 순서대로 되찾아야 합니다.",
      objective: "무작위 문제 묶음을 통과해 세 문자 조각을 모으고 도시 이름을 입력하세요.",
      finalPrompt: "인벤토리의 문자 조각을 획득한 순서대로 연결하면 어느 도시의 영문 이름이 될까요?",
      finalAnswers: ["BUSAN", "부산"],
      finalHint: "첫 조각부터 띄어쓰기 없이 연결하세요. 우리가 도착한 도시의 이름입니다.",
      challenges: dayOneMissionIds.map((missionId, index) =>
        createEscapeChallenge(
          missionId,
          dayOneScenes[missionId],
          missionId === "market-migration"
            ? "전쟁과 재난처럼 본인의 의지와 무관한 이동에 주목하세요."
            : missionId === "rail-place-change"
              ? "문화가 시대와 세대에 따라 고정되지 않는다는 점을 떠올려 보세요."
              : "자연 공간도 사람들이 의미를 부여하면 특별한 장소가 됩니다.",
          dayOneItems[index],
        ),
      ),
    },
    {
      id: "story-day-2",
      day: 1,
      title: "바다와 과학의 암호",
      subtitle: `롯데월드 → ${learningPlace} → 레크리에이션 기록을 복구합니다.`,
      briefing: "시간기록국의 두 번째 서버가 부산의 파도 주파수에 잠겼습니다. 협동 규칙과 과학·해양 지식을 이용해 데이터 칩을 다시 작동시키세요.",
      objective: "세 개의 데이터 조각을 모아 서버를 깨우는 영문 암호를 완성하세요.",
      finalPrompt: "데이터 조각 WA, V, E를 순서대로 결합해 부산 바다를 상징하는 영문 암호를 입력하세요.",
      finalAnswers: ["WAVE", "웨이브"],
      finalHint: "영어로 '파도'를 뜻하는 네 글자입니다.",
      challenges: [
        createEscapeChallenge(
          "lotte-socialization",
          "롯데월드 입구의 전광판이 일행의 협동 규칙을 묻고 있습니다.",
          "친구들과 규칙과 역할을 배우는 사회적 과정을 생각해 보세요.",
          { icon: "◎", label: "놀이공원 규칙표", fragment: "WA", detail: "서버 암호의 앞부분" },
        ),
        createEscapeChallenge(
          learningMissionId,
          `${learningPlace}의 체험 장치에서 교류와 학습에 관한 오류 메시지가 나타났습니다.`,
          learningMissionId === "maritime-acculturation"
            ? "서로 다른 문화가 계속 접촉할 때 일어나는 변화를 떠올려 보세요."
            : "과학관이 시민에게 지식을 전달하는 역할을 생각해 보세요.",
          { icon: "◆", label: `${learningPlace} 데이터 칩`, fragment: "V", detail: "서버 암호의 가운데 문자" },
        ),
        createEscapeChallenge(
          "recreation-group-norm",
          "레크리에이션 입장 팔찌에 마지막 데이터 조각을 여는 공동체 문제가 나타났습니다.",
          "함께 움직일 때 규칙이 안전과 신뢰에 어떤 도움을 주는지 생각하세요.",
          { icon: "◇", label: "협동 팔찌", fragment: "E", detail: "서버 암호의 마지막 문자" },
        ),
      ],
    },
    {
      id: "story-day-3",
      day: 2,
      title: "15시 43분 귀환 작전",
      subtitle: `${returnPlace}에서 부산역 귀환 열차의 잠금을 해제합니다.`,
      briefing: "귀환 열차 출발 정보가 지워지고 여행 여권의 마지막 장이 잠겼습니다. 부산의 과학·해양 기록과 도시의 기억을 복원해 출발 시각 암호를 찾아야 합니다.",
      objective: "세 기록을 복구하고 숫자 조각을 연결해 KTX 출발 시각을 입력하세요.",
      finalPrompt: "획득한 숫자 조각을 순서대로 연결해 부산역에서 출발하는 KTX의 네 자리 시각을 입력하세요.",
      finalAnswers: ["1543", "15:43"],
      finalHint: "3일차 일정표의 부산역 출발 시간을 확인하세요.",
      challenges: [
        createEscapeChallenge(
          returnMissionId,
          `${returnPlace} 기록실에서 첫 번째 귀환 시각 조각을 발견했습니다.`,
          returnMissionId === "maritime-acculturation"
            ? "항구에서 서로 다른 문화가 만날 때 생기는 변화를 생각하세요."
            : "체험형 교육 시설이 사회에서 하는 역할을 떠올려 보세요.",
          { icon: "▦", label: `${returnPlace} 기록 카드`, fragment: "15", detail: "귀환 시각의 앞 두 자리" },
        ),
        createEscapeChallenge(
          "un-collective-memory",
          "시간기록국 보관함에서 부산의 전쟁 기억을 다룬 평화 기록이 열렸습니다.",
          "여러 국가가 함께 기억하고 평화를 약속하는 공간이라는 점에 주목하세요.",
          { icon: "✚", label: "평화 기록 좌표", fragment: "4", detail: "귀환 시각의 세 번째 숫자" },
        ),
        createEscapeChallenge(
          "gamcheon-touristification",
          "마지막 기록은 관광과 주민의 삶이 공존하는 도시 재생 원칙을 요구합니다.",
          "관광 수익, 주민 생활권, 방문 예절을 함께 고려한 답을 찾으세요.",
          { icon: "▧", label: "도시재생 승인 도장", fragment: "3", detail: "귀환 시각의 마지막 숫자" },
        ),
      ],
    },
  ];
}

const escapeQuestionSeeds: EscapeQuestion[] = [
  {
    id: "d1-forced-migration",
    day: 0,
    typeLabel: "객관식",
    kind: "choice",
    title: "피란민의 이동",
    prompt: "6.25 전쟁 당시 전국 각지에서 부산으로 사람들이 몰려든 현상을 설명하는 개념으로 가장 적절한 것은?",
    options: ["이촌향도", "강제적·사회적 인구 이동", "역도시화", "문화 지체"],
    answer: 1,
    explanation: "전쟁처럼 개인이 통제하기 어려운 상황에서 생활 터전을 옮기는 것은 강제적·사회적 인구 이동입니다.",
    hint: "스스로 더 좋은 일자리를 찾아 이동한 경우와 전쟁 때문에 떠난 경우를 구분하세요.",
  },
  {
    id: "d1-informal-economy",
    day: 0,
    typeLabel: "자료 해석",
    kind: "choice",
    title: "도떼기시장의 성장",
    prompt: "국제시장이 전쟁 직후 빠르게 성장한 배경과 가장 거리가 먼 것은?",
    options: ["피란민의 생계 활동", "구호품과 군수물자 유입", "국가 주도 신도시 계획", "비공식 거래의 확대"],
    answer: 2,
    explanation: "국제시장은 국가가 계획한 신도시가 아니라 피란민의 생계와 물자 거래 속에서 자생적으로 성장했습니다.",
    hint: "계획된 개발보다 자연스럽게 형성된 시장이라는 점을 생각하세요.",
  },
  {
    id: "d1-book-alley",
    day: 0,
    typeLabel: "O/X",
    kind: "choice",
    title: "보수동 책방골목",
    prompt: "보수동 책방골목은 전쟁 시기 학생과 피란민에게 책과 지식을 공급한 자생적 문화 공간으로 볼 수 있다.",
    options: ["O", "X"],
    answer: 0,
    explanation: "책방골목은 생계 공간이면서 교육 자료와 지식이 유통된 생활 문화 공간이었습니다.",
    hint: "전쟁 시기 책을 구하기 어려웠던 학생들의 상황을 떠올려 보세요.",
  },
  {
    id: "d1-terraced-housing",
    day: 0,
    typeLabel: "단답형",
    kind: "short",
    title: "산비탈의 주거 형태",
    prompt: "산비탈 지형을 따르고 앞집의 햇빛을 가리지 않도록 층층이 형성된 주거 형태를 무엇이라고 할까요?",
    acceptedAnswers: ["계단식 주택", "계단식주택", "지형순응형 주거", "지형순응형주거"],
    explanation: "감천문화마을의 경관은 자연환경과 생활 조건을 함께 반영한 계단식 또는 지형순응형 주거입니다.",
    hint: "계단처럼 층층이 이어진 모습과 지형을 거스르지 않는 배치를 표현해 보세요.",
  },
  {
    id: "d1-urban-regeneration",
    day: 0,
    typeLabel: "단답형",
    kind: "short",
    title: "낡은 마을의 재탄생",
    prompt: "지역의 역사와 생활을 살리면서 낡은 공간에 새로운 가치를 만드는 과정을 무엇이라고 할까요?",
    acceptedAnswers: ["도시 재생", "도시재생"],
    explanation: "도시 재생은 전면 철거만이 아니라 기존 공동체와 장소의 기억을 살려 지역을 회복하는 과정입니다.",
    hint: "도시를 없애는 것이 아니라 다시 살아나게 한다는 표현입니다.",
  },
  {
    id: "d1-cultural-change",
    day: 0,
    typeLabel: "개념 선택",
    kind: "choice",
    title: "장소 의미의 변화",
    prompt: "같은 장소가 세대와 시대에 따라 피란민 주거지, 생활 공간, 관광지로 다르게 해석되는 문화의 특성은?",
    options: ["변동성", "획일성", "불변성", "생물학적 유전"],
    answer: 0,
    explanation: "문화는 고정되지 않고 시대적 상황과 세대의 경험에 따라 계속 변합니다.",
    hint: "시간이 지나도 절대 바뀌지 않는다는 설명의 반대입니다.",
  },
  {
    id: "d1-symbolism",
    day: 0,
    typeLabel: "단답형",
    kind: "short",
    title: "문탠로드의 의미",
    prompt: "자연 공간에 감성적·문화적 의미를 부여해 특별한 장소로 만드는 문화의 속성은?",
    acceptedAnswers: ["상징성", "의미 부여", "의미부여"],
    explanation: "사람들은 자연환경에 이야기와 감정을 부여해 새로운 상징적 가치를 만듭니다.",
    hint: "어떤 대상이 그 자체를 넘어 특별한 뜻을 나타내는 성질입니다.",
  },
  {
    id: "d1-touristification",
    day: 0,
    typeLabel: "단답형",
    kind: "short",
    title: "관광지의 생활 갈등",
    prompt: "관광객 증가로 주민의 생활 공간이 관광 소비 공간으로 바뀌고 주민이 떠나는 현상을 무엇이라고 할까요?",
    acceptedAnswers: ["투어리스티피케이션", "관광 젠트리피케이션", "관광젠트리피케이션"],
    explanation: "투어리스티피케이션은 과도한 관광으로 지역 주민의 생활권과 주거 환경이 약화되는 현상입니다.",
    hint: "관광을 뜻하는 영어 단어와 젠트리피케이션이 결합된 표현입니다.",
  },
  {
    id: "d1-market-evidence",
    day: 0,
    typeLabel: "현장 추론",
    kind: "choice",
    title: "시장 형성의 증거",
    prompt: "국제시장이 피란민의 생계 공간이었다는 설명을 뒷받침하는 현장 자료로 가장 적절한 것은?",
    options: ["수입품·구호품 거래 기록", "신도시 아파트 분양도", "농촌 토지대장", "공항 출국 통계"],
    answer: 0,
    explanation: "구호품과 수입물자 거래 기록은 전쟁기 시장의 생계 활동과 비공식 경제를 보여 줍니다.",
    hint: "시장 안에서 실제로 사고팔았던 물건과 직접 연결되는 자료를 찾으세요.",
  },
  {
    id: "d1-port-culture",
    day: 0,
    typeLabel: "O/X",
    kind: "choice",
    title: "항구와 문화 교류",
    prompt: "항구로 들어온 외래 물자는 경제에만 영향을 주며 음식, 언어, 음악 같은 문화에는 영향을 주지 않는다.",
    options: ["O", "X"],
    answer: 1,
    explanation: "항구의 교류는 물자뿐 아니라 음식, 언어, 음악, 생활양식의 변화로 이어집니다.",
    hint: "사람과 물자가 함께 이동할 때 생활 방식도 달라질 수 있습니다.",
  },
  {
    id: "d1-hillside-context",
    day: 0,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "산복도로의 사회적 배경",
    prompt: "피란민이 산비탈에 주거지를 만들게 된 사회적 배경으로 가장 적절한 것은?",
    options: ["도심의 주거 공간 부족과 급격한 인구 증가", "휴양 리조트 개발", "농업 기계화", "교외 고급 주택 선호"],
    answer: 0,
    explanation: "전쟁기 부산의 급격한 인구 증가와 평지 주거지 부족이 산비탈 정착의 중요한 배경이었습니다.",
    hint: "짧은 시간 안에 많은 사람이 부산으로 이동했다는 사실을 생각하세요.",
  },
  {
    id: "d1-respectful-tourism",
    day: 0,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "주민을 배려하는 관광",
    prompt: "주민이 생활하는 골목을 방문하는 태도로 가장 적절한 것은?",
    options: ["정해진 동선을 지키고 소음과 쓰레기를 줄인다", "집 안을 자유롭게 촬영한다", "밤늦게 큰 소리로 이동한다", "사유지 표지를 무시한다"],
    answer: 0,
    explanation: "생활 관광지에서는 주민의 사생활과 생활권을 존중하는 방문 규칙이 필요합니다.",
    hint: "관광객의 편의뿐 아니라 그곳에 사는 사람의 일상을 함께 생각하세요.",
  },
  {
    id: "d2-socialization",
    day: 1,
    typeLabel: "객관식",
    kind: "choice",
    title: "또래 집단과 사회화",
    prompt: "수학여행에서 친구들과 규칙을 지키고 역할을 배우는 과정에 가장 가까운 개념은?",
    options: ["또래 집단을 통한 사회화", "계급 재생산", "역도시화", "문화 사대주의"],
    answer: 0,
    explanation: "또래와 함께 규칙과 역할을 배우는 활동은 학교 밖에서 이루어지는 사회화 경험입니다.",
    hint: "사회의 규범과 역할을 배우는 과정을 떠올려 보세요.",
  },
  {
    id: "d2-acculturation",
    day: 1,
    typeLabel: "단답형",
    kind: "short",
    title: "항구 도시의 문화 변화",
    prompt: "서로 다른 문화가 지속적으로 접촉해 새로운 문화 요소가 생기거나 기존 문화가 변하는 현상은?",
    acceptedAnswers: ["문화 접변", "문화접변"],
    explanation: "문화 접변은 서로 다른 문화 체계가 계속 접촉하면서 나타나는 상호 변화입니다.",
    hint: "문화와 문화가 만나 서로 영향을 주고받는다는 뜻입니다.",
  },
  {
    id: "d2-global-change",
    day: 1,
    typeLabel: "객관식",
    kind: "choice",
    title: "부산의 글로벌 문화",
    prompt: "여러 나라 사람들의 문화가 부산에 유입되며 나타났다고 보기 가장 어려운 것은?",
    options: ["새로운 식문화", "언어 소통의 어려움", "대중음악의 확산", "전통 규범의 절대적 강화"],
    answer: 3,
    explanation: "외부 문화와의 접촉은 새로운 문화 형성과 갈등을 만들지만 전통 규범의 절대적 강화만으로 설명하기 어렵습니다.",
    hint: "문화 교류는 대체로 변화와 혼합을 일으킵니다.",
  },
  {
    id: "d2-science-institution",
    day: 1,
    typeLabel: "O/X",
    kind: "choice",
    title: "과학체험관의 역할",
    prompt: "과학체험관은 과학 기술을 시민에게 보급하고 체험을 통해 학습하게 하는 사회화 기관의 역할을 한다.",
    options: ["O", "X"],
    answer: 0,
    explanation: "과학관과 체험관은 전문 지식을 시민의 일상 학습과 연결하는 교육 기관입니다.",
    hint: "전시물을 보는 것뿐 아니라 직접 체험하고 배우는 공간입니다.",
  },
  {
    id: "d2-group-norm",
    day: 1,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "공동체 규칙",
    prompt: "레크리에이션에서 모두가 함께 정한 규칙을 지켜야 하는 가장 중요한 이유는?",
    options: ["활동의 안전과 신뢰를 높이기 위해", "개인의 의견을 없애기 위해", "경쟁을 금지하기 위해", "기록을 삭제하기 위해"],
    answer: 0,
    explanation: "공동체 규칙은 함께 행동할 때의 예측 가능성, 안전, 신뢰를 높입니다.",
    hint: "여러 사람이 동시에 활동할 때 필요한 두 가지 가치를 생각하세요.",
  },
  {
    id: "d2-ride-safety",
    day: 1,
    typeLabel: "안전 판단",
    kind: "choice",
    title: "놀이기구 안전",
    prompt: "놀이기구 탑승 전 친구가 몸 상태가 좋지 않다고 말했을 때 가장 적절한 행동은?",
    options: ["탑승을 미루고 교사나 안전요원에게 알린다", "괜찮다며 바로 태운다", "친구끼리 약을 나눠 먹는다", "아무에게도 말하지 않는다"],
    answer: 0,
    explanation: "체험 활동에서는 자신의 몸 상태를 알리고 안전요원의 기준을 따르는 것이 우선입니다.",
    hint: "재미보다 건강과 공식적인 도움 요청이 먼저입니다.",
  },
  {
    id: "d2-cultural-lag",
    day: 1,
    typeLabel: "개념 선택",
    kind: "choice",
    title: "기술과 규범의 속도 차이",
    prompt: "새로운 과학 기술은 빠르게 발전했지만 관련 법과 윤리 기준이 뒤늦게 마련되는 현상은?",
    options: ["문화 지체", "문화 접변", "도시 재생", "역도시화"],
    answer: 0,
    explanation: "물질문화의 변화 속도를 제도와 가치 같은 비물질문화가 따라가지 못할 때 문화 지체가 나타납니다.",
    hint: "한쪽의 변화가 다른 쪽보다 늦게 따라오는 현상입니다.",
  },
  {
    id: "d2-informal-learning",
    day: 1,
    typeLabel: "자료 해석",
    kind: "choice",
    title: "여행 속 비공식 학습",
    prompt: "친구에게 전시물 사용법을 배우고 함께 해결책을 찾는 장면은 어떤 학습의 사례인가요?",
    options: ["또래 상호작용을 통한 비공식 학습", "강제 이주", "관료제화", "젠트리피케이션"],
    answer: 0,
    explanation: "교실 밖에서 친구와 상호작용하며 배우는 것도 중요한 비공식 학습입니다.",
    hint: "교사가 직접 설명하지 않아도 친구 사이에서 학습이 일어납니다.",
  },
  {
    id: "d2-globalization",
    day: 1,
    typeLabel: "O/X",
    kind: "choice",
    title: "글로벌 네트워크",
    prompt: "항구 도시의 발전은 지역 내부의 변화만으로 설명할 수 있고 국제 교류와는 관련이 없다.",
    options: ["O", "X"],
    answer: 1,
    explanation: "부산의 성장과 문화는 해양 교통과 국제 교류 네트워크의 영향을 크게 받았습니다.",
    hint: "항구는 다른 지역과 국가를 연결하는 관문입니다.",
  },
  {
    id: "d2-risk-society",
    day: 1,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "현대 사회의 위험 관리",
    prompt: "대규모 체험 시설에서 사고를 줄이는 방법으로 가장 적절한 것은?",
    options: ["개인의 주의와 시설의 안전 시스템을 함께 강화한다", "개인에게 모든 책임을 맡긴다", "안전 규칙을 없앤다", "사고 기록을 공개하지 않는다"],
    answer: 0,
    explanation: "현대 사회의 위험은 개인의 주의뿐 아니라 제도와 기술적 안전장치가 함께 관리해야 합니다.",
    hint: "개인과 시설 중 한쪽만으로 충분한지 생각해 보세요.",
  },
  {
    id: "d2-maritime-network",
    day: 1,
    typeLabel: "객관식",
    kind: "choice",
    title: "해양 교류망",
    prompt: "국립해양박물관의 선박과 항로 자료가 가장 잘 보여 주는 사회문화적 특징은?",
    options: ["지역 간 연결과 문화 교류", "문화의 완전한 고립", "농촌 인구 감소만", "전통의 불변성"],
    answer: 0,
    explanation: "선박과 항로는 상품뿐 아니라 사람, 정보, 문화를 연결하는 네트워크입니다.",
    hint: "바닷길을 따라 무엇이 함께 이동했는지 생각하세요.",
  },
  {
    id: "d2-peer-group",
    day: 1,
    typeLabel: "단답형",
    kind: "short",
    title: "친구 관계의 사회 집단",
    prompt: "비슷한 연령과 지위를 가진 친구들이 상호작용하며 규범을 배우는 집단을 무엇이라고 할까요?",
    acceptedAnswers: ["또래 집단", "또래집단"],
    explanation: "또래 집단은 청소년기의 가치와 행동 양식을 배우는 중요한 사회화 집단입니다.",
    hint: "학교에서 같은 나이대의 친구들을 부르는 사회학 용어입니다.",
  },
  {
    id: "d2-media-literacy",
    day: 1,
    typeLabel: "미디어 판단",
    kind: "choice",
    title: "관광 정보 확인",
    prompt: "SNS에서 본 부산 관광 정보를 활용하는 태도로 가장 적절한 것은?",
    options: ["공식 자료와 비교하고 촬영 규칙을 확인한다", "조회 수가 높으면 무조건 믿는다", "출처 없이 다시 공유한다", "주민 사생활을 공개한다"],
    answer: 0,
    explanation: "미디어 리터러시는 정보의 출처와 맥락을 확인하고 책임 있게 활용하는 능력입니다.",
    hint: "인기보다 출처와 사실 확인이 먼저입니다.",
  },
  {
    id: "d3-collective-memory",
    day: 2,
    typeLabel: "객관식",
    kind: "choice",
    title: "재한유엔기념공원의 의미",
    prompt: "재한유엔기념공원의 사회문화적 의미로 가장 적절한 것은?",
    options: ["상업 중심 공간", "국제 연대와 평화의 집단 기억 공간", "영토 확장 기념 공간", "배타적 민족주의 공간"],
    answer: 1,
    explanation: "기념공원은 전쟁 희생을 함께 기억하고 국제 연대와 평화를 되새기는 장소입니다.",
    hint: "여러 나라가 함께 기억하는 가치에 주목하세요.",
  },
  {
    id: "d3-turn-toward-busan",
    day: 2,
    typeLabel: "O/X",
    kind: "choice",
    title: "Turn Toward Busan",
    prompt: "매년 11월 11일 세계가 부산을 향해 묵념하는 행사는 초국적 연대의 사례로 볼 수 있다.",
    options: ["O", "X"],
    answer: 0,
    explanation: "서로 다른 국가의 사람들이 같은 시간과 기억을 공유하는 것은 초국적 연대의 상징입니다.",
    hint: "국경을 넘어 같은 가치와 기억을 공유하는 행동입니다.",
  },
  {
    id: "d3-touristification",
    day: 2,
    typeLabel: "단답형",
    kind: "short",
    title: "과잉 관광의 문제",
    prompt: "관광객 증가로 주민의 일상과 주거 환경이 침해되는 현상을 무엇이라고 할까요?",
    acceptedAnswers: ["투어리스티피케이션", "관광 젠트리피케이션", "관광젠트리피케이션"],
    explanation: "투어리스티피케이션은 관광 중심 변화가 주민의 생활권을 약화시키는 현상입니다.",
    hint: "관광을 뜻하는 말과 지역 변화 현상을 결합한 용어입니다.",
  },
  {
    id: "d3-gentrification",
    day: 2,
    typeLabel: "객관식",
    kind: "choice",
    title: "젠트리피케이션",
    prompt: "젠트리피케이션에 대한 설명으로 옳은 것은?",
    options: ["지역이 번성하며 임대료가 올라 원주민이 밀려나는 현상", "도시 인구가 농촌으로만 이동하는 현상", "전통문화가 변하지 않는 현상", "과학 기술이 보급되는 현상"],
    answer: 0,
    explanation: "지역 활성화의 이익과 임대료 상승에 따른 원주민 이탈이 함께 나타나는 것이 핵심입니다.",
    hint: "지역의 인기 상승이 기존 주민에게 항상 좋은 결과만 주는지 생각하세요.",
  },
  {
    id: "d3-sustainable-plan",
    day: 2,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "지속 가능한 관광",
    prompt: "관광과 주민 생활을 함께 보호하는 방안으로 가장 적절한 것은?",
    options: ["관광 수익 일부를 주민 환경 개선에 환원한다", "주민 공간을 모두 상점으로 바꾼다", "방문 예절을 없앤다", "쓰레기 책임을 주민에게만 맡긴다"],
    answer: 0,
    explanation: "관광 수익의 주민 환원과 생활권 보호는 관광의 비용과 편익을 공정하게 나누는 방법입니다.",
    hint: "관광으로 생긴 이익이 누구에게 돌아가야 하는지 생각하세요.",
  },
  {
    id: "d3-regeneration",
    day: 2,
    typeLabel: "단답형",
    kind: "short",
    title: "지역을 살리는 변화",
    prompt: "기존 주민과 장소의 역사성을 살리면서 낙후된 지역을 회복하는 정책을 무엇이라고 할까요?",
    acceptedAnswers: ["도시 재생", "도시재생"],
    explanation: "도시 재생은 기존 공동체와 자원을 활용해 지역의 사회·문화·경제적 활력을 회복합니다.",
    hint: "전면 철거가 아니라 기존 도시를 다시 살리는 방식입니다.",
  },
  {
    id: "d3-memory",
    day: 2,
    typeLabel: "단답형",
    kind: "short",
    title: "사회의 공동 기억",
    prompt: "한 사회의 구성원들이 기념식, 장소, 기록을 통해 함께 공유하는 과거의 기억을 무엇이라고 할까요?",
    acceptedAnswers: ["집단 기억", "집단기억"],
    explanation: "집단 기억은 사회 구성원이 장소, 의례, 교육을 통해 과거를 공동으로 해석하고 전승하는 방식입니다.",
    hint: "개인 한 사람의 기억이 아니라 구성원이 함께 가진 기억입니다.",
  },
  {
    id: "d3-solidarity",
    day: 2,
    typeLabel: "단답형",
    kind: "short",
    title: "국경을 넘는 연대",
    prompt: "국가 경계를 넘어 사람들이 같은 가치와 규범을 공유하며 협력하는 관계를 무엇이라고 할까요?",
    acceptedAnswers: ["초국적 연대", "초국적연대"],
    explanation: "초국적 연대는 국경을 넘어 공동의 기억과 가치, 문제 해결에 참여하는 관계입니다.",
    hint: "'국가를 초월한다'는 뜻의 표현을 사용합니다.",
  },
  {
    id: "d3-renewal-comparison",
    day: 2,
    typeLabel: "비교 판단",
    kind: "choice",
    title: "재개발과 도시 재생",
    prompt: "도시 재생이 전면 철거식 재개발과 구별되는 특징은?",
    options: ["기존 공동체와 지역 자원을 활용한다", "모든 건물을 한꺼번에 철거한다", "주민 참여를 배제한다", "역사 자료를 없앤다"],
    answer: 0,
    explanation: "도시 재생은 지역의 역사, 주민, 자원을 보존하고 활용하는 점을 중요하게 봅니다.",
    hint: "새것으로 완전히 바꾸기보다 기존의 가치를 살리는 방식입니다.",
  },
  {
    id: "d3-resident-rights",
    day: 2,
    typeLabel: "상황 판단",
    kind: "choice",
    title: "주민 생활권 보호",
    prompt: "관광지 골목의 주민 생활권을 보호하는 정책으로 가장 적절한 것은?",
    options: ["방문 시간과 촬영 구역을 주민과 협의해 운영한다", "주민 동의 없이 야간 행사를 늘린다", "모든 주택을 숙박업소로 바꾼다", "민원을 받지 않는다"],
    answer: 0,
    explanation: "주민 참여를 바탕으로 방문 시간과 동선을 관리하면 관광과 생활의 충돌을 줄일 수 있습니다.",
    hint: "정책을 정할 때 실제로 그곳에 사는 사람의 의견이 포함되어야 합니다.",
  },
  {
    id: "d3-cultural-variability",
    day: 2,
    typeLabel: "O/X",
    kind: "choice",
    title: "문화의 변동성",
    prompt: "한 장소의 의미는 시대와 세대가 달라져도 항상 동일하게 유지된다.",
    options: ["O", "X"],
    answer: 1,
    explanation: "장소의 문화적 의미는 사회 변화와 미디어, 세대 경험에 따라 달라집니다.",
    hint: "피란민의 생활 공간이 오늘날 관광지가 된 사례를 떠올려 보세요.",
  },
  {
    id: "d3-public-rent",
    day: 2,
    typeLabel: "정책 선택",
    kind: "choice",
    title: "임대료 상승 대응",
    prompt: "도시 재생 지역에서 기존 상인이 밀려나는 문제를 줄일 수 있는 정책은?",
    options: ["공공 임대 상가와 장기 임대 협약", "단기 임대료 무제한 인상", "지역 상점 철거", "대기업만 입점 허용"],
    answer: 0,
    explanation: "공공 임대 상가와 장기 협약은 지역 상인의 영업 지속성과 지역 공동체를 보호합니다.",
    hint: "임대료를 감당하기 어려운 기존 상인이 계속 머물 수 있는 장치입니다.",
  },
  {
    id: "d3-preservation-fund",
    day: 2,
    typeLabel: "자료 해석",
    kind: "choice",
    title: "마을 보존 기금",
    prompt: "관광객에게 받은 소액의 보존 기금을 주민 환경 개선에 쓰는 정책이 해결하려는 문제는?",
    options: ["관광으로 생긴 사회적 비용의 공정한 분담", "관광객 수의 무조건적 증가", "주민 참여의 축소", "역사 해설의 폐지"],
    answer: 0,
    explanation: "관광으로 생긴 소음과 쓰레기 같은 비용을 방문객도 함께 부담하도록 하는 사회적 합의입니다.",
    hint: "관광의 이익뿐 아니라 그 과정에서 발생한 비용을 누가 부담할지 생각하세요.",
  },
  {
    id: "d3-final-reasoning",
    day: 2,
    typeLabel: "서술 근거",
    kind: "choice",
    title: "지속 가능한 도시 재생",
    prompt: "지속 가능한 도시 재생 방안에 반드시 포함되어야 할 관점의 조합은?",
    options: ["역사 보존·주민 삶·관광 만족의 균형", "관광객 수만의 증가", "상업 시설만의 확대", "주민 이주와 기록 삭제"],
    answer: 0,
    explanation: "지속 가능성은 경제적 이익뿐 아니라 주민의 권리와 역사·문화적 가치의 균형을 요구합니다.",
    hint: "한 집단의 이익만이 아니라 세 가지 가치를 함께 고려하세요.",
  },
];

function rotateQuestionOptions(question: EscapeQuestion, offset: number) {
  if (!question.options?.length || typeof question.answer !== "number") {
    return { options: question.options, answer: question.answer };
  }
  const shift = offset % question.options.length;
  const options = [
    ...question.options.slice(shift),
    ...question.options.slice(0, shift),
  ];
  const answer =
    (question.answer - shift + question.options.length) % question.options.length;
  return { options, answer };
}

function createQuestionVariant(question: EscapeQuestion, variant: number): EscapeQuestion {
  const prefixes = [
    "",
    "[현장 기록] 자료를 읽고 판단하세요. ",
    "[시간기록국 재검증] 가장 정확한 답을 찾으세요. ",
    "[친구 설명 미션] 근거를 떠올리며 답하세요. ",
    "[최종 검수] 비슷한 개념에 주의하여 답하세요. ",
  ];
  const rotated = rotateQuestionOptions(question, variant);
  return {
    ...question,
    id: `${question.id}-v${variant + 1}`,
    typeLabel: variant === 0 ? question.typeLabel : `변형 ${question.typeLabel}`,
    prompt: `${prefixes[variant] ?? prefixes[0]}${question.prompt}`,
    options: rotated.options,
    answer: rotated.answer,
  };
}

const escapeQuestionBank: EscapeQuestion[] = [
  ...escapeQuestionSeeds.flatMap((question) =>
    [0, 1, 2].map((variant) => createQuestionVariant(question, variant)),
  ),
  ...escapeQuestionSeeds
    .slice(0, 33)
    .map((question) => createQuestionVariant(question, 3)),
];

function shuffleEscapeQuestions(items: EscapeQuestion[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomValue);
    const target = randomValue[0] % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function createRandomEscapeAttempt(chapter: EscapeChapter, previousQuestionIds: string[]) {
  const questionCount = 10;
  const familyId = (questionId: string) => questionId.replace(/-v\d+$/, "");
  const previousFamilies = new Set(previousQuestionIds.map(familyId));
  const orderedPool = [
    ...shuffleEscapeQuestions(
      escapeQuestionBank.filter((question) => !previousFamilies.has(familyId(question.id))),
    ),
    ...shuffleEscapeQuestions(
      escapeQuestionBank.filter((question) => previousFamilies.has(familyId(question.id))),
    ),
  ];
  const selected: EscapeQuestion[] = [];
  const selectedFamilies = new Set<string>();
  for (const question of orderedPool) {
    const family = familyId(question.id);
    if (selectedFamilies.has(family)) continue;
    selected.push(question);
    selectedFamilies.add(family);
    if (selected.length === questionCount) break;
  }
  const stageSizes = [3, 3, 4];
  const result: EscapeChallenge[] = [];
  let questionIndex = 0;

  chapter.challenges.forEach((baseChallenge, stageIndex) => {
    const stageSize = stageSizes[stageIndex];
    for (let position = 0; position < stageSize; position += 1) {
      const question = selected[questionIndex];
      if (!question) break;
      result.push({
        ...baseChallenge,
        id: `${chapter.id}-${question.id}`,
        questionId: question.id,
        stageIndex,
        grantsItem: position === stageSize - 1,
        scene:
          position === 0
            ? baseChallenge.scene
            : `${baseChallenge.item.label}을 회수하기 위한 추가 보안 질문이 나타났습니다.`,
        typeLabel: question.typeLabel,
        kind: question.kind,
        title: question.title,
        prompt: question.prompt,
        options: question.options,
        answer: question.answer,
        acceptedAnswers: question.acceptedAnswers,
        explanation: question.explanation,
        hint: question.hint,
      });
      questionIndex += 1;
    }
  });

  return result;
}

const learningCards: LearningSlide[] = [
  {
    subject: "사회문화",
    title: "국제시장: 피란민, 생계, 비공식 경제",
    body: "피란민의 생계 활동, 군수물자 유입, 도떼기시장이라는 이름의 의미를 연결해 부산 원도심의 형성 과정을 살펴봅니다.",
    href: "https://www.bsjunggu.go.kr/board/view.junggu?boardId=LIFE&dataSid=55996&menuCd=DOM_000000201001000000",
    mediaLabel: "공식 자료",
  },
  {
    subject: "도시재생",
    title: "감천문화마을: 계단식 주거와 마을미술",
    body: "피란민 주거지였던 산복마을이 예술과 관광 공간으로 바뀐 과정을 보며 도시 재생과 투어리스티피케이션을 함께 생각합니다.",
    href: "https://gamcheon.or.kr/",
    mediaLabel: "공식 사이트",
  },
  {
    subject: "집단기억",
    title: "재한유엔기념공원: 전쟁 기억과 초국적 연대",
    body: "Turn Toward Busan처럼 전 세계가 같은 기억을 공유하는 방식이 평화와 국제 연대를 어떻게 만드는지 탐구합니다.",
    href: "https://www.unmck.or.kr/",
    mediaLabel: "공식 사이트",
  },
  {
    subject: "문화접변",
    title: "국립해양박물관: 항구 도시와 글로벌 교류",
    body: "항구 도시는 사람, 물자, 언어, 음식, 대중문화가 만나는 접점입니다. 부산의 해양성과 문화 접변을 연결해 봅니다.",
    href: "https://www.mmk.or.kr/",
    mediaLabel: "공식 사이트",
  },
  {
    subject: "영상 학습",
    title: "부산튜브와 공식 자료로 배경지식 넓히기",
    body: "장소를 방문하기 전후로 부산 공식 영상과 기관 자료를 함께 보면 사진 기록이 단순 인증샷을 넘어 학습 기록이 됩니다.",
    href: "https://www.youtube.com/@Busan_is_good",
    mediaLabel: "유튜브",
    videoReward: 100,
    minimumSeconds: 60,
  },
  {
    subject: "서술형",
    title: "지속 가능한 도시 재생 최종 과제",
    body: "관광객 만족, 주민 삶의 질, 역사적 상징성을 모두 고려해 구체적인 해결 방안을 2가지 이상 소감문에 정리해 보세요.",
    href: "https://www.city.go.kr/",
    mediaLabel: "심화 자료",
  },
];

const safetyCards: SafetySlide[] = [
  {
    category: "이동 안전",
    title: "도보 이동",
    summary: "횡단보도와 주차장에서는 속도보다 확인이 먼저입니다.",
    points: [
      "신호 대기 중에는 차도 아래로 내려서지 않습니다.",
      "초록불이 깜박이면 무리하지 말고 다음 신호를 기다립니다.",
      "이동 중 밀치기, 장난, 휴대폰·이어폰 사용을 줄입니다.",
      "단체 이동 중에는 무리에서 이탈하지 않고 지도교사의 안내를 따릅니다.",
    ],
    action: "멈춤, 좌우 확인, 함께 이동",
  },
  {
    category: "교통 안전",
    title: "버스와 도시철도",
    summary: "타고 내리는 순간과 문 주변에서 사고가 가장 많이 생길 수 있습니다.",
    points: [
      "버스에서는 안전띠를 착용하고 운행 중 자리를 이동하지 않습니다.",
      "승하차 전 좌우를 살피고 오토바이·후진 차량을 확인합니다.",
      "도시철도는 내리는 사람이 먼저이며, 열차와 승강장 사이를 주의합니다.",
      "스크린도어에 기대거나 억지로 열지 않고, 문이 닫힐 때 끼어 타지 않습니다.",
    ],
    action: "안전띠, 차례, 문 주변 주의",
  },
  {
    category: "차량 비상",
    title: "전세버스 비상 대처",
    summary: "비상 상황에서는 빠르게 움직이되, 질서를 잃지 않는 것이 핵심입니다.",
    points: [
      "출발 전 소화기와 비상탈출용 망치 위치를 확인합니다.",
      "화재나 사고 시 119 신고와 교사 안내에 따라 도로 밖 안전지대로 이동합니다.",
      "탈출구가 막히면 비상망치로 유리창 모서리를 깨고 통로를 확보합니다.",
      "하차 후에는 함께 온 친구의 인원을 확인하고 임의로 이동하지 않습니다.",
    ],
    action: "119, 안전지대, 인원 확인",
  },
  {
    category: "식사 위생",
    title: "식중독 예방",
    summary: "맛있게 먹는 것만큼 안전하게 먹는 것도 여행 기록의 일부입니다.",
    points: [
      "식사 전후 손 씻기와 개인 위생을 지킵니다.",
      "평소 알레르기나 먹기 어려운 음식은 미리 선생님께 알립니다.",
      "구토, 복통, 설사 증상이 있으면 참지 말고 즉시 인솔교사에게 말합니다.",
      "같은 증상이 여러 명에게 나타나면 단체 활동보다 건강 확인이 우선입니다.",
    ],
    action: "손 씻기, 알레르기 공유, 즉시 보고",
  },
  {
    category: "숙소 안전",
    title: "숙소 생활",
    summary: "숙소에서는 생활 규칙과 비상 동선을 아는 것이 안전의 시작입니다.",
    points: [
      "입실 후 비상구, 대피 경로, 방송 시설 위치를 확인합니다.",
      "객실 안 위험한 장난이나 고장 난 물건 사용을 피합니다.",
      "야간에는 정해진 생활 규칙과 연락 체계를 지킵니다.",
      "화재가 나면 자세를 낮추고 젖은 수건 등으로 코와 입을 막고 이동합니다.",
    ],
    action: "비상구 확인, 생활 규칙, 침착한 대피",
  },
  {
    category: "응급 상황",
    title: "사고가 났을 때",
    summary: "친구를 돕고 싶을수록 먼저 선생님과 119에 알리는 것이 중요합니다.",
    points: [
      "목·허리 손상이 의심되면 학생을 함부로 움직이지 않습니다.",
      "사고 위치, 다친 사람 수, 증상을 침착하게 전달합니다.",
      "주변 학생은 모여서 구경하지 말고 안전한 곳에서 기다립니다.",
      "사진 촬영보다 구조 요청과 인솔교사 안내가 우선입니다.",
    ],
    action: "알리기, 움직이지 않기, 안전 확보",
  },
];

const gameLinks = [
  {
    title: "핸드러시",
    description: "반응 속도와 집중력을 겨루는 손 빠르기 게임입니다.",
    href: "https://mathlove22.github.io/hand-rush-car/",
  },
  {
    title: "핸드 카트라이더",
    description: "손동작으로 카트를 조종하며 친구들과 주행 기록을 겨루는 레이싱 게임입니다.",
    href: "https://handcar26.netlify.app/?deploy=6a8578465e6ea0589ddfb28b",
  },
  {
    title: "야구게임",
    description: "수학적 판단과 타이밍을 함께 쓰는 야구형 활동입니다.",
    href: "https://script.google.com/macros/s/AKfycbxMsBhxSb1CPQx2DryDZngjZhQF_XaKnkrfVMn3RpRMkkr0TbVx1TNrIxixkReiLuqgLQ/exec",
  },
  {
    title: "보드게임 SET",
    description: "패턴과 조건을 빠르게 찾는 보드게임 SET 활동입니다.",
    href: "https://mathset.vercel.app/",
  },
  {
    title: "거북목게임",
    description: "수학여행 중 쉬는 시간에 자세를 풀어보는 스트레칭 게임입니다.",
    href: "https://stretching-zeta.vercel.app/",
  },
  {
    title: "나만의 노래방",
    description: "레크리에이션 시간에 친구들과 함께 즐길 수 있는 노래방 게임입니다.",
    href: "https://mics-on-karaoke.t98advisor1.chatgpt.site/",
  },
  {
    title: "마블룰렛",
    description: "룰렛으로 발표 순서, 미션, 벌칙, 보너스를 재미있게 정합니다.",
    href: "https://lazygyu.github.io/roulette/",
  },
  {
    title: "사다리타기",
    description: "모둠 역할과 발표 순서를 재미있게 정하는 내부 제비뽑기입니다.",
    href: "#ladder-game",
  },
  {
    title: "랜덤 뽑기",
    description: "학생 이름이나 활동 주제를 넣고 바로 하나를 뽑을 수 있습니다.",
    href: "#random-draw",
  },
];

const initialLadderNames = "1모둠\n2모둠\n3모둠\n4모둠";
const initialLadderResults = "발표 1번\n발표 2번\n사진 정리\n간식 배부";
const activeTeamStorageKey = "sincheon-trip-active-team-v1";
const passportStorageKey = "sincheon-trip-passport-v1";
const scheduleStorageKey = "sincheon-trip-schedule-checks-v1";
const customScheduleStorageKey = "sincheon-trip-custom-schedule-v1";
const scheduleEditStorageKey = "sincheon-trip-schedule-edits-v1";
const missionLogStorageKey = "sincheon-trip-mission-logs-v1";
const profileStorageKey = "sincheon-trip-student-profile-v1";
const reflectionStorageKey = "sincheon-trip-reflection-v1";
const memoryStorageKey = "sincheon-trip-event-memories-v1";
const escapeRankingStorageKey = "sincheon-trip-escape-rankings-v1";
const videoLearningStorageKey = "sincheon-trip-video-learning-v1";
const visitorCountStorageKey = "sincheon-trip-visitor-counts-v1";
const visitorSessionStorageKey = "sincheon-trip-visited-date";
const leafletVersion = "1.9.4";

function loadLeaflet() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.L) return Promise.resolve();
  if (window.__tripLeafletLoading) return window.__tripLeafletLoading;

  window.__tripLeafletLoading = new Promise<void>((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const css = document.createElement("link");
      css.id = "leaflet-css";
      css.rel = "stylesheet";
      css.href = `https://unpkg.com/leaflet@${leafletVersion}/dist/leaflet.css`;
      document.head.appendChild(css);
    }

    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet load failed")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = `https://unpkg.com/leaflet@${leafletVersion}/dist/leaflet.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet load failed"));
    document.body.appendChild(script);
  });

  return window.__tripLeafletLoading;
}

function readStoredList(key: string) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

function readStoredJson<T>(key: string, fallback: T) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getVisitDateKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function readLocalVisitorCounts(todayKey: string, shouldIncrement: boolean): VisitorCounts {
  const saved = readStoredJson<{ todayKey?: string; today?: number; total?: number }>(
    visitorCountStorageKey,
    {},
  );
  const isSameDay = saved.todayKey === todayKey;
  const next = {
    todayKey,
    today: (isSameDay ? saved.today ?? 0 : 0) + (shouldIncrement ? 1 : 0),
    total: (saved.total ?? 0) + (shouldIncrement ? 1 : 0),
  };
  window.localStorage.setItem(visitorCountStorageKey, JSON.stringify(next));
  return { today: next.today, total: next.total, source: "local" };
}

function linesToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function shuffleList<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function generateLadderBars(railCount: number): LadderBar[] {
  if (railCount < 2) return [];

  const rowCount = Math.max(5, Math.min(12, railCount * 3));
  const railGap = 100 / railCount;
  const bars: LadderBar[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const usedRails = new Set<number>();
    const attempts = Math.max(1, Math.floor(railCount / 2));

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const railIndex = Math.floor(Math.random() * (railCount - 1));
      if (usedRails.has(railIndex) || usedRails.has(railIndex - 1) || usedRails.has(railIndex + 1)) {
        continue;
      }

      usedRails.add(railIndex);
      const top = 12 + (row / rowCount) * 76 + Math.random() * 4;
      bars.push({
        id: `${row}-${railIndex}-${Math.round(top * 10)}`,
        railIndex,
        left: `${(railIndex + 1) * railGap}%`,
        top: `${top}%`,
        width: `${railGap}%`,
      });
    }
  }

  return bars;
}

function makePhotoTags(caption: string, place: string) {
  const words = caption
    .split(/[\s,#，,]+/)
    .map((item) => item.trim().replace(/^#/, ""))
    .filter((item) => item.length > 0)
    .slice(0, 6);
  const base = words.length ? words : [place, "부산수학여행", "인생샷"];
  return Array.from(new Set(base.map((item) => `#${item.replace(/\s/g, "")}`))).slice(0, 6);
}

const photoStickers = ["BUSAN", "FRIENDS", "MISSION", "WOW", "PEACE"];
const photoIcons = ["★", "♡", "✓", "✦", "♪"];
const photoFormats: { value: PhotoFormat; label: string }[] = [
  { value: "mini", label: "미니 세로" },
  { value: "square", label: "스퀘어" },
  { value: "wide", label: "와이드 가로" },
];
const photoFrameOptions: { value: PhotoFrame; label: string }[] = [
  { value: "classic", label: "클래식 화이트" },
  { value: "paper", label: "찍어진 종이" },
  { value: "rounded", label: "둥근 테두리" },
  { value: "mint", label: "부산 민트" },
  { value: "coral", label: "코랄 포인트" },
  { value: "film", label: "필름 보더" },
  { value: "stamp", label: "스탬프 엣지" },
];
const photoToneOptions = [
  { value: "clean", label: "클린" },
  { value: "warm", label: "웜" },
  { value: "blue", label: "블루" },
  { value: "mono", label: "흑백" },
  { value: "noir", label: "진한 흑백" },
  { value: "film", label: "필름" },
  { value: "vintage", label: "빈티지" },
  { value: "sunset", label: "노을" },
  { value: "cinema", label: "시네마" },
];
const photoTones = photoToneOptions.map((tone) => tone.value);
const maxMemoryPhotos = 5;
const maxSubmitPhotos = 6;

const guideCards = [
  {
    tag: "지도",
    title: "나의 팀과 오늘 이동 경로를 확인하세요",
    body: "먼저 A·B·C팀 중 자신의 팀을 선택한 뒤 일차 탭을 누르면 팀별 장소와 체크 상태가 지도에 표시됩니다.",
    screen: "map",
    steps: ["상단에서 반에 맞는 A팀, B팀, C팀을 먼저 선택합니다.", "1일차, 2일차, 3일차 탭에서 날짜를 선택합니다.", "지도 크게 보기로 팀별 전체 경로를 넓게 확인합니다.", "장소 목록을 누르면 해당 장소가 지도에서 강조됩니다."],
  },
  {
    tag: "일정",
    title: "도착한 일정은 바로 체크하세요",
    body: "체크리스트와 장소 메모는 이 기기의 브라우저에 저장되어 새로고침 후에도 이어서 볼 수 있습니다.",
    screen: "check",
    steps: ["도착하거나 활동을 마친 일정에 체크합니다.", "각 일정 아래 메모에 오늘의 관찰과 느낌을 남깁니다.", "체크한 일정은 지도와 제출 기록에 함께 반영됩니다."],
  },
  {
    tag: "안전",
    title: "출발 전 안전교육을 꼭 확인하세요",
    body: "안전한 수학여행을 위해 이동, 숙소, 체험 활동별 주의사항을 먼저 살펴보고 위험 상황은 즉시 선생님께 알려야 합니다.",
    screen: "safety",
    steps: [
      "첫 화면의 안전교육 바로가기 또는 메뉴의 안전 탭을 눌러 자료를 확인합니다.",
      "도보 이동, 버스 이동, 숙소 생활, 체험 활동별 약속을 활동 전에 다시 읽습니다.",
      "급하게 학교 연락처가 필요하면 화면 하단 왼쪽의 저작권 링크를 눌러 신천고등학교 홈페이지에서 연락처를 확인합니다.",
      "개인 판단이 어려운 상황에서는 혼자 해결하려 하지 말고 바로 인솔 선생님께 알립니다.",
    ],
  },
  {
    tag: "스탬프",
    title: "3일간의 스토리 방탈출에 도전하세요",
    body: "부산 시간기록국의 세 챕터에서 문제와 최종 암호를 풀어 여행 여권을 복구합니다. 학습을 먼저 끝낸 뒤 도전하세요.",
    screen: "mission",
    steps: [
      "1·2·3일차 챕터 중 현재 일정에 맞는 이야기를 선택합니다.",
      "학번과 이름을 한 번 입력하고 시작 버튼을 누르면 타이머가 작동합니다.",
      "150문항 중 전체 10문항이 무작위로 출제되며, 각 챕터의 문제 묶음을 통과해 단서 조각을 모읍니다.",
      "영상 자료를 열고 60초 이상 학습한 뒤 완료하면 챕터별 100점이 추가됩니다.",
      "기본 1,000점에 영상 학습·시간·무힌트·정확도·관찰 보너스와 작은 복불복 점수가 더해집니다.",
      "힌트는 한 번에 100점, 오답은 한 번에 60점이 줄어드니 학습 자료와 일정표를 먼저 확인하세요.",
      "어려운 문항은 ‘모르겠어요·정답 보기’를 눌러 해설을 확인하고 다음 문제로 갈 수 있으며 오답 1회로 처리됩니다.",
    ],
  },
  {
    tag: "현장 코드",
    title: "현장 스탬프 코드는 선생님이 안내합니다",
    body: "앱에는 장소별 정답 코드가 미리 들어 있습니다. 학생은 현장에서 담임 또는 인솔 선생님이 알려 주는 확인 코드를 입력해 방문을 인증합니다.",
    screen: "stampCode",
    steps: [
      "장소에 도착하면 안내판, 담임 선생님, 인솔 선생님의 안내를 먼저 확인합니다.",
      "장소 미션의 현장 스탬프 코드 칸에 안내받은 코드를 입력하고 찍기를 누릅니다.",
      "코드가 맞으면 해당 장소 스탬프와 일정 체크가 자동으로 기록됩니다.",
      "코드를 모를 때는 친구에게 임의로 묻기보다 담임 또는 인솔 선생님께 확인합니다.",
    ],
  },
  {
    tag: "랭킹",
    title: "방탈출 랭킹과 수행 기록은 따로 관리됩니다",
    body: "방탈출은 최종 암호를 풀 때 새 점수를 실시간 랭킹으로 전송하고, 기록 제출 화면에서는 스탬프 점수와 방탈출 합산 점수를 수행 기록으로 각각 제출합니다.",
    screen: "rank",
    steps: [
      "학번과 이름을 먼저 입력합니다. 기록 제출에는 학교메일도 함께 입력합니다.",
      "방탈출 챕터를 완료하면 그 챕터의 최신 점수가 실시간 랭킹으로 전송됩니다.",
      "기록 제출 화면에서 스탬프 점수 전송과 방탈출 합산 점수 전송을 각각 누릅니다.",
      "방탈출 랭킹 TOP10은 세 챕터의 최신 점수를 학생별로 합산해 첫 화면과 게임 허브에 표시합니다.",
      "개인 상위 랭킹과 학번 기준 학급 합산 우수팀에는 레크레이션 가산점과 상품이 제공됩니다.",
    ],
  },
  {
    tag: "사진",
    title: "추억 사진과 제출 사진을 구분하세요",
    body: "사진첩은 나만의 폴라로이드 저장용이고, 기록 제출의 사진자료는 선생님 Google Drive 제출용입니다.",
    screen: "photo",
    steps: [
      "사진첩에서는 미니, 스퀘어, 와이드 규격을 고릅니다.",
      "미리보기 후 폴라로이드 이미지를 다운로드합니다.",
      "제출 사진은 초상권 동의 확인 후 기록 제출에서 따로 보냅니다.",
      "사진 촬영 중 이동 동선이나 안전 수칙을 놓치지 않도록 주변을 먼저 확인합니다.",
    ],
  },
];

function fileToInstantPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("photo_read_failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("photo_decode_failed"));
      image.onload = () => {
        const targetWidth = 900;
        const targetHeight = 675;
        const targetRatio = targetWidth / targetHeight;
        const imageRatio = image.width / image.height;
        const sourceWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
        const sourceHeight = imageRatio > targetRatio ? image.height : image.width / targetRatio;
        const sourceX = Math.max(0, (image.width - sourceWidth) / 2);
        const sourceY = Math.max(0, (image.height - sourceHeight) / 2);
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas_unavailable"));
          return;
        }
        context.imageSmoothingQuality = "high";
        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          targetWidth,
          targetHeight,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function fileToSubmittedPhoto(file: File) {
  return new Promise<SubmittedPhoto>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("photo_read_failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("photo_decode_failed"));
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas_unavailable"));
          return;
        }
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, targetWidth, targetHeight);
        resolve({
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          type: "image/jpeg",
          size: file.size,
          dataUrl: canvas.toDataURL("image/jpeg", 0.82),
        });
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImageSource(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_load_failed"));
    image.src = src;
  });
}

function roundRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const source = text.trim();
  if (!source) return y;

  const lines: string[] = [];
  let line = "";

  Array.from(source).forEach((char) => {
    const next = line + char;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = char.trimStart();
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((item, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? "..." : "";
    context.fillText(`${item}${suffix}`, x, y + index * lineHeight);
  });

  return y + Math.min(lines.length, maxLines) * lineHeight;
}

function photoToneFilter(tone: string) {
  if (tone === "warm") return "sepia(0.22) saturate(1.08) brightness(1.04)";
  if (tone === "blue") return "saturate(1.08) hue-rotate(8deg) brightness(1.02)";
  if (tone === "mono") return "grayscale(1) contrast(1.05)";
  if (tone === "noir") return "grayscale(1) contrast(1.35) brightness(0.92)";
  if (tone === "film") return "sepia(0.16) contrast(1.12) saturate(1.18) brightness(1.02)";
  if (tone === "vintage") return "sepia(0.34) saturate(0.88) contrast(1.08) brightness(1.06)";
  if (tone === "sunset") return "sepia(0.18) saturate(1.42) hue-rotate(-10deg) brightness(1.05)";
  if (tone === "cinema") return "contrast(1.16) saturate(1.12) brightness(0.94) hue-rotate(172deg)";
  return "saturate(1.04) contrast(1.02)";
}

function photoFrameStyle(frame: PhotoFrame) {
  if (frame === "paper") {
    return {
      start: "#fffaf0",
      middle: "#f7ead5",
      end: "#efe0c8",
      accent: "#9b6a38",
      muted: "#7a6753",
      outerRadius: 28,
      photoRadius: 12,
    };
  }
  if (frame === "rounded") {
    return {
      start: "#ffffff",
      middle: "#f7fbfb",
      end: "#edf4f6",
      accent: "#145c9e",
      muted: "#647786",
      outerRadius: 72,
      photoRadius: 46,
    };
  }
  if (frame === "mint") {
    return {
      start: "#f7fff9",
      middle: "#def8ee",
      end: "#c9eee9",
      accent: "#0f8b8d",
      muted: "#4d7072",
      outerRadius: 36,
      photoRadius: 22,
    };
  }
  if (frame === "coral") {
    return {
      start: "#fff8f3",
      middle: "#ffe4d9",
      end: "#ffd2c2",
      accent: "#f26b5b",
      muted: "#7b5b51",
      outerRadius: 36,
      photoRadius: 22,
    };
  }
  if (frame === "film") {
    return {
      start: "#f9f9f4",
      middle: "#efefe8",
      end: "#deded6",
      accent: "#17202a",
      muted: "#5f6469",
      outerRadius: 24,
      photoRadius: 8,
    };
  }
  if (frame === "stamp") {
    return {
      start: "#fffdf6",
      middle: "#fbf1de",
      end: "#f4dfba",
      accent: "#c35f45",
      muted: "#786552",
      outerRadius: 20,
      photoRadius: 18,
    };
  }
  return {
    start: "#fffdf6",
    middle: "#fbf4e7",
    end: "#f3eadb",
    accent: "#c35f45",
    muted: "#7d7061",
    outerRadius: 36,
    photoRadius: 18,
  };
}

function drawPhotoTagsOnCanvas(
  context: CanvasRenderingContext2D,
  tags: string[],
  x: number,
  y: number,
  maxWidth: number,
  accent: string,
) {
  let currentX = x;
  let currentY = y;
  const lineHeight = 48;

  context.font = "900 24px Pretendard, 'Noto Sans KR', sans-serif";
  tags.slice(0, 5).forEach((tag) => {
    const width = Math.min(context.measureText(tag).width + 34, maxWidth);
    if (currentX + width > x + maxWidth) {
      currentX = x;
      currentY += lineHeight;
    }
    context.fillStyle = "rgba(255, 255, 255, 0.72)";
    roundRectPath(context, currentX, currentY - 28, width, 36, 18);
    context.fill();
    context.strokeStyle = `${accent}44`;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = accent;
    context.fillText(tag, currentX + 17, currentY - 3);
    currentX += width + 12;
  });

  return currentY + lineHeight;
}

function safeDownloadName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function downloadInstantPhotoCard({
  photo,
  title,
  place,
  date,
  note,
  index,
}: {
  photo: TripPhoto;
  title: string;
  place: string;
  date: string;
  note: string;
  index: number;
}) {
  const image = await loadImageSource(photo.src);
  const format = photo.format ?? "mini";
  const frame = photo.frame ?? "classic";
  const frameStyle = photoFrameStyle(frame);
  const showTags = photo.showTags !== false;
  const showCredit = photo.showCredit !== false;
  const preset =
    format === "wide"
      ? { width: 1600, height: 1000, margin: 80, photoWidth: 1440, photoHeight: 720 }
      : format === "square"
        ? { width: 1400, height: 1400, margin: 90, photoWidth: 1220, photoHeight: 980 }
        : { width: 1200, height: 1600, margin: 84, photoWidth: 1032, photoHeight: 774 };
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");

  const background = context.createLinearGradient(0, 0, preset.width, preset.height);
  background.addColorStop(0, frameStyle.start);
  background.addColorStop(0.55, frameStyle.middle);
  background.addColorStop(1, frameStyle.end);
  context.fillStyle = background;
  roundRectPath(context, 0, 0, preset.width, preset.height, frameStyle.outerRadius);
  context.fill();

  context.fillStyle = "rgba(45, 38, 28, 0.035)";
  for (let y = 32; y < preset.height; y += 34) {
    context.fillRect(0, y, preset.width, 1);
  }

  if (frame === "paper") {
    context.fillStyle = "rgba(117, 88, 52, 0.045)";
    for (let dot = 0; dot < 260; dot += 1) {
      context.fillRect(Math.random() * preset.width, Math.random() * preset.height, 2, 2);
    }
  }

  if (frame === "stamp") {
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    for (let x = 24; x < preset.width; x += 52) {
      context.beginPath();
      context.arc(x, 2, 13, 0, Math.PI * 2);
      context.arc(x, preset.height - 2, 13, 0, Math.PI * 2);
      context.fill();
    }
    for (let y = 24; y < preset.height; y += 52) {
      context.beginPath();
      context.arc(2, y, 13, 0, Math.PI * 2);
      context.arc(preset.width - 2, y, 13, 0, Math.PI * 2);
      context.fill();
    }
  }

  const photoX = preset.margin;
  const photoY = preset.margin + (format === "mini" ? 32 : 0);
  const photoW = preset.photoWidth;
  const photoH = preset.photoHeight;
  const imageRatio = image.width / image.height;
  const targetRatio = photoW / photoH;
  const sourceWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
  const sourceHeight = imageRatio > targetRatio ? image.height : image.width / targetRatio;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;

  if (frame === "film") {
    context.fillStyle = "#17202a";
    roundRectPath(context, photoX - 26, photoY - 26, photoW + 52, photoH + 52, 16);
    context.fill();
    context.fillStyle = "rgba(255, 255, 255, 0.78)";
    for (let y = photoY; y < photoY + photoH; y += 72) {
      roundRectPath(context, photoX - 17, y, 12, 30, 4);
      context.fill();
      roundRectPath(context, photoX + photoW + 5, y, 12, 30, 4);
      context.fill();
    }
  }

  context.save();
  roundRectPath(context, photoX, photoY, photoW, photoH, frameStyle.photoRadius);
  context.clip();
  context.filter = photoToneFilter(photo.tone);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, photoX, photoY, photoW, photoH);
  context.restore();
  context.filter = "none";

  context.strokeStyle = frame === "film" ? "rgba(255, 255, 255, 0.82)" : "rgba(57, 44, 28, 0.18)";
  context.lineWidth = frame === "film" ? 5 : 3;
  roundRectPath(context, photoX, photoY, photoW, photoH, frameStyle.photoRadius);
  context.stroke();

  context.fillStyle = "rgba(255, 255, 255, 0.88)";
  roundRectPath(context, photoX + 28, photoY + 28, 250, 72, 36);
  context.fill();
  context.fillStyle = "#173140";
  context.font = "900 30px Pretendard, 'Noto Sans KR', sans-serif";
  context.fillText(`${photo.icon || "★"} ${photo.sticker || "BUSAN"}`, photoX + 56, photoY + 75);

  context.fillStyle = "#173140";
  context.font = "900 58px Pretendard, 'Noto Sans KR', sans-serif";
  const copyTop = photoY + photoH + (format === "wide" ? 66 : 92);
  context.fillText(place, preset.margin, copyTop);

  context.fillStyle = frameStyle.muted;
  context.font = "700 34px Pretendard, 'Noto Sans KR', sans-serif";
  context.fillText(`${date} · ${title}`, preset.margin, copyTop + 62);

  const caption = photo.caption.trim() || note.trim() || "부산에서 건진 오늘의 한 장";
  context.fillStyle = "#273747";
  context.font = "850 58px Pretendard, 'Noto Sans KR', sans-serif";
  const captionBottom = drawWrappedText(
    context,
    caption,
    preset.margin,
    copyTop + 156,
    preset.width - preset.margin * 2,
    76,
    format === "wide" ? 2 : 3,
  );

  if (showTags) {
    drawPhotoTagsOnCanvas(
      context,
      makePhotoTags(photo.caption, place),
      preset.margin,
      Math.min(captionBottom + 34, preset.height - 320),
      preset.width - preset.margin * 2,
      frameStyle.accent,
    );
  }

  context.fillStyle = "rgba(242, 107, 91, 0.12)";
  roundRectPath(context, preset.margin, preset.height - 218, 196, 64, 32);
  context.fill();
  context.fillStyle = frameStyle.accent;
  context.font = "900 34px Inter, Pretendard, sans-serif";
  context.fillText(photo.icon || "★", preset.margin + 46, preset.height - 175);

  if (showCredit) {
    context.fillStyle = frameStyle.accent;
    context.font = "900 28px Inter, Pretendard, sans-serif";
    context.fillText("SCH BUSAN STAMP TOUR", preset.margin, preset.height - 82);
  }

  context.fillStyle = "rgba(23, 49, 64, 0.42)";
  context.font = "700 20px Inter, Pretendard, sans-serif";
  context.fillText(`#${String(index + 1).padStart(2, "0")}`, preset.width - preset.margin - 70, preset.height - 82);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("download_failed"));
    }, "image/png");
  });

  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `${safeDownloadName(`${place}-${title}`)}-instax-${index + 1}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function isMaskedRankEntry(entry: EscapeRankEntry) {
  return `${entry.studentNo ?? ""}${entry.name ?? ""}`.includes("*");
}

function getRankOwnerKey(entry: EscapeRankEntry) {
  return entry.ownerKey || entry.studentNo || entry.name || "익명";
}

function mergeEscapeRankings(items: EscapeRankEntry[]) {
  // The shared ranking masks other students' 학번·이름. When the same record
  // exists on this device unmasked, keep the local copy and learn its ownerKey.
  const byId = new Map<string, EscapeRankEntry>();
  const withoutId: EscapeRankEntry[] = [];
  items.forEach((entry) => {
    if (!entry?.missionId || typeof entry.score !== "number") return;
    if (!entry.id) {
      withoutId.push(entry);
      return;
    }
    const current = byId.get(entry.id);
    if (!current) {
      byId.set(entry.id, entry);
      return;
    }
    const keep = isMaskedRankEntry(entry) && !isMaskedRankEntry(current) ? current : entry;
    const other = keep === entry ? current : entry;
    byId.set(entry.id, { ...keep, ownerKey: keep.ownerKey || other.ownerKey });
  });

  const latestByStudentAndMission = new Map<string, EscapeRankEntry>();
  [...byId.values(), ...withoutId].forEach((entry) => {
    const key = `${entry.missionId}:${getRankOwnerKey(entry)}`;
    const current = latestByStudentAndMission.get(key);
    const entryTime = new Date(entry.createdAt).getTime();
    const currentTime = current ? new Date(current.createdAt).getTime() : 0;
    if (!current || entryTime >= currentTime) {
      latestByStudentAndMission.set(key, entry);
    }
  });

  return [...latestByStudentAndMission.values()]
    .sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds)
    .slice(0, 1000);
}

function aggregateEscapeRankings(items: EscapeRankEntry[]) {
  const totals = new Map<string, EscapeRankEntry & { chapters: number }>();

  items
    .filter((entry) => entry.missionId.startsWith("story-day-"))
    .forEach((entry) => {
      const ownerKey = getRankOwnerKey(entry);
      const current = totals.get(ownerKey);
      if (!current) {
        totals.set(ownerKey, {
          ...entry,
          id: `total-${ownerKey}`,
          missionId: "story-total",
          missionTitle: "부산 시간기록국 합산",
          place: "1·2·3일차 합산",
          chapters: 1,
        });
        return;
      }
      totals.set(ownerKey, {
        ...current,
        score: current.score + entry.score,
        elapsedSeconds: current.elapsedSeconds + entry.elapsedSeconds,
        createdAt:
          new Date(entry.createdAt).getTime() > new Date(current.createdAt).getTime()
            ? entry.createdAt
            : current.createdAt,
        chapters: current.chapters + 1,
      });
    });

  return [...totals.values()]
    .sort((a, b) => b.score - a.score || a.elapsedSeconds - b.elapsedSeconds)
    .slice(0, 10)
    .map((entry) => ({
      ...entry,
      place: `${entry.chapters}개 챕터 합산`,
    }));
}

export default function TripApp() {
  const [activePage, setActivePage] = useState<AppPageId>("home");
  const [activeTeam, setActiveTeam] = useState<TripTeam>("A");
  const [storageReady, setStorageReady] = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [checkedEvents, setCheckedEvents] = useState<string[]>([]);
  const [customScheduleEvents, setCustomScheduleEvents] = useState<Record<string, TripEvent[]>>({});
  const [scheduleEdits, setScheduleEdits] = useState<Record<string, ScheduleEdit>>({});
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [manualScheduleDraft, setManualScheduleDraft] = useState({
    time: "",
    title: "",
    place: "",
    detail: "",
  });
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [activeMission, setActiveMission] = useState<Mission>(missions[0]);
  const [answerState, setAnswerState] = useState<"idle" | "correct" | "wrong">("idle");
  const [stampCode, setStampCode] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile>({
    studentNo: "",
    name: "",
    email: "",
  });
  const [missionLogs, setMissionLogs] = useState<MissionLog[]>([]);
  const [reflection, setReflection] = useState("");
  const [eventMemories, setEventMemories] = useState<Record<string, TripMemory>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [scoreSubmitStatus, setScoreSubmitStatus] = useState<SubmitStatus>("idle");
  const [scoreSubmitMessage, setScoreSubmitMessage] = useState("");
  const [memoryMessage, setMemoryMessage] = useState("");
  const [submittedPhotos, setSubmittedPhotos] = useState<SubmittedPhoto[]>([]);
  const [portraitConsent, setPortraitConsent] = useState(false);
  const [ladderNames, setLadderNames] = useState(initialLadderNames);
  const [ladderResults, setLadderResults] = useState(initialLadderResults);
  const [ladderPairs, setLadderPairs] = useState<LadderPair[]>([]);
  const [ladderBars, setLadderBars] = useState<LadderBar[]>([]);
  const [randomItems, setRandomItems] = useState("부산역\n국제시장\n요트 체험\n감천문화마을");
  const [randomPick, setRandomPick] = useState("");
  const [randomHistory, setRandomHistory] = useState<string[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [drawFx, setDrawFx] = useState(false);
  const [learningIndex, setLearningIndex] = useState(0);
  const [guideIndex, setGuideIndex] = useState(0);
  const [safetyIndex, setSafetyIndex] = useState(0);
  const [freeMemoryTitle, setFreeMemoryTitle] = useState("숙소의 기억");
  const [freeMemoryPlace, setFreeMemoryPlace] = useState("숙소/자유 시간");
  const [missionStudyDone, setMissionStudyDone] = useState(false);
  const [escapeChapterDay, setEscapeChapterDay] = useState(0);
  const [escapeStage, setEscapeStage] = useState<EscapeStage>("briefing");
  const [escapeAttemptChallenges, setEscapeAttemptChallenges] = useState<EscapeChallenge[]>([]);
  const [lastEscapeQuestionIds, setLastEscapeQuestionIds] = useState<Record<string, string[]>>({});
  const [escapeChallengeIndex, setEscapeChallengeIndex] = useState(0);
  const [escapeSolvedIds, setEscapeSolvedIds] = useState<string[]>([]);
  const [escapeInventory, setEscapeInventory] = useState<EscapeInventoryItem[]>([]);
  const [escapeHintIds, setEscapeHintIds] = useState<string[]>([]);
  const [escapeWrongCount, setEscapeWrongCount] = useState(0);
  const [escapeFinalCode, setEscapeFinalCode] = useState("");
  const [escapeShortAnswer, setEscapeShortAnswer] = useState("");
  const [escapeFeedback, setEscapeFeedback] = useState("");
  const [earnedItemFx, setEarnedItemFx] = useState<EscapeInventoryItem | null>(null);
  const [escapeSoundOn, setEscapeSoundOn] = useState(true);
  const [missionStartedAt, setMissionStartedAt] = useState<number | null>(null);
  const [escapeNow, setEscapeNow] = useState(Date.now());
  const [escapeElapsedSeconds, setEscapeElapsedSeconds] = useState(0);
  const [lastEarnedScore, setLastEarnedScore] = useState<number | null>(null);
  const [lastScoreBreakdown, setLastScoreBreakdown] = useState("");
  const [escapeRankings, setEscapeRankings] = useState<EscapeRankEntry[]>([]);
  const [videoLearningProgress, setVideoLearningProgress] = useState<VideoLearningProgress>({});
  const [videoLearningMessage, setVideoLearningMessage] = useState("");
  const [rankingStatus, setRankingStatus] = useState<RankingStatus>("idle");
  const [rankingMessage, setRankingMessage] = useState("");
  const [lastRankingSync, setLastRankingSync] = useState("");
  const [rankingTickerIndex, setRankingTickerIndex] = useState(0);
  const [visitorCounts, setVisitorCounts] = useState<VisitorCounts>({
    today: 0,
    total: 0,
    source: "loading",
  });
  const [modalMapVersion, setModalMapVersion] = useState(0);
  const [previewPhoto, setPreviewPhoto] = useState<{ photo: TripPhoto; index: number } | null>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mapLayerRef = useRef<any>(null);
  const mapRouteKeyRef = useRef("");
  const mapFocusedEventRef = useRef<string | null>(null);
  const modalMapNodeRef = useRef<HTMLDivElement | null>(null);
  const modalMapRef = useRef<any>(null);
  const modalMapLayerRef = useRef<any>(null);
  const modalMapRouteKeyRef = useRef("");
  const modalMapFocusedEventRef = useRef<string | null>(null);
  const overlayModalRef = useRef<HTMLDivElement | null>(null);
  const tripDays = tripSchedules[activeTeam];
  const activeTeamInfo = tripTeamMeta[activeTeam];
  const escapeChapters = useMemo(() => createEscapeChapters(activeTeam), [activeTeam]);
  const activeEscapeChapter = escapeChapters[escapeChapterDay] ?? escapeChapters[0];
  const currentEscapeChallenge =
    escapeAttemptChallenges[escapeChallengeIndex] ?? activeEscapeChapter.challenges[0];
  const currentEscapeMission = missions.find(
    (entry) => entry.id === currentEscapeChallenge.missionId,
  );
  const activeVideoLearning = videoLearningProgress[activeEscapeChapter.id];

  async function refreshSharedEscapeRankings(options?: { quiet?: boolean }) {
    if (!options?.quiet) {
      setRankingStatus("syncing");
      setRankingMessage("방탈출 랭킹을 불러오는 중입니다.");
    }

    try {
      const response = await fetch("/api/trip-ranking", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        code?: string;
        rankings?: EscapeRankEntry[];
      };
      if (data.ok && Array.isArray(data.rankings)) {
        setEscapeRankings((prev) => mergeEscapeRankings([...prev, ...data.rankings!]));
        setRankingStatus("live");
        setLastRankingSync(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setRankingMessage("실시간 랭킹이 갱신되었습니다.");
        return;
      }

      setRankingStatus("offline");
      setRankingMessage(
        data.code === "missing_config"
          ? "랭킹 백엔드 환경변수 TRIP_GOOGLE_SCRIPT_URL 설정이 필요합니다."
          : "공용 랭킹을 불러오지 못했습니다. 이 기기의 기록은 계속 표시됩니다.",
      );
    } catch {
      setRankingStatus("offline");
      setRankingMessage("네트워크 문제로 공용 랭킹을 불러오지 못했습니다. 잠시 후 자동으로 다시 시도합니다.");
    }
  }

  useEffect(() => {
    const syncPageFromAddress = () => setActivePage(getAppPageFromHash(window.location.hash));
    syncPageFromAddress();
    window.addEventListener("hashchange", syncPageFromAddress);
    window.addEventListener("popstate", syncPageFromAddress);
    return () => {
      window.removeEventListener("hashchange", syncPageFromAddress);
      window.removeEventListener("popstate", syncPageFromAddress);
    };
  }, []);

  useEffect(() => {
    const activeTab = document.querySelector<HTMLElement>(`[data-page-tab="${activePage}"]`);
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activePage]);

  useEffect(() => {
    const savedTeam = window.localStorage.getItem(activeTeamStorageKey);
    if (savedTeam === "A" || savedTeam === "B" || savedTeam === "C") {
      setActiveTeam(savedTeam);
    }
    setCompleted(readStoredList(passportStorageKey));
    setCheckedEvents(readStoredList(scheduleStorageKey));
    setCustomScheduleEvents(readStoredJson<Record<string, TripEvent[]>>(customScheduleStorageKey, {}));
    setScheduleEdits(readStoredJson<Record<string, ScheduleEdit>>(scheduleEditStorageKey, {}));
    setMissionLogs(readStoredJson<MissionLog[]>(missionLogStorageKey, []));
    setStudentProfile(
      readStoredJson<StudentProfile>(profileStorageKey, {
        studentNo: "",
        name: "",
        email: "",
      }),
    );
    setReflection(window.localStorage.getItem(reflectionStorageKey) ?? "");
    setEventMemories(readStoredJson<Record<string, TripMemory>>(memoryStorageKey, {}));
    setEscapeRankings(readStoredJson<EscapeRankEntry[]>(escapeRankingStorageKey, []));
    setVideoLearningProgress(
      readStoredJson<VideoLearningProgress>(videoLearningStorageKey, {}),
    );
    setLadderBars(generateLadderBars(linesToList(initialLadderNames).length));
    setStorageReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const todayKey = getVisitDateKey();
    const sessionKey = `${visitorSessionStorageKey}:${todayKey}`;
    const shouldIncrement = window.sessionStorage.getItem(sessionKey) !== "1";

    async function syncVisitorCounts() {
      try {
        const response = await fetch("/api/trip-visit", {
          method: shouldIncrement ? "POST" : "GET",
          headers: shouldIncrement ? { "content-type": "application/json; charset=utf-8" } : undefined,
          body: shouldIncrement
            ? JSON.stringify({
                dateKey: todayKey,
                path: window.location.pathname,
                userAgent: window.navigator.userAgent,
              })
            : undefined,
          cache: "no-store",
        });
        const data = (await response.json()) as {
          ok?: boolean;
          counts?: { today?: number; total?: number } | null;
        };
        if (
          data.ok &&
          typeof data.counts?.today === "number" &&
          typeof data.counts.total === "number"
        ) {
          if (shouldIncrement) window.sessionStorage.setItem(sessionKey, "1");
          if (!cancelled) {
            setVisitorCounts({
              today: data.counts.today,
              total: data.counts.total,
              source: "shared",
            });
          }
          return;
        }
      } catch {
        // Fall back to local-only counts below.
      }

      const localCounts = readLocalVisitorCounts(todayKey, shouldIncrement);
      if (shouldIncrement) window.sessionStorage.setItem(sessionKey, "1");
      if (!cancelled) setVisitorCounts(localCounts);
    }

    void syncVisitorCounts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(activeTeamStorageKey, activeTeam);
  }, [activeTeam, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(passportStorageKey, JSON.stringify(completed));
  }, [completed, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(scheduleStorageKey, JSON.stringify(checkedEvents));
  }, [checkedEvents, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(customScheduleStorageKey, JSON.stringify(customScheduleEvents));
  }, [customScheduleEvents, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(scheduleEditStorageKey, JSON.stringify(scheduleEdits));
  }, [scheduleEdits, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(missionLogStorageKey, JSON.stringify(missionLogs));
  }, [missionLogs, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(profileStorageKey, JSON.stringify(studentProfile));
  }, [storageReady, studentProfile]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(reflectionStorageKey, reflection);
  }, [reflection, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(memoryStorageKey, JSON.stringify(eventMemories));
  }, [eventMemories, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(escapeRankingStorageKey, JSON.stringify(escapeRankings));
  }, [escapeRankings, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(videoLearningStorageKey, JSON.stringify(videoLearningProgress));
  }, [storageReady, videoLearningProgress]);

  useEffect(() => {
    const gameTimerActive = missionStudyDone && Boolean(missionStartedAt) && escapeStage !== "result";
    const videoTimerActive = Boolean(activeVideoLearning?.startedAt && !activeVideoLearning.completedAt);
    if (!gameTimerActive && !videoTimerActive) return;
    const timer = window.setInterval(() => setEscapeNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeVideoLearning?.completedAt, activeVideoLearning?.startedAt, escapeStage, missionStartedAt, missionStudyDone]);

  useEffect(() => {
    let cancelled = false;

    async function loadSharedEscapeRankings() {
      if (!cancelled) void refreshSharedEscapeRankings({ quiet: true });
    }

    void loadSharedEscapeRankings();
    const timer = window.setInterval(loadSharedEscapeRankings, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setRankingTickerIndex(0);
  }, [escapeRankings.length]);

  useEffect(() => {
    const rankingCount = Math.min(escapeRankings.length, 10);
    if (rankingCount <= 1) return;
    const timer = window.setInterval(() => {
      setRankingTickerIndex((prev) => (prev + 1) % rankingCount);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [escapeRankings.length]);

  function getScheduleEventsForDay(day: TripDay) {
    const teamDayKey = `${activeTeam}-${day.id}`;
    return [
      ...day.events.map((event) => ({
        ...event,
        ...(scheduleEdits[event.id] ?? {}),
      })),
      ...(customScheduleEvents[teamDayKey] ?? []),
    ];
  }

  const getMissionForEvent = useCallback((event: TripEvent) => {
    const missionEventId = event.missionEventId ?? event.id;
    return missions.find((mission) => mission.eventId === missionEventId);
  }, []);

  function getScheduleEventForMission(mission: Mission) {
    return tripDays
      .flatMap((day) => getScheduleEventsForDay(day))
      .find((event) => (event.missionEventId ?? event.id) === mission.eventId);
  }

  function getScheduleDayForMission(mission: Mission) {
    return tripDays.find((day) =>
      getScheduleEventsForDay(day).some(
        (event) => (event.missionEventId ?? event.id) === mission.eventId,
      ),
    );
  }

  const currentDay = tripDays[activeDay] ?? tripDays[0];
  const currentScheduleEvents = useMemo(() => {
    const teamDayKey = `${activeTeam}-${currentDay.id}`;
    return [
      ...currentDay.events.map((event) => ({
        ...event,
        ...(scheduleEdits[event.id] ?? {}),
      })),
      ...(customScheduleEvents[teamDayKey] ?? []),
    ];
  }, [activeTeam, currentDay, customScheduleEvents, scheduleEdits]);
  const freeMemoryEvent: TripEvent = {
    id: `free-memory-${activeTeam}-${currentDay.id}`,
    time: "자유",
    title: freeMemoryTitle.trim() || "숙소의 기억",
    place: freeMemoryPlace.trim() || "숙소/자유 시간",
    detail: "일정표에 없는 숙소, 이동 중, 자유시간의 장면을 따로 남깁니다.",
    subject: "자유기록",
  };
  const albumEvents = [...currentScheduleEvents, freeMemoryEvent];
  const selectedEvent =
    albumEvents.find((event) => event.id === focusedEventId) ?? currentScheduleEvents[0];
  const selectedMemory = selectedEvent
    ? eventMemories[selectedEvent.id] ?? { note: "" }
    : { note: "" };
  const selectedPhotos: TripPhoto[] = selectedMemory.photos?.length
    ? selectedMemory.photos
    : selectedMemory.photo
      ? [
          {
            id: "legacy-photo",
            src: selectedMemory.photo,
            caption: "",
            sticker: "BUSAN",
            tone: "clean",
            icon: "★",
            format: "mini" as PhotoFormat,
            frame: "classic" as PhotoFrame,
            showTags: true,
            showCredit: true,
            createdAt: selectedMemory.updatedAt ?? new Date().toISOString(),
          },
        ]
      : [];
  const currentRouteEvents = useMemo(
    () =>
      currentScheduleEvents.filter(
        (event) => typeof event.lat === "number" && typeof event.lng === "number",
      ),
    [currentScheduleEvents],
  );
  const currentRouteKey = useMemo(
    () =>
      `${activeTeam}-${currentDay.id}:${currentRouteEvents
        .map((event) => `${event.id}:${event.lat}:${event.lng}`)
        .join("|")}`,
    [activeTeam, currentDay.id, currentRouteEvents],
  );
  const dayMissions = missions.filter(
    (mission) => (getScheduleDayForMission(mission)?.id ?? mission.day) === activeDay,
  );
  const score = useMemo(
    () =>
      missions
        .filter((mission) => completed.includes(mission.id))
        .reduce((sum, mission) => sum + mission.reward, 0),
    [completed],
  );
  const studentKey = studentProfile.studentNo.trim() || studentProfile.name.trim();
  const myRankOwnerKeys = useMemo(
    () =>
      new Set(
        escapeRankings
          .filter(
            (entry) =>
              Boolean(studentKey) &&
              !isMaskedRankEntry(entry) &&
              (entry.studentNo || entry.name) === studentKey &&
              Boolean(entry.ownerKey),
          )
          .map((entry) => entry.ownerKey as string),
      ),
    [escapeRankings, studentKey],
  );
  const myStoryRankings = useMemo(() => {
    if (!studentKey) return [];
    const latestByChapter = new Map<string, EscapeRankEntry>();
    escapeRankings
      .filter(
        (entry) =>
          entry.missionId.startsWith("story-day-") &&
          ((!isMaskedRankEntry(entry) && (entry.studentNo || entry.name) === studentKey) ||
            (Boolean(entry.ownerKey) && myRankOwnerKeys.has(entry.ownerKey as string))),
      )
      .forEach((entry) => {
        const current = latestByChapter.get(entry.missionId);
        if (!current || new Date(entry.createdAt).getTime() >= new Date(current.createdAt).getTime()) {
          latestByChapter.set(entry.missionId, entry);
        }
      });
    return [...latestByChapter.values()];
  }, [escapeRankings, studentKey, myRankOwnerKeys]);
  const myEscapeScore = useMemo(
    () => myStoryRankings.reduce((sum, entry) => sum + entry.score, 0),
    [myStoryRankings],
  );
  const totalScore = score + myEscapeScore;
  const topEscapeRankings = useMemo(
    () => aggregateEscapeRankings(escapeRankings),
    [escapeRankings],
  );
  const completedEscapeChapterIds = useMemo(
    () => new Set(myStoryRankings.map((entry) => entry.missionId)),
    [myStoryRankings],
  );
  const currentHeroRanking = topEscapeRankings.length
    ? topEscapeRankings[rankingTickerIndex % topEscapeRankings.length]
    : null;
  const currentHeroRankingRank = currentHeroRanking
    ? (rankingTickerIndex % topEscapeRankings.length) + 1
    : 0;
  const currentLearningSlide = learningCards[learningIndex % learningCards.length];
  const currentGuideCard = guideCards[guideIndex % guideCards.length];
  const currentSafetyCard = safetyCards[safetyIndex % safetyCards.length];
  const currentEscapeSeconds = missionStartedAt
    ? Math.max(0, Math.round((escapeNow - missionStartedAt) / 1000))
    : 0;
  const videoLearningElapsedSeconds = activeVideoLearning?.startedAt
    ? Math.max(0, Math.floor((escapeNow - activeVideoLearning.startedAt) / 1000))
    : 0;
  const videoLearningMinimumSeconds = currentLearningSlide.minimumSeconds ?? 60;
  const videoLearningSecondsRemaining = Math.max(
    0,
    videoLearningMinimumSeconds - videoLearningElapsedSeconds,
  );
  const videoLearningCompleted = Boolean(activeVideoLearning?.completedAt);
  const dayCheckedCount = currentScheduleEvents.filter((event) =>
    checkedEvents.includes(event.id),
  ).length;
  const rank =
    completed.length >= 6
      ? "부산 마스터"
      : completed.length >= 4
        ? "해안 탐험가"
        : completed.length >= 2
          ? "미션 루키"
          : "출발 대기";

  const paintTripMap = useCallback(
    (
      L: any,
      map: any,
      layerRef: { current: any },
      viewportMode: MapViewportMode,
    ) => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }

      const layer = L.layerGroup().addTo(map);
      layerRef.current = layer;

      const routeLatLngs = currentRouteEvents.map((event) => [event.lat, event.lng]);
      if (routeLatLngs.length > 1) {
        L.polyline(routeLatLngs, {
          color: "#f26b5b",
          weight: 4,
          opacity: 0.9,
          dashArray: "8 8",
        }).addTo(layer);
      }

      currentRouteEvents.forEach((event, index) => {
        const mission = getMissionForEvent(event);
        const checked = checkedEvents.includes(event.id);
        const stamped = mission ? completed.includes(mission.id) : false;
        const active = focusedEventId === event.id;
        const marker = L.marker([event.lat, event.lng], {
          icon: L.divIcon({
            className: "trip-leaflet-icon",
            html: `<span class="trip-map-marker ${checked ? "checked" : ""} ${
              stamped ? "stamped" : ""
            } ${active ? "active" : ""}">${index + 1}</span>`,
            iconAnchor: [18, 18],
            iconSize: [36, 36],
          }),
        }).addTo(layer);

        marker
          .bindPopup(
            `<strong>${event.time} ${event.title}</strong><br/>${event.place}<br/><small>${event.subject}</small>`,
          )
          .on("click", () => setFocusedEventId(event.id));

        if (active && viewportMode === "focus") marker.openPopup();
      });

      if (routeLatLngs.length > 0) {
        const focused = currentRouteEvents.find((event) => event.id === focusedEventId);
        if (viewportMode === "focus" && focused) {
          map.flyTo([focused.lat, focused.lng], 14, { duration: 0.7 });
        } else if (viewportMode === "fit") {
          map.fitBounds(L.latLngBounds(routeLatLngs).pad(0.22), {
            maxZoom: 13,
            animate: false,
          });
        }
      }
    },
    [checkedEvents, completed, currentRouteEvents, focusedEventId, getMissionForEvent],
  );

  useEffect(() => {
    if (activePage !== "map") return;
    let cancelled = false;

    loadLeaflet()
      .then(() => {
        if (cancelled || !window.L || !mapNodeRef.current) return;
        const L = window.L;

        if (!mapRef.current) {
          mapRef.current = L.map(mapNodeRef.current, {
            scrollWheelZoom: false,
            zoomControl: false,
          }).setView([35.145, 129.09], 11);

          L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }).addTo(mapRef.current);
        }

        window.requestAnimationFrame(() => {
          if (!mapRef.current) return;
          const routeChanged = mapRouteKeyRef.current !== currentRouteKey;
          const focusChanged = mapFocusedEventRef.current !== focusedEventId;
          const viewportMode: MapViewportMode = routeChanged
            ? "fit"
            : focusChanged && focusedEventId
              ? "focus"
              : "preserve";

          mapRef.current.invalidateSize({ pan: false, debounceMoveend: true });
          paintTripMap(L, mapRef.current, mapLayerRef, viewportMode);
          mapRouteKeyRef.current = currentRouteKey;
          mapFocusedEventRef.current = focusedEventId;
        });
      })
      .catch(() => {
        // 지도가 실패해도 체크리스트와 기록 기능은 계속 사용하실 수 있습니다.
      });

    return () => {
      cancelled = true;
    };
  }, [activePage, currentRouteKey, focusedEventId, paintTripMap]);

  useEffect(() => {
    if (activeOverlay !== "mission") return;
    const frame = window.requestAnimationFrame(() => {
      overlayModalRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeOverlay, escapeStage, escapeChallengeIndex, escapeChapterDay]);

  useEffect(() => {
    if (activeOverlay !== "map") return;
    let cancelled = false;
    let frame = 0;
    const timers: number[] = [];

    loadLeaflet()
      .then(() => {
        if (cancelled || !window.L || !modalMapNodeRef.current) return;
        const L = window.L;

        if (!modalMapRef.current) {
          modalMapRef.current = L.map(modalMapNodeRef.current, {
            scrollWheelZoom: true,
            zoomControl: true,
          }).setView([35.145, 129.09], 11);

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }).addTo(modalMapRef.current);
        }

        frame = window.requestAnimationFrame(() => {
          if (!modalMapRef.current) return;
          modalMapRef.current.invalidateSize({ pan: false, debounceMoveend: true });
          setModalMapVersion((version) => version + 1);
          const refreshSize = () => {
            if (!modalMapRef.current) return;
            modalMapRef.current.invalidateSize({ pan: false, debounceMoveend: true });
          };
          timers.push(window.setTimeout(refreshSize, 120));
          timers.push(window.setTimeout(refreshSize, 360));
        });
      })
      .catch(() => {
        // 전체 지도 모달이 실패해도 기본 지도는 계속 사용할 수 있습니다.
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (modalMapRef.current) {
        modalMapRef.current.remove();
        modalMapRef.current = null;
        modalMapLayerRef.current = null;
      }
      modalMapRouteKeyRef.current = "";
      modalMapFocusedEventRef.current = null;
    };
  }, [activeOverlay]);

  useEffect(() => {
    if (activeOverlay !== "map" || !window.L || !modalMapRef.current) return;
    modalMapRef.current.invalidateSize({ pan: false, debounceMoveend: true });
    const routeChanged = modalMapRouteKeyRef.current !== currentRouteKey;
    const focusChanged = modalMapFocusedEventRef.current !== focusedEventId;
    const viewportMode: MapViewportMode = routeChanged
      ? "fit"
      : focusChanged && focusedEventId
        ? "focus"
        : "preserve";

    paintTripMap(window.L, modalMapRef.current, modalMapLayerRef, viewportMode);
    modalMapRouteKeyRef.current = currentRouteKey;
    modalMapFocusedEventRef.current = focusedEventId;
  }, [activeOverlay, currentRouteKey, focusedEventId, modalMapVersion, paintTripMap]);

  function switchTeam(team: TripTeam) {
    setActiveTeam(team);
    setEditingEventId(null);
    const nextDays = tripSchedules[team];
    const nextDay = nextDays[activeDay] ?? nextDays[0];
    const firstRouteEvent = nextDay.events.find(
      (event) => typeof event.lat === "number" && typeof event.lng === "number",
    );
    const firstMissionEvent = nextDay.events.find((event) => getMissionForEvent(event));
    const firstMission = firstMissionEvent ? getMissionForEvent(firstMissionEvent) : undefined;
    if (firstMission) setActiveMission(firstMission);
    setFocusedEventId(firstRouteEvent?.id ?? null);
    setAnswerState("idle");
  }

  function goToPage(pageId: AppPageId, behavior: ScrollBehavior = "auto") {
    const page = appPages.find((entry) => entry.id === pageId) ?? appPages[0];
    setActivePage(page.id);
    if (window.location.hash !== `#${page.hash}`) {
      window.history.replaceState(null, "", `#${page.hash}`);
    }
    window.scrollTo({ top: 0, behavior });
  }

  function switchDay(dayId: number) {
    setActiveDay(dayId);
    const nextDayEvents = getScheduleEventsForDay(tripDays[dayId]);
    const firstMissionEvent = nextDayEvents.find((event) => getMissionForEvent(event));
    const firstMission = firstMissionEvent ? getMissionForEvent(firstMissionEvent) : undefined;
    const firstRouteEvent = nextDayEvents.find(
      (event) => typeof event.lat === "number" && typeof event.lng === "number",
    );
    if (firstMission) setActiveMission(firstMission);
    setFocusedEventId(firstRouteEvent?.id ?? null);
    setAnswerState("idle");
  }

  function toggleEvent(eventId: string) {
    setCheckedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((item) => item !== eventId)
        : [...prev, eventId],
    );
  }

  function updateScheduleEdit(eventId: string, updates: ScheduleEdit) {
    setScheduleEdits((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] ?? {}),
        ...updates,
      },
    }));
  }

  function resetScheduleEdit(eventId: string) {
    setScheduleEdits((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setEditingEventId(null);
  }

  function addManualScheduleEvent() {
    const title = manualScheduleDraft.title.trim() || "추가 일정";
    const place = manualScheduleDraft.place.trim() || "현장 추가 장소";
    const detail = manualScheduleDraft.detail.trim() || "현장에서 새롭게 추가한 일정입니다.";
    const time = manualScheduleDraft.time.trim() || "미정";
    const event: TripEvent = {
      id: `manual-${activeTeam}-${currentDay.id}-${Date.now()}`,
      time,
      title,
      place,
      detail,
      subject: "수동추가",
    };

    const teamDayKey = `${activeTeam}-${currentDay.id}`;
    setCustomScheduleEvents((prev) => ({
      ...prev,
      [teamDayKey]: [...(prev[teamDayKey] ?? []), event],
    }));
    setFocusedEventId(event.id);
    setManualScheduleDraft({ time: "", title: "", place: "", detail: "" });
  }

  function removeManualScheduleEvent(eventId: string) {
    const teamDayKey = `${activeTeam}-${currentDay.id}`;
    setCustomScheduleEvents((prev) => ({
      ...prev,
      [teamDayKey]: (prev[teamDayKey] ?? []).filter((event) => event.id !== eventId),
    }));
    setCheckedEvents((prev) => prev.filter((item) => item !== eventId));
    setEventMemories((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    if (focusedEventId === eventId) setFocusedEventId(null);
  }

  function playEffect(kind: "open" | "draw" | "ladder" | "correct" | "wrong") {
    if (typeof window === "undefined") return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const notes =
      kind === "correct"
        ? [523.25, 659.25, 783.99]
        : kind === "wrong"
          ? [220, 164.81]
          : kind === "ladder"
            ? [329.63, 392, 493.88, 659.25, 880]
            : kind === "draw"
              ? [392, 493.88, 587.33, 783.99]
            : [440, 554.37];

    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "wrong" ? "sawtooth" : kind === "ladder" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      gain.connect(context.destination);
      const start = context.currentTime + index * (kind === "ladder" ? 0.055 : 0.075);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "ladder" ? 0.1 : 0.08, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "ladder" ? 0.11 : 0.13));
      oscillator.start(start);
      oscillator.stop(start + (kind === "ladder" ? 0.13 : 0.15));
    });

    window.setTimeout(() => void context.close(), kind === "ladder" ? 620 : 520);
  }

  function triggerDrawFx(kind: "draw" | "open" | "ladder" = "draw") {
    playEffect(kind);
    setDrawFx(true);
    window.setTimeout(() => setDrawFx(false), 850);
  }

  function openOverlay(overlay: ActiveOverlay) {
    setActiveOverlay(overlay);
    if (overlay === "mission") {
      setEscapeChapterDay(activeDay);
      setEscapeStage("briefing");
      setEscapeAttemptChallenges([]);
      setEscapeChallengeIndex(0);
      setEscapeSolvedIds([]);
      setEscapeInventory([]);
      setEscapeHintIds([]);
      setEscapeWrongCount(0);
      setEscapeFinalCode("");
      setEscapeShortAnswer("");
      setEscapeFeedback("");
      setEarnedItemFx(null);
      setEscapeElapsedSeconds(0);
      setMissionStudyDone(false);
      setMissionStartedAt(null);
      setLastEarnedScore(null);
      setLastScoreBreakdown("");
      setLearningIndex(0);
      setVideoLearningMessage("");
    }
    if (overlay === "guide") {
      setGuideIndex(0);
    }
    if (overlay) triggerDrawFx("open");
  }

  function startVideoLearning() {
    const now = Date.now();
    setVideoLearningProgress((prev) => {
      const current = prev[activeEscapeChapter.id];
      if (current?.completedAt || current?.startedAt) return prev;
      return {
        ...prev,
        [activeEscapeChapter.id]: { startedAt: now },
      };
    });
    setEscapeNow(now);
    setVideoLearningMessage(
      videoLearningCompleted
        ? "이 챕터의 영상 학습 점수는 이미 획득하셨습니다."
        : "영상이 새 탭에서 열립니다. 60초 이상 학습한 뒤 앱으로 돌아와 완료 버튼을 눌러 주세요.",
    );
  }

  function completeVideoLearning() {
    const progress = videoLearningProgress[activeEscapeChapter.id];
    if (progress?.completedAt) {
      setVideoLearningMessage("이 챕터의 영상 학습 100점을 이미 획득하셨습니다.");
      return;
    }
    if (!progress?.startedAt) {
      setVideoLearningMessage("먼저 유튜브 영상 보기를 눌러 학습을 시작해 주세요.");
      if (escapeSoundOn) playEffect("wrong");
      return;
    }
    const elapsedSeconds = Math.floor((Date.now() - progress.startedAt) / 1000);
    if (elapsedSeconds < videoLearningMinimumSeconds) {
      setEscapeNow(Date.now());
      setVideoLearningMessage(
        `${videoLearningMinimumSeconds - elapsedSeconds}초 더 학습하면 완료할 수 있습니다.`,
      );
      if (escapeSoundOn) playEffect("wrong");
      return;
    }
    setVideoLearningProgress((prev) => ({
      ...prev,
      [activeEscapeChapter.id]: {
        startedAt: progress.startedAt,
        completedAt: new Date().toISOString(),
      },
    }));
    setVideoLearningMessage("영상 학습을 완료하셨습니다. 이번 챕터 점수에 100점이 추가됩니다.");
    if (escapeSoundOn) playEffect("correct");
  }

  function startEscapeMission() {
    if (!studentProfile.studentNo.trim() || !studentProfile.name.trim()) {
      setEscapeFeedback("학번과 이름을 먼저 입력해 주세요. 한 번 입력하면 이 기기에 저장됩니다.");
      if (escapeSoundOn) playEffect("wrong");
      return;
    }
    const randomizedQuestions = createRandomEscapeAttempt(
      activeEscapeChapter,
      lastEscapeQuestionIds[activeEscapeChapter.id] ?? [],
    );
    setEscapeAttemptChallenges(randomizedQuestions);
    setLastEscapeQuestionIds((prev) => ({
      ...prev,
      [activeEscapeChapter.id]: randomizedQuestions.map((question) => question.questionId),
    }));
    setMissionStudyDone(true);
    setEscapeStage("challenge");
    setEscapeChallengeIndex(0);
    setEscapeSolvedIds([]);
    setEscapeInventory([]);
    setEscapeHintIds([]);
    setEscapeWrongCount(0);
    setEscapeFinalCode("");
    setEscapeShortAnswer("");
    setEscapeFeedback(
      `${randomizedQuestions.length}개의 무작위 문제가 준비되었습니다. 문제 묶음을 통과해 기록 조각을 회수하세요.`,
    );
    setEarnedItemFx(null);
    setEscapeElapsedSeconds(0);
    setMissionStartedAt(Date.now());
    setEscapeNow(Date.now());
    setAnswerState("idle");
    setLastEarnedScore(null);
    setLastScoreBreakdown("");
    setVideoLearningMessage("");
    if (escapeSoundOn) playEffect("open");
  }

  function selectEscapeChapter(day: number) {
    setEscapeChapterDay(day);
    setActiveDay(day);
    setEscapeStage("briefing");
    setEscapeAttemptChallenges([]);
    setMissionStudyDone(false);
    setMissionStartedAt(null);
    setEscapeChallengeIndex(0);
    setEscapeSolvedIds([]);
    setEscapeInventory([]);
    setEscapeHintIds([]);
    setEscapeWrongCount(0);
    setEscapeFinalCode("");
    setEscapeShortAnswer("");
    setEscapeFeedback("");
    setEarnedItemFx(null);
    setEscapeElapsedSeconds(0);
    setAnswerState("idle");
    setLastEarnedScore(null);
    setLastScoreBreakdown("");
    setVideoLearningMessage("");
  }

  function completeMission(mission: Mission) {
    setCompleted((prev) => (prev.includes(mission.id) ? prev : [...prev, mission.id]));
    const scheduleEvent = getScheduleEventForMission(mission);
    if (scheduleEvent) {
      setCheckedEvents((prev) =>
        prev.includes(scheduleEvent.id) ? prev : [...prev, scheduleEvent.id],
      );
      setFocusedEventId(scheduleEvent.id);
    }
    setAnswerState("correct");
  }

  function appendMissionLog(mission: Mission, answer: string, isCorrect: boolean) {
    const correctAnswer = mission.options[mission.answer] ?? mission.code;
    setMissionLogs((prev) => [
      ...prev,
      {
        missionId: mission.id,
        place: mission.place,
        question: mission.prompt,
        answer,
        correctAnswer,
        isCorrect,
        submittedAt: new Date().toISOString(),
      },
    ]);
  }

  async function submitEscapeRanking(entry: EscapeRankEntry) {
    try {
      const response = await fetch("/api/trip-ranking", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ranking: entry }),
      });
      if (response.ok) {
        const result = (await response.json().catch(() => null)) as { ownerKey?: string } | null;
        if (result?.ownerKey) {
          setEscapeRankings((prev) =>
            prev.map((item) => (item.id === entry.id ? { ...item, ownerKey: result.ownerKey } : item)),
          );
        }
        setRankingStatus("live");
        setRankingMessage("방탈출 점수가 공용 랭킹에 기록되었습니다.");
        window.setTimeout(() => void refreshSharedEscapeRankings({ quiet: true }), 600);
        return;
      }
      setRankingStatus("offline");
      setRankingMessage("점수는 이 기기에 저장되었지만 공용 랭킹 전송은 실패했습니다.");
    } catch {
      setRankingStatus("offline");
      setRankingMessage("점수는 이 기기에 저장되었습니다. 네트워크가 회복되면 다시 시도해 주세요.");
    }
  }

  function revealEscapeHint() {
    if (escapeHintIds.includes(currentEscapeChallenge.id)) return;
    setEscapeHintIds((prev) => [...prev, currentEscapeChallenge.id]);
    setEscapeFeedback(`힌트가 열렸습니다. 이 챕터의 힌트 보너스가 100점 줄어듭니다.`);
    if (escapeSoundOn) playEffect("open");
  }

  function revealEscapeFinalHint() {
    const hintId = `final-${activeEscapeChapter.id}`;
    if (escapeHintIds.includes(hintId)) return;
    setEscapeHintIds((prev) => [...prev, hintId]);
    setEscapeFeedback("최종 암호 힌트가 열렸습니다. 힌트 보너스가 100점 줄어듭니다.");
    if (escapeSoundOn) playEffect("open");
  }

  function resolveEscapeQuestion(answer: string, isCorrect: boolean) {
    if (escapeSolvedIds.includes(currentEscapeChallenge.id)) return;
    const mission = missions.find(
      (entry) => entry.id === currentEscapeChallenge.missionId,
    );
    if (!mission) return;

    const correctAnswer =
      currentEscapeChallenge.kind === "short"
        ? currentEscapeChallenge.acceptedAnswers?.[0] ?? ""
        : currentEscapeChallenge.options?.[currentEscapeChallenge.answer ?? -1] ?? "";
    setMissionLogs((prev) => [
      ...prev,
      {
        missionId: currentEscapeChallenge.questionId,
        place: `${activeTeam}팀 ${activeEscapeChapter.day + 1}일차`,
        question: currentEscapeChallenge.prompt,
        answer,
        correctAnswer,
        isCorrect,
        submittedAt: new Date().toISOString(),
      },
    ]);

    if (!isCorrect) {
      setEscapeWrongCount((prev) => prev + 1);
      setAnswerState("wrong");
      setEscapeFeedback("잠금 장치가 반응하지 않습니다. 단서 수첩을 다시 확인해 보세요. 오답 감점 60점이 적용됩니다.");
      if (escapeSoundOn) playEffect("wrong");
      return;
    }

    setEscapeSolvedIds((prev) => [...prev, currentEscapeChallenge.id]);
    setAnswerState("correct");
    if (currentEscapeChallenge.grantsItem) {
      setEscapeInventory((prev) =>
        prev.some((item) => item.label === currentEscapeChallenge.item.label)
          ? prev
          : [...prev, currentEscapeChallenge.item],
      );
      setActiveMission(mission);
      completeMission(mission);
      setEarnedItemFx(currentEscapeChallenge.item);
      setDrawFx(true);
      window.setTimeout(() => setDrawFx(false), 900);
      setEscapeFeedback(
        `${currentEscapeChallenge.item.label}을 획득했습니다. 암호 조각 ${currentEscapeChallenge.item.fragment}이 인벤토리에 추가되었습니다.`,
      );
    } else {
      setEscapeFeedback("보안 질문을 통과했습니다. 같은 장소의 다음 문제를 풀어 아이템을 찾아보세요.");
    }
    if (escapeSoundOn) playEffect("correct");
  }

  function chooseEscapeAnswer(index: number) {
    const selectedAnswer = currentEscapeChallenge.options?.[index] ?? "";
    resolveEscapeQuestion(selectedAnswer, index === currentEscapeChallenge.answer);
  }

  function submitEscapeShortAnswer() {
    const normalized = escapeShortAnswer.replace(/[\s.,·:()\-_/]/g, "").toLowerCase();
    const isCorrect = Boolean(
      normalized &&
        currentEscapeChallenge.acceptedAnswers?.some(
          (answer) => answer.replace(/[\s.,·:()\-_/]/g, "").toLowerCase() === normalized,
        ),
    );
    resolveEscapeQuestion(escapeShortAnswer.trim(), isCorrect);
  }

  function skipEscapeQuestion() {
    if (escapeSolvedIds.includes(currentEscapeChallenge.id)) return;
    const correctAnswer =
      currentEscapeChallenge.kind === "short"
        ? currentEscapeChallenge.acceptedAnswers?.[0] ?? ""
        : currentEscapeChallenge.options?.[currentEscapeChallenge.answer ?? -1] ?? "";

    setMissionLogs((prev) => [
      ...prev,
      {
        missionId: currentEscapeChallenge.questionId,
        place: `${activeTeam}팀 ${activeEscapeChapter.day + 1}일차`,
        question: currentEscapeChallenge.prompt,
        answer: "문항 건너뛰기",
        correctAnswer,
        isCorrect: false,
        submittedAt: new Date().toISOString(),
      },
    ]);
    setEscapeWrongCount((prev) => prev + 1);
    setEscapeSolvedIds((prev) => [...prev, currentEscapeChallenge.id]);
    setAnswerState("wrong");
    setEscapeShortAnswer("");

    if (currentEscapeChallenge.grantsItem) {
      setEscapeInventory((prev) =>
        prev.some((item) => item.label === currentEscapeChallenge.item.label)
          ? prev
          : [...prev, currentEscapeChallenge.item],
      );
    }

    setEscapeFeedback(
      `이 문항을 건너뛰었습니다. 정답은 ‘${correctAnswer}’입니다. 오답 1회로 기록되어 정확도 점수 60점이 줄어듭니다.`,
    );
    if (escapeSoundOn) playEffect("wrong");
  }

  function advanceEscapeChallenge() {
    if (!escapeSolvedIds.includes(currentEscapeChallenge.id)) return;
    setAnswerState("idle");
    setEscapeFeedback("");
    setEscapeShortAnswer("");
    if (escapeChallengeIndex >= escapeAttemptChallenges.length - 1) {
      setEscapeStage("final");
      setEscapeFeedback("세 개의 기록 조각이 모두 모였습니다. 최종 잠금 암호를 완성하세요.");
      if (escapeSoundOn) playEffect("open");
      return;
    }
    setEscapeChallengeIndex((prev) => prev + 1);
    if (escapeSoundOn) playEffect("open");
  }

  function submitEscapeFinalCode() {
    const normalizeCode = (value: string) =>
      value.replace(/[\s:\-_.]/g, "").toUpperCase();
    const submitted = normalizeCode(escapeFinalCode);
    const isCorrect = activeEscapeChapter.finalAnswers.some(
      (answer) => normalizeCode(answer) === submitted,
    );

    if (!isCorrect) {
      setEscapeWrongCount((prev) => prev + 1);
      setAnswerState("wrong");
      setEscapeFeedback("최종 잠금이 열리지 않았습니다. 인벤토리 조각의 순서와 일정표를 다시 확인하세요.");
      if (escapeSoundOn) playEffect("wrong");
      return;
    }

    const elapsedSeconds = missionStartedAt
      ? Math.max(1, Math.round((Date.now() - missionStartedAt) / 1000))
      : 600;
    const baseScore = 1000;
    const timeBonus = Math.max(0, 600 - elapsedSeconds);
    const hintBonus = Math.max(0, 300 - escapeHintIds.length * 100);
    const accuracyBonus = Math.max(0, 300 - escapeWrongCount * 60);
    const observationBonus = escapeWrongCount === 0 ? 150 : 0;
    const videoLearningBonus = videoLearningCompleted ? 100 : 0;
    const luckBonus = Math.floor(Math.random() * 81) - 20;
    const earnedScore = Math.max(
      100,
      baseScore + videoLearningBonus + timeBonus + hintBonus + accuracyBonus + observationBonus + luckBonus,
    );
    const entry: EscapeRankEntry = {
      id: `${Date.now()}-${activeEscapeChapter.id}`,
      studentNo: studentProfile.studentNo.trim(),
      name: studentProfile.name.trim(),
      tripTeam: activeTeam,
      tripClasses: activeTeamInfo.classes,
      missionId: activeEscapeChapter.id,
      missionTitle: activeEscapeChapter.title,
      place: `${activeTeam}팀 ${activeEscapeChapter.day + 1}일차`,
      score: earnedScore,
      videoLearningScore: videoLearningBonus,
      elapsedSeconds,
      createdAt: new Date().toISOString(),
    };

    setEscapeRankings((prev) => mergeEscapeRankings([...prev, entry]));
    void submitEscapeRanking(entry);
    setMissionLogs((prev) => [
      ...prev,
      {
        missionId: activeEscapeChapter.id,
        place: entry.place,
        question: activeEscapeChapter.finalPrompt,
        answer: escapeFinalCode,
        correctAnswer: activeEscapeChapter.finalAnswers[0],
        isCorrect: true,
        earnedScore,
        elapsedSeconds,
        submittedAt: new Date().toISOString(),
      },
    ]);
    setEscapeElapsedSeconds(elapsedSeconds);
    setEscapeNow(Date.now());
    setLastEarnedScore(earnedScore);
    setLastScoreBreakdown(
      `기본 ${baseScore} + 영상 학습 ${videoLearningBonus} + 시간 ${timeBonus} + 힌트 ${hintBonus} + 정확도 ${accuracyBonus} + 관찰 ${observationBonus} + 복불복 ${luckBonus >= 0 ? "+" : ""}${luckBonus}`,
    );
    setEscapeStage("result");
    setAnswerState("correct");
    setEscapeFeedback("여행 여권 기록 복구에 성공했습니다. 새 점수가 랭킹에 전송되었습니다.");
    if (escapeSoundOn) playEffect("correct");
  }

  function recordEscapeScore(mission: Mission) {
    if (activeOverlay !== "mission" || !missionStudyDone) return null;
    if (!studentProfile.studentNo.trim() || !studentProfile.name.trim()) {
      setRankingStatus("offline");
      setRankingMessage("방탈출 랭킹 점수를 기록하려면 학번과 이름을 먼저 입력해 주세요.");
      setLastEarnedScore(null);
      setLastScoreBreakdown("랭킹 이름 설정 후 다시 도전하면 점수가 기록됩니다.");
      return null;
    }
    setEscapeNow(Date.now());
    const elapsedSeconds = missionStartedAt
      ? Math.max(1, Math.round((Date.now() - missionStartedAt) / 1000))
      : 120;
    const baseScore = mission.reward * 10;
    const timeBonus = Math.max(0, 180 - elapsedSeconds);
    const luckBonus = Math.floor(Math.random() * 61) - 10;
    const earnedScore = Math.max(10, baseScore + timeBonus + luckBonus);
    const entry: EscapeRankEntry = {
      id: `${Date.now()}-${mission.id}`,
      studentNo: studentProfile.studentNo.trim(),
      name: studentProfile.name.trim() || "익명",
      tripTeam: activeTeam,
      tripClasses: activeTeamInfo.classes,
      missionId: mission.id,
      missionTitle: mission.title,
      place: mission.place,
      score: earnedScore,
      elapsedSeconds,
      createdAt: new Date().toISOString(),
    };

    setEscapeRankings((prev) => {
      return mergeEscapeRankings([...prev, entry]);
    });
    void submitEscapeRanking(entry);
    setLastEarnedScore(earnedScore);
    setLastScoreBreakdown(
      `기본 ${baseScore}점 + 시간 ${timeBonus}점 + 복불복 ${luckBonus >= 0 ? "+" : ""}${luckBonus}점`,
    );
    return { earnedScore, elapsedSeconds };
  }

  function chooseAnswer(index: number) {
    const selectedAnswer = activeMission.options[index] ?? "";
    const isCorrect = index === activeMission.answer;
    const scoreResult = isCorrect ? recordEscapeScore(activeMission) : null;
    appendMissionLog(activeMission, selectedAnswer, index === activeMission.answer);
    if (isCorrect) {
      playEffect("correct");
      completeMission(activeMission);
      if (scoreResult) {
        setMissionLogs((prev) => {
          const next = [...prev];
          const latest = next[next.length - 1];
          if (latest) {
            next[next.length - 1] = {
              ...latest,
              earnedScore: scoreResult.earnedScore,
              elapsedSeconds: scoreResult.elapsedSeconds,
            };
          }
          return next;
        });
      }
    } else {
      playEffect("wrong");
      setAnswerState("wrong");
    }
  }

  function submitCode() {
    const normalized = stampCode.replace(/\s/g, "");
    const matched = missions.find(
      (mission) => mission.code.replace(/\s/g, "") === normalized,
    );
    if (matched) {
      setActiveDay(getScheduleDayForMission(matched)?.id ?? matched.day);
      setActiveMission(matched);
      appendMissionLog(matched, `현장 코드: ${stampCode}`, true);
      playEffect("correct");
      completeMission(matched);
      setStampCode("");
    } else {
      playEffect("wrong");
      setAnswerState("wrong");
    }
  }

  function getMemoryDetails() {
    return tripDays.flatMap((day) => {
      const dayFreeEvent: TripEvent = {
        id: `free-memory-${activeTeam}-${day.id}`,
        time: "자유",
        title: day.id === currentDay.id ? freeMemoryTitle.trim() || "숙소의 기억" : "숙소의 기억",
        place: day.id === currentDay.id ? freeMemoryPlace.trim() || "숙소/자유 시간" : "숙소/자유 시간",
        detail: "일정표에 없는 숙소, 이동 중, 자유시간의 장면을 따로 남깁니다.",
        subject: "자유기록",
      };
      return [...getScheduleEventsForDay(day), dayFreeEvent]
        .map((event) => {
          const memory = eventMemories[event.id];
          const photos = memory?.photos?.length
            ? memory.photos
            : memory?.photo
              ? [
                  {
                    caption: "",
                    sticker: "BUSAN",
                    tone: "clean",
                  },
                ]
              : [];
          if (!memory?.note?.trim() && photos.length === 0) return null;
          return {
            team: `${activeTeam}팀`,
            day: day.label,
            date: day.date,
            time: event.time,
            title: event.title,
            place: event.place,
            note: memory.note ?? "",
            hasPhoto: photos.length > 0,
            photoCount: photos.length,
            photoCaptions: photos.map((photo) => photo.caption).filter(Boolean),
            updatedAt: memory.updatedAt ?? "",
          };
        })
        .filter(Boolean);
    });
  }

  function updateSelectedMemory(note: string) {
    if (!selectedEvent) return;
    setEventMemories((prev) => ({
      ...prev,
      [selectedEvent.id]: {
        ...(prev[selectedEvent.id] ?? {}),
        note,
        updatedAt: new Date().toISOString(),
      },
    }));
    setMemoryMessage("이 일정의 메모가 이 기기에 저장되었습니다.");
  }

  async function handleMemoryPhoto(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0 || !selectedEvent) return;

    try {
      const remainingSlots = Math.max(0, maxMemoryPhotos - selectedPhotos.length);
      const selectedFiles = files.slice(0, remainingSlots);
      if (selectedFiles.length === 0) {
        setMemoryMessage("사진은 일정마다 최대 5장까지 저장할 수 있습니다.");
        return;
      }
      const photos = await Promise.all(
        selectedFiles.map(async (file, index): Promise<TripPhoto> => ({
          id: `${Date.now()}-${index}`,
          src: await fileToInstantPhoto(file),
          caption: "",
          sticker: photoStickers[(selectedPhotos.length + index) % photoStickers.length],
          icon: photoIcons[(selectedPhotos.length + index) % photoIcons.length],
          tone: photoTones[(selectedPhotos.length + index) % photoTones.length],
          format: "mini" as PhotoFormat,
          frame: photoFrameOptions[(selectedPhotos.length + index) % photoFrameOptions.length].value,
          showTags: true,
          showCredit: true,
          createdAt: new Date().toISOString(),
        })),
      );
      setEventMemories((prev) => ({
        ...prev,
        [selectedEvent.id]: {
          ...(prev[selectedEvent.id] ?? { note: "" }),
          photos: [...selectedPhotos, ...photos].slice(0, maxMemoryPhotos),
          photo: undefined,
          updatedAt: new Date().toISOString(),
        },
      }));
      setMemoryMessage(`사진 ${photos.length}장이 인스탁스 카드에 맞게 저장되었습니다.`);
    } catch {
      setMemoryMessage("사진을 불러오지 못했습니다. 다른 이미지를 선택해 주세요.");
    }
  }

  function updateMemoryPhoto(photoId: string, updates: Partial<TripPhoto>) {
    if (!selectedEvent) return;
    setEventMemories((prev) => ({
      ...prev,
      [selectedEvent.id]: {
        ...(prev[selectedEvent.id] ?? { note: "" }),
        photos: selectedPhotos.map((photo) =>
          photo.id === photoId ? { ...photo, ...updates } : photo,
        ),
        photo: undefined,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function removeMemoryPhoto(photoId: string) {
    if (!selectedEvent) return;
    setEventMemories((prev) => ({
      ...prev,
      [selectedEvent.id]: {
        ...(prev[selectedEvent.id] ?? { note: "" }),
        photos: selectedPhotos.filter((photo) => photo.id !== photoId),
        photo: undefined,
        updatedAt: new Date().toISOString(),
      },
    }));
    setMemoryMessage("사진을 지웠습니다. 메모는 그대로 남아 있습니다.");
  }

  async function downloadMemoryPhoto(photo: TripPhoto, index: number) {
    if (!selectedEvent) return;
    try {
      await downloadInstantPhotoCard({
        photo,
        title: selectedEvent.title,
        place: selectedEvent.place,
        date: `${currentDay.label} ${currentDay.date} ${selectedEvent.time}`,
        note: selectedMemory.note,
        index,
      });
      setMemoryMessage("인스탁스 미니 느낌의 사진 파일을 다운로드했습니다.");
    } catch {
      setMemoryMessage("사진 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function handleSubmittedPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    try {
      const remainingSlots = Math.max(0, maxSubmitPhotos - submittedPhotos.length);
      const selectedFiles = files.slice(0, remainingSlots);
      if (selectedFiles.length === 0) {
        setSubmitStatus("error");
        setSubmitMessage(`사진자료는 최대 ${maxSubmitPhotos}장까지 제출할 수 있습니다.`);
        return;
      }
      const nextPhotos = await Promise.all(selectedFiles.map(fileToSubmittedPhoto));
      setSubmittedPhotos((prev) => [...prev, ...nextPhotos].slice(0, maxSubmitPhotos));
      setSubmitStatus("idle");
      setSubmitMessage(`사진자료 ${nextPhotos.length}장이 제출 목록에 추가되었습니다.`);
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("사진자료를 불러오지 못했습니다. 다른 이미지를 선택해 주세요.");
    }
  }

  function removeSubmittedPhoto(photoId: string) {
    setSubmittedPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  }

  function renderLadderAnimation() {
    const names = linesToList(ladderNames);
    if (names.length === 0) return null;
    const railCount = Math.max(names.length, 2);
    const isDrawn = ladderPairs.length > 0;
    const bars = ladderBars;

    return (
      <div
        className={`ladder-stage ${drawFx ? "is-running" : ""} ${isDrawn ? "is-drawn" : "is-arranged"}`}
        aria-label="움직이는 사다리 추첨 화면"
      >
        <div className="ladder-layout-status">
          <span>{isDrawn ? "추첨 완료" : "사다리 배치 완료"}</span>
          <strong>{names.length}명 자동 배치</strong>
        </div>
        <div className="ladder-name-row">
          {names.map((name, index) => (
            <span key={`${name}-${index}`}>{name}</span>
          ))}
        </div>
        <div className="ladder-track">
          {Array.from({ length: railCount }, (_, index) => (
            <span
              className="ladder-rail"
              key={`rail-${index}`}
              style={{ left: `${(100 / railCount) * index + 100 / railCount / 2}%` }}
            />
          ))}
          {bars.map((bar) => (
            <span
              className="ladder-bar"
              key={bar.id}
              style={{ left: bar.left, top: bar.top, width: bar.width }}
            />
          ))}
          {isDrawn
            ? names.map((name, index) => (
                <span
                  className="ladder-runner"
                  key={`${name}-${index}-runner`}
                  style={{
                    left: `${(100 / railCount) * index + 100 / railCount / 2}%`,
                    animationDelay: `${index * 90}ms`,
                  }}
                />
              ))
            : null}
        </div>
        <div className="ladder-name-row ladder-result-row">
          {names.map((name, index) => (
            <span key={`${name}-${index}-result`}>{ladderPairs[index]?.result ?? "결과 대기"}</span>
          ))}
        </div>
      </div>
    );
  }

  function renderVideoLearningReward() {
    if (!currentLearningSlide.videoReward) return null;
    const reward = currentLearningSlide.videoReward;
    const buttonLabel = videoLearningCompleted
      ? `영상 학습 ${reward}점 획득 완료`
      : !activeVideoLearning?.startedAt
        ? "영상을 먼저 열어 주세요"
        : videoLearningSecondsRemaining > 0
          ? `${videoLearningSecondsRemaining}초 후 완료 가능`
          : `영상 학습 완료 · +${reward}점`;

    return (
      <div className={`video-learning-reward ${videoLearningCompleted ? "completed" : ""}`}>
        <div>
          <span>VIDEO BONUS</span>
          <strong>챕터별 영상 학습 +{reward}점</strong>
          <p>영상을 연 뒤 {currentLearningSlide.minimumSeconds ?? 60}초 이상 학습하면 이번 챕터 점수에 반영됩니다.</p>
        </div>
        <button
          type="button"
          disabled={
            videoLearningCompleted ||
            !activeVideoLearning?.startedAt ||
            videoLearningSecondsRemaining > 0
          }
          onClick={completeVideoLearning}
        >
          {videoLearningCompleted ? "✓ " : ""}{buttonLabel}
        </button>
        {videoLearningMessage ? <small>{videoLearningMessage}</small> : null}
      </div>
    );
  }

  function renderEscapeRankingBoard(mode: "compact" | "full" = "full") {
    return (
      <div className={`escape-ranking-board ${mode === "compact" ? "compact-ranking" : ""}`}>
        <div>
          <span>LIVE RANKING</span>
          <strong>방탈출 실시간 랭킹</strong>
        </div>

        <div className="ranking-profile">
          <label>
            <span>학번</span>
            <input
              value={studentProfile.studentNo}
              onChange={(event) =>
                setStudentProfile((prev) => ({
                  ...prev,
                  studentNo: event.target.value,
                }))
              }
              placeholder="20101"
            />
          </label>
          <label>
            <span>이름</span>
            <input
              value={studentProfile.name}
              onChange={(event) =>
                setStudentProfile((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="이름"
            />
          </label>
        </div>

        <div className={`ranking-sync ${rankingStatus}`}>
          <span>{rankingStatus === "syncing" ? "갱신 중" : rankingStatus === "live" ? "실시간 갱신" : "랭킹 상태"}</span>
          <button type="button" onClick={() => void refreshSharedEscapeRankings()}>
            새로고침
          </button>
          <p>
            {rankingMessage ||
              (lastRankingSync ? `${lastRankingSync} 기준으로 5초마다 자동 갱신됩니다.` : "5초마다 자동 갱신됩니다.")}
          </p>
        </div>

        <p className="ranking-privacy-note">다른 학생의 학번과 이름은 일부를 가려서 보여 줍니다.</p>

        {topEscapeRankings.length > 0 ? (
          <ol>
            {topEscapeRankings.slice(0, mode === "compact" ? 5 : 8).map((entry, index) => (
              <li key={entry.id}>
                <span>{index + 1}</span>
                <strong>
                  {entry.studentNo ? `${entry.studentNo} ` : ""}
                  {entry.name}
                </strong>
                <em>{entry.score}점</em>
                <small>
                  {entry.place} · {entry.elapsedSeconds}초
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p>아직 랭킹이 없습니다. 학번과 이름을 입력하고 첫 기록을 만들어 보세요.</p>
        )}
      </div>
    );
  }

  function renderGuideScreenshot() {
    return (
      <div className={`guide-phone guide-${currentGuideCard.screen}`} aria-hidden="true">
        <div className="guide-phone-top">
          <span />
          <strong>SCH Busan</strong>
        </div>
        {currentGuideCard.screen === "map" ? (
          <div className="guide-map-shot">
            <div className="guide-team-tabs"><b>A팀</b><span>B팀</span><span>C팀</span></div>
            <div className="guide-map-line" />
            <span className="pin one">1</span>
            <span className="pin two">2</span>
            <span className="pin three">3</span>
            <div className="guide-side-list">
              <strong>지도 크게 보기</strong>
              <p>장소 목록 선택</p>
            </div>
          </div>
        ) : null}
        {currentGuideCard.screen === "check" ? (
          <div className="guide-check-shot">
            {["07:10 서울역 집결", "13:00 국제시장", "19:40 엘시티 도착"].map((item, index) => (
              <div key={item}>
                <span>{index < 2 ? "✓" : ""}</span>
                <p>{item}</p>
              </div>
            ))}
            <label>나의 일정 메모</label>
          </div>
        ) : null}
        {currentGuideCard.screen === "safety" ? (
          <div className="guide-safety-shot">
            <span>SAFE TRIP</span>
            <strong>안전교육 확인</strong>
            <p>이동 · 숙소 · 체험 활동 전 약속을 먼저 확인합니다.</p>
            <div>
              <b>안전교육 탭</b>
              <b>인솔 선생님께 즉시 알림</b>
              <b>하단 학교 링크로 연락처 확인</b>
            </div>
          </div>
        ) : null}
        {currentGuideCard.screen === "mission" ? (
          <div className="guide-mission-shot">
            <span>LEARNING BRIEF</span>
            <strong>방탈출 미션</strong>
            <p>학습 → 시작 → 문제 풀이 → 랭킹 기록</p>
            <div className="guide-score-pill">+ 점수 획득</div>
          </div>
        ) : null}
        {currentGuideCard.screen === "stampCode" ? (
          <div className="guide-code-shot">
            <span>STAMP CODE</span>
            <strong>현장 인증 코드</strong>
            <p>선생님이 알려 준 코드를 입력하면 장소 스탬프가 찍힙니다.</p>
            <label>
              <span>예: 도시재생</span>
              <b>찍기</b>
            </label>
          </div>
        ) : null}
        {currentGuideCard.screen === "rank" ? (
          <div className="guide-rank-shot">
            <span>LIVE TOP10</span>
            <strong>랭킹 기록</strong>
            <p>스탬프 전송 + 방탈출 전송</p>
            <div>
              <b>개인 TOP</b>
              <b>학급 합산</b>
              <b>가산점·상품</b>
            </div>
          </div>
        ) : null}
        {currentGuideCard.screen === "photo" ? (
          <div className="guide-photo-shot">
            <div className="guide-polaroid">
              <span>BUSAN</span>
              <p>오늘의 한 장</p>
            </div>
            <div className="guide-photo-tools">
              <span>미니</span>
              <span>스퀘어</span>
              <span>와이드</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function buildMailBody() {
    const memoryDetails = getMemoryDetails();
    const checkedEventDetails = tripDays.flatMap((day) =>
      getScheduleEventsForDay(day)
        .filter((event) => checkedEvents.includes(event.id))
        .map((event) => `${day.label} ${event.time} ${event.title} - ${event.place}`),
    );
    const stampDetails = missions
      .filter((mission) => completed.includes(mission.id))
      .map(
        (mission) =>
          `${getScheduleDayForMission(mission)?.label ?? tripDays[mission.day]?.label} ${mission.place} ${mission.stamp}`,
      );

    return [
      "신천고등학교 수학여행 - 부산 수학여행 스탬프 투어 나의 기록",
      "",
      `학생: ${studentProfile.studentNo || "-"} ${studentProfile.name || ""}`,
      `팀: ${activeTeam}팀 (${activeTeamInfo.classes})`,
      `학교메일: ${studentProfile.email || "-"}`,
      `스탬프: ${completed.length}/${missions.length}`,
      `점수: ${score} XP`,
      `방탈출 점수: ${myEscapeScore}점`,
      `총점: ${totalScore}점`,
      "",
      "[체크한 일정]",
      checkedEventDetails.length ? checkedEventDetails.join("\n") : "아직 체크한 일정이 없습니다.",
      "",
      "[획득한 스탬프]",
      stampDetails.length ? stampDetails.join("\n") : "아직 획득한 스탬프가 없습니다.",
      "",
      "[일정별 나의 메모]",
      memoryDetails.length
        ? memoryDetails
            .map((item) => {
              const detail = item as {
                day: string;
                time: string;
                title: string;
                place: string;
                note: string;
                hasPhoto: boolean;
                photoCount?: number;
                photoCaptions?: string[];
              };
              return `${detail.day} ${detail.time} ${detail.title} - ${detail.place}\n${detail.note || "(사진만 저장됨)"}${detail.hasPhoto ? `\n사진: ${detail.photoCount ?? 1}장, 이 기기 안의 앱 화면에 저장됨` : ""}${detail.photoCaptions?.length ? `\n사진 캡션: ${detail.photoCaptions.join(", ")}` : ""}`;
            })
            .join("\n\n")
        : "아직 일정별 메모가 없습니다.",
      "",
      "[소감문]",
      reflection || "아직 소감문이 없습니다.",
      "",
      "[방탈출 랭킹 TOP 5]",
      topEscapeRankings.length
        ? topEscapeRankings
            .slice(0, 5)
            .map(
              (entry, index) =>
                `${index + 1}. ${entry.name} ${entry.score}점 (${entry.elapsedSeconds}초, ${entry.missionTitle})`,
            )
            .join("\n")
        : "아직 랭킹 기록이 없습니다.",
    ].join("\n");
  }

  function sendRecordEmail() {
    const subject = encodeURIComponent("신천고등학교 수학여행 - 부산 수학여행 스탬프 투어 나의 기록");
    const body = encodeURIComponent(buildMailBody());
    const email = studentProfile.email?.trim() ?? "";
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  }

  async function submitScoreRecord(kind: ScoreSubmitKind) {
    if (!studentProfile.studentNo.trim() || !studentProfile.name.trim()) {
      setScoreSubmitStatus("error");
      setScoreSubmitMessage("학번과 이름을 먼저 입력해 주세요.");
      return;
    }

    const studentPayload = {
      studentNo: studentProfile.studentNo.trim(),
      name: studentProfile.name.trim(),
      email: studentProfile.email?.trim() ?? "",
    };
    const isStamp = kind === "stamp";
    setScoreSubmitStatus("saving");
    setScoreSubmitMessage(`${isStamp ? "스탬프 여권" : "방탈출"} 점수를 전송하는 중입니다.`);

    try {
      const response = await fetch("/api/trip-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: isStamp ? "stamp-score" : "escape-score",
          school: "신천고등학교",
          activity: "부산 수학여행 스탬프 투어",
          tripTeam: activeTeam,
          tripClasses: activeTeamInfo.classes,
          student: studentPayload,
          score: isStamp ? score : myEscapeScore,
          stampScore: isStamp ? score : 0,
          escapeScore: isStamp ? 0 : myEscapeScore,
          rank,
          stamps: isStamp
            ? missions
                .filter((mission) => completed.includes(mission.id))
                .map((mission) => ({
                  day: getScheduleDayForMission(mission)?.label ?? tripDays[mission.day]?.label,
                  place: mission.place,
                  stamp: mission.stamp,
                  subject: mission.subject,
                  reward: mission.reward,
                }))
            : [],
          escapeRankings: isStamp ? [] : escapeRankings,
          submittedAt: new Date().toISOString(),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; code?: string };

      if (response.ok && result.ok) {
        setScoreSubmitStatus("saved");
        setScoreSubmitMessage(`${isStamp ? "스탬프 여권" : "방탈출"} 점수를 따로 전송했습니다.`);
        return;
      }

      if (result.code === "missing_config") {
        setScoreSubmitStatus("missing-config");
        setScoreSubmitMessage("백엔드 URL이 아직 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요.");
        return;
      }

      throw new Error(result.message ?? "score submit failed");
    } catch {
      setScoreSubmitStatus("error");
      setScoreSubmitMessage("점수 전송에 실패했습니다. 네트워크 또는 Google Apps Script 설정을 확인해 주세요.");
    }
  }

  async function submitTripRecord() {
    if (!studentProfile.studentNo.trim() || !studentProfile.name.trim()) {
      setSubmitStatus("error");
      setSubmitMessage("학번과 이름을 먼저 입력해 주세요.");
      return;
    }

    const schoolEmail = studentProfile.email?.trim() ?? "";
    if (!/^[^\s@]+@sch\.hs\.kr$/i.test(schoolEmail)) {
      setSubmitStatus("error");
      setSubmitMessage("학교메일은 2026학번@sch.hs.kr 형식으로 입력해 주세요.");
      return;
    }

    if (!reflection.trim()) {
      setSubmitStatus("error");
      setSubmitMessage("수학여행 소감문을 먼저 작성해 주세요.");
      return;
    }

    if (submittedPhotos.length > 0 && !portraitConsent) {
      setSubmitStatus("error");
      setSubmitMessage("사진자료를 제출하려면 초상권 동의 확인 체크가 필요합니다.");
      return;
    }

    setSubmitStatus("saving");
    setSubmitMessage(
      submittedPhotos.length > 0
        ? "Google Sheets와 Google Drive로 기록과 사진자료를 보내는 중입니다."
        : "Google Sheets로 기록을 보내는 중입니다.",
    );

    const checkedEventDetails = tripDays.flatMap((day) =>
      getScheduleEventsForDay(day)
        .filter((event) => checkedEvents.includes(event.id))
        .map((event) => ({
          team: `${activeTeam}팀`,
          day: day.label,
          date: day.date,
          time: event.time,
          title: event.title,
          place: event.place,
          subject: event.subject,
          note: eventMemories[event.id]?.note ?? "",
        })),
    );

    const stampDetails = missions
      .filter((mission) => completed.includes(mission.id))
      .map((mission) => ({
        day: getScheduleDayForMission(mission)?.label ?? tripDays[mission.day]?.label,
        place: mission.place,
        stamp: mission.stamp,
        subject: mission.subject,
        reward: mission.reward,
      }));
    const memoryDetails = getMemoryDetails();

    try {
      const response = await fetch("/api/trip-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordType: "full-record",
          school: "신천고등학교",
          activity: "부산 수학여행 스탬프 투어",
          tripTeam: activeTeam,
          tripClasses: activeTeamInfo.classes,
          student: {
            studentNo: studentProfile.studentNo.trim(),
            name: studentProfile.name.trim(),
            email: schoolEmail,
          },
          score: totalScore,
          stampScore: score,
          escapeScore: myEscapeScore,
          rank,
          stamps: stampDetails,
          checkedSchedule: checkedEventDetails,
          memories: memoryDetails,
          missionLogs,
          escapeRankings,
          reflection,
          photoSubmission: {
            portraitConsent,
            folderHint: `${studentProfile.studentNo}_${studentProfile.name}`,
            photos: submittedPhotos.map((photo, index) => ({
              index: index + 1,
              name: photo.name,
              type: photo.type,
              size: photo.size,
              dataUrl: photo.dataUrl,
            })),
          },
          submittedAt: new Date().toISOString(),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; code?: string };

      if (response.ok && result.ok) {
        setSubmitStatus("saved");
        setSubmitMessage(
          submittedPhotos.length > 0
            ? "제출이 완료되었습니다. 기록은 Sheet에, 사진자료는 Apps Script를 통해 Drive에 저장됩니다."
            : "제출이 완료되었습니다. 선생님 Google Sheet에 기록되었습니다.",
        );
        return;
      }

      if (result.code === "missing_config") {
        setSubmitStatus("missing-config");
        setSubmitMessage(
          "백엔드 URL이 아직 설정되지 않았습니다. Vercel 환경변수 TRIP_GOOGLE_SCRIPT_URL을 설정해 주세요.",
        );
        return;
      }

      throw new Error(result.message ?? "submit failed");
    } catch {
      setSubmitStatus("error");
      setSubmitMessage("제출에 실패했습니다. 네트워크 또는 Google Apps Script 설정을 확인해 주세요.");
    }
  }

  function renderMemoryPanel() {
    if (!selectedEvent) return null;
    return (
      <div className="memory-panel timeline-memory" id="my-memory" onClick={(event) => event.stopPropagation()}>
        <div className="memory-copy">
          <span>나의 일정 기록</span>
          <h3>
            {selectedEvent.time} {selectedEvent.title}
          </h3>
          <p>
            {selectedEvent.place}에서 기억하고 싶은 장면, 친구와 나눈 말, 배운 점을 짧게
            남겨 보세요. 체크와 메모는 이 기기 브라우저에 바로 저장됩니다.
          </p>
        </div>

        <label className="memory-note">
          <span>메모</span>
          <textarea
            value={selectedMemory.note}
            onChange={(event) => updateSelectedMemory(event.target.value)}
            rows={5}
            placeholder="예: 시장에서 본 간판, 이동하며 알게 된 점, 다음 장소에서 확인할 질문"
          />
        </label>

        <p className="memory-help">
          사진은 아래 사진첩에서 따로 정리하고 저장할 수 있습니다.
        </p>
        {memoryMessage ? <p className="memory-message">{memoryMessage}</p> : null}
      </div>
    );
  }

  function focusEvent(event: TripEvent) {
    setFocusedEventId(event.id);
    const mission = getMissionForEvent(event);
    if (mission) {
      setActiveMission(mission);
      setAnswerState("idle");
    }
  }

  function arrangeLadder(nextNames = ladderNames, withEffect = true) {
    const names = linesToList(nextNames);
    setLadderPairs([]);
    setLadderBars(generateLadderBars(names.length));
    if (withEffect && names.length > 1) triggerDrawFx("open");
  }

  function handleLadderNamesChange(value: string) {
    setLadderNames(value);
    arrangeLadder(value, false);
  }

  function handleLadderResultsChange(value: string) {
    setLadderResults(value);
    setLadderPairs([]);
  }

  function runLadder() {
    const names = linesToList(ladderNames);
    const results = linesToList(ladderResults);
    if (names.length === 0 || results.length === 0) {
      setLadderPairs([]);
      return;
    }

    const expandedResults = [...results];
    while (expandedResults.length < names.length) {
      expandedResults.push(...results);
    }

    const shuffled = shuffleList(expandedResults).slice(0, names.length);
    if (ladderBars.length === 0) {
      setLadderBars(generateLadderBars(names.length));
    }
    setLadderPairs(names.map((name, index) => ({ name, result: shuffled[index] })));
    triggerDrawFx("ladder");
  }

  function drawRandomItem() {
    const items = linesToList(randomItems);
    if (items.length === 0) {
      setRandomPick("");
      return;
    }

    const pick = items[Math.floor(Math.random() * items.length)];
    setRandomPick(pick);
    setRandomHistory((prev) => [pick, ...prev].slice(0, 8));
    triggerDrawFx("draw");
  }

  function renderPagePager(pageId: AppPageId, tone: "light" | "dark" = "light") {
    const pageIndex = appPages.findIndex((page) => page.id === pageId);
    const currentPage = appPages[pageIndex];
    const previousPage = appPages[pageIndex - 1];
    const nextPage = appPages[pageIndex + 1] ?? appPages[0];

    return (
      <nav className={`app-page-pager ${tone}`} aria-label={`${currentPage.label} 페이지 이동`}>
        <button
          type="button"
          onClick={() => previousPage && goToPage(previousPage.id)}
          disabled={!previousPage}
        >
          <span aria-hidden="true">←</span>
          이전
        </button>
        <div aria-live="polite">
          <span>{pageIndex + 1} / {appPages.length}</span>
          <strong>{currentPage.label}</strong>
        </div>
        <button type="button" onClick={() => goToPage(nextPage.id)}>
          {pageIndex === appPages.length - 1 ? "처음으로" : "다음"}
          <span aria-hidden="true">→</span>
        </button>
      </nav>
    );
  }

  return (
    <main className={`trip-app page-mode active-page-${activePage}`} id="top">
      <nav className="app-page-switcher" aria-label="앱 페이지 바로가기">
        <button
          className="app-page-home"
          type="button"
          onClick={() => goToPage("home")}
          aria-label="첫 페이지 바로가기"
          title="첫 페이지 바로가기"
        >
          <span aria-hidden="true">⌂</span>
        </button>
        <div className="app-page-tabs" role="tablist" aria-label="1페이지부터 10페이지까지 선택">
          {appPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              role="tab"
              data-page-tab={page.id}
              aria-selected={activePage === page.id}
              className={activePage === page.id ? "active" : ""}
              onClick={() => goToPage(page.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{page.label}</strong>
            </button>
          ))}
        </div>
      </nav>
      <section className="trip-hero" aria-label="신천고등학교 수학여행 대시보드">
        <img src="/trip-hero.png" alt="" className="trip-hero-image" />
        <div className="trip-hero-overlay" />
        <div className="trip-topbar">
          <a
            className="trip-brand"
            href="https://sc-h.goesh.kr/"
            target="_blank"
            rel="noreferrer"
            aria-label="신천고등학교 홈페이지"
          >
            <span className="school-mark" aria-hidden="true">
              <img src="/sincheon-school-logo.png" alt="" />
            </span>
            <strong>신천고등학교 수학여행</strong>
          </a>
          <div className="trip-top-actions">
            <nav className="trip-nav" aria-label="주요 메뉴">
              <a href="#schedule" onClick={(event) => { event.preventDefault(); goToPage("map"); }}>지도</a>
              <a href="#checklist" onClick={(event) => { event.preventDefault(); goToPage("schedule"); }}>일정</a>
              <a href="#safety" onClick={(event) => { event.preventDefault(); goToPage("safety"); }}>안전</a>
              <a href="#photo-album" onClick={(event) => { event.preventDefault(); goToPage("photo"); }}>사진첩</a>
              <a href="#stamp-passport" onClick={(event) => { event.preventDefault(); goToPage("passport"); }}>스탬프</a>
              <a href="#submit-record" onClick={(event) => { event.preventDefault(); goToPage("record"); }}>기록</a>
              <a href="#games" onClick={(event) => { event.preventDefault(); goToPage("games"); }}>게임</a>
            </nav>
            <a
              className="hero-safety-button"
              href="#safety"
              onClick={(event) => { event.preventDefault(); goToPage("safety"); }}
            >
              <span>✦</span>
              안전교육 바로가기
              <span>✧</span>
            </a>
            <div className="hero-ranking-ticker" aria-live="polite">
              <span>방탈출 랭킹 TOP10</span>
              {currentHeroRanking ? (
                <strong>
                  {currentHeroRankingRank}위 {currentHeroRanking.name} · {currentHeroRanking.score}점
                </strong>
              ) : (
                <strong>첫 기록을 기다리는 중</strong>
              )}
              <small>
                {currentHeroRanking
                  ? `${currentHeroRanking.place} · ${currentHeroRanking.elapsedSeconds}초`
                  : "방탈출 미션을 완료하면 3초 간격으로 순위가 표시됩니다."}
              </small>
            </div>
          </div>
        </div>

        <div className="team-switcher hero-team-switcher" aria-label="수학여행 팀 선택">
          <div className="team-switcher-copy">
            <span>MY TRIP TEAM</span>
            <strong>나의 팀을 선택해 주세요</strong>
            <small>선택한 팀의 일정·지도·메모가 이 기기에 저장됩니다.</small>
          </div>
          <div className="team-tabs" role="tablist" aria-label="A, B, C팀 선택">
            {tripTeamOrder.map((team) => {
              const teamInfo = tripTeamMeta[team];
              return (
                <button
                  key={team}
                  type="button"
                  role="tab"
                  aria-selected={activeTeam === team}
                  className={activeTeam === team ? "active" : ""}
                  onClick={() => switchTeam(team)}
                >
                  <strong>{team}팀</strong>
                  <span>{teamInfo.classes}</span>
                  <small>{teamInfo.total}명</small>
                </button>
              );
            })}
          </div>
          <p>
            <b>{activeTeam}팀 선택</b>
            {activeTeamInfo.classes} · 학생 {activeTeamInfo.students}명 + 교사 {activeTeamInfo.teachers}명
          </p>
        </div>

        <div className="trip-hero-content">
          <div className="hero-title-block">
            <p className="trip-kicker">SINCHEON HIGH SCHOOL</p>
            <h1>
              <span>부산 수학여행 스탬프 투어</span>
            </h1>
            <button className="preflight-guide-button" type="button" onClick={() => openOverlay("guide")}>
              <span className="sparkle-icon">✦</span>
              수학여행 가이드
              <span className="sparkle-icon small">✧</span>
            </button>
          </div>
          <aside className="passport-summary" aria-label="스탬프 진행 상황">
            <span>나의 여권</span>
            <strong>
              {completed.length}/{missions.length}
            </strong>
            <small>
              {rank} · 스탬프 {score} XP · 방탈출 {myEscapeScore}점
            </small>
            <div className="passport-progress">
              <span style={{ width: `${(completed.length / missions.length) * 100}%` }} />
            </div>
          </aside>
        </div>
        {renderPagePager("home", "dark")}
      </section>

      <section className="trip-dashboard" id="schedule">
        <div className="map-panel">
          <div className="section-title">
            <span>{getAppPageNumber("map")}</span>
            <div>
              <h2>수학여행 지도</h2>
              <p>{activeTeam}팀의 일차를 고르시면 이동 경로와 체크 상태가 지도에 표시됩니다.</p>
            </div>
          </div>

          <div className="day-tabs" role="tablist" aria-label="일차 선택">
            {tripDays.map((day) => (
              <button
                key={day.id}
                className={activeDay === day.id ? "active" : ""}
                onClick={() => switchDay(day.id)}
              >
                <strong>{day.label}</strong>
                <span>{day.date}</span>
              </button>
            ))}
          </div>

          <div className="team-route-overview" aria-live="polite">
            <div>
              <span>{activeTeam}팀 · {currentDay.label}</span>
              <strong>전용 이동 순서</strong>
              <small>팀을 바꾸면 지도 선과 장소 번호가 해당 팀 동선으로 다시 표시됩니다.</small>
            </div>
            <ol>
              {currentRouteEvents.map((event, index) => (
                <li key={`${activeTeam}-${event.id}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{event.time} · {event.place}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="map-workspace">
            <div className="trip-map" ref={mapNodeRef} aria-label="부산 수학여행 Leaflet 지도" />
            <aside className="route-board">
              <span>{activeTeam}팀 전용 · {currentDay.date}</span>
              <strong>{currentDay.theme}</strong>
              <p>
                체크 {dayCheckedCount}/{currentScheduleEvents.length} · 지도 장소{" "}
                {currentRouteEvents.length}곳
              </p>
              <button className="map-expand-button" type="button" onClick={() => openOverlay("map")}>
                지도 크게 보기
              </button>
              <div className="route-list">
                {currentRouteEvents.map((event, index) => (
                  <button
                    key={event.id}
                    className={focusedEventId === event.id ? "active" : ""}
                    onClick={() => focusEvent(event)}
                  >
                    <span>{index + 1}</span>
                    <strong>{event.place}</strong>
                    <small>
                      {event.time} · {checkedEvents.includes(event.id) ? "체크 완료" : event.subject}
                    </small>
                  </button>
                ))}
              </div>
            </aside>
          </div>
          {renderPagePager("map")}
        </div>

        <div className="day-panel" id="checklist">
          <div className="section-title">
            <span>{getAppPageNumber("schedule")}</span>
            <div>
              <h2>일정 체크리스트</h2>
              <p>도착했거나 끝난 일정을 체크하시면 지도 마커도 완료 상태로 바뀝니다.</p>
            </div>
          </div>

          <div className="day-tabs checklist-tabs" role="tablist" aria-label="체크리스트 일차 선택">
            {tripDays.map((day) => (
              <button
                key={day.id}
                className={activeDay === day.id ? "active" : ""}
                onClick={() => switchDay(day.id)}
              >
                <strong>{day.label}</strong>
                <span>{day.date}</span>
              </button>
            ))}
          </div>

          <div className="day-theme">
            <span>{activeTeam}팀 · {currentDay.date}</span>
            <strong>{currentDay.theme}</strong>
          </div>

          <ol className="timeline">
            {currentScheduleEvents.map((event) => {
              const isChecked = checkedEvents.includes(event.id);
              const isManual = event.id.startsWith("manual-");
              const isEditing = editingEventId === event.id;
              return (
                <li
                  key={event.id}
                  className={isChecked ? "checked" : ""}
                  onClick={() => focusEvent(event)}
                >
                  <label
                    className="schedule-check"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleEvent(event.id)}
                      aria-label={`${event.title} 체크`}
                    />
                    <span />
                  </label>
                  <time>{event.time}</time>
                  <div>
                    <span>{event.subject}</span>
                    <h3>{event.title}</h3>
                    <p>
                      {event.place} · {event.detail}
                    </p>
                  </div>
                  <div className="timeline-actions">
                    {event.move ? <em>이동</em> : null}
                    {!isManual ? (
                      <button
                        className="manual-event-remove schedule-edit-toggle"
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setEditingEventId(isEditing ? null : event.id);
                        }}
                      >
                        {isEditing ? "닫기" : "수정"}
                      </button>
                    ) : null}
                    {isManual ? (
                      <button
                        className="manual-event-remove"
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          removeManualScheduleEvent(event.id);
                        }}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <div className="schedule-edit-panel" onClick={(clickEvent) => clickEvent.stopPropagation()}>
                      <div>
                        <span>기본 일정 수정</span>
                        <strong>현장 변경이 있으면 시간과 내용을 바로 고쳐 둘 수 있습니다.</strong>
                      </div>
                      <div className="manual-schedule-grid">
                        <input
                          value={event.time}
                          onChange={(inputEvent) =>
                            updateScheduleEdit(event.id, { time: inputEvent.target.value })
                          }
                          placeholder="시간"
                          aria-label={`${event.title} 시간 수정`}
                        />
                        <input
                          value={event.title}
                          onChange={(inputEvent) =>
                            updateScheduleEdit(event.id, { title: inputEvent.target.value })
                          }
                          placeholder="일정 제목"
                          aria-label={`${event.title} 제목 수정`}
                        />
                        <input
                          value={event.place}
                          onChange={(inputEvent) =>
                            updateScheduleEdit(event.id, { place: inputEvent.target.value })
                          }
                          placeholder="장소"
                          aria-label={`${event.title} 장소 수정`}
                        />
                        <input
                          value={event.detail}
                          onChange={(inputEvent) =>
                            updateScheduleEdit(event.id, { detail: inputEvent.target.value })
                          }
                          placeholder="세부 내용"
                          aria-label={`${event.title} 내용 수정`}
                        />
                      </div>
                      <button type="button" onClick={() => resetScheduleEdit(event.id)}>
                        원래 일정으로 되돌리기
                      </button>
                    </div>
                  ) : null}
                  {selectedEvent?.id === event.id ? renderMemoryPanel() : null}
                </li>
              );
            })}
          </ol>

          <div className="manual-schedule-box">
            <div>
              <span>수동 일정 추가</span>
              <strong>기본 일정 아래에 현장에서 바뀐 일정이나 새 활동을 적어두세요.</strong>
            </div>
            <div className="manual-schedule-grid">
              <input
                value={manualScheduleDraft.time}
                onChange={(event) =>
                  setManualScheduleDraft((prev) => ({ ...prev, time: event.target.value }))
                }
                placeholder="시간: 예 20:30"
                aria-label="추가 일정 시간"
              />
              <input
                value={manualScheduleDraft.title}
                onChange={(event) =>
                  setManualScheduleDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="일정 제목"
                aria-label="추가 일정 제목"
              />
              <input
                value={manualScheduleDraft.place}
                onChange={(event) =>
                  setManualScheduleDraft((prev) => ({ ...prev, place: event.target.value }))
                }
                placeholder="장소"
                aria-label="추가 일정 장소"
              />
              <input
                value={manualScheduleDraft.detail}
                onChange={(event) =>
                  setManualScheduleDraft((prev) => ({ ...prev, detail: event.target.value }))
                }
                placeholder="기억할 내용"
                aria-label="추가 일정 내용"
              />
            </div>
            <button type="button" onClick={addManualScheduleEvent}>
              추가 일정 저장
            </button>
          </div>

          {renderPagePager("schedule")}
        </div>

        <div className="mission-console" id="missions">
          <div className="section-title compact">
            <span>{getAppPageNumber("missions")}</span>
            <div>
              <h2>장소 미션</h2>
              <p>퀴즈를 맞히시거나 현장 코드를 입력하시면 스탬프와 일정 체크가 함께 기록됩니다.</p>
            </div>
          </div>

          <div className="study-carousel">
            <div className="study-slide">
              <span>{currentLearningSlide.subject}</span>
              <h3>{currentLearningSlide.title}</h3>
              <p>{currentLearningSlide.body}</p>
              <a
                href={currentLearningSlide.href}
                target="_blank"
                rel="noreferrer"
                onClick={currentLearningSlide.videoReward ? startVideoLearning : undefined}
              >
                {currentLearningSlide.mediaLabel} 보기
              </a>
              {renderVideoLearningReward()}
            </div>
            <div className="study-controls" aria-label="학습 캐러셀">
              <button
                type="button"
                onClick={() =>
                  setLearningIndex((prev) => (prev - 1 + learningCards.length) % learningCards.length)
                }
              >
                이전
              </button>
              <span>
                {learningIndex + 1}/{learningCards.length}
              </span>
              <button
                type="button"
                onClick={() => setLearningIndex((prev) => (prev + 1) % learningCards.length)}
              >
                다음
              </button>
            </div>
          </div>

          <div className="mission-pills">
            {dayMissions.map((mission) => (
              <button
                key={mission.id}
                className={activeMission.id === mission.id ? "active" : ""}
                onClick={() => {
                  setActiveMission(mission);
                  setFocusedEventId(getScheduleEventForMission(mission)?.id ?? null);
                  setAnswerState("idle");
                }}
              >
                <span>{completed.includes(mission.id) ? "완료" : mission.subject}</span>
                {mission.place}
              </button>
            ))}
          </div>

          <article className="mission-card">
            <div className="mission-card-head">
              <span>{activeMission.stamp}</span>
              <strong>{activeMission.title}</strong>
            </div>
            <button className="escape-open" type="button" onClick={() => openOverlay("mission")}>
              스토리 방탈출 시작하기
            </button>
            <p>{activeMission.prompt}</p>
            <div className="answer-grid">
              {activeMission.options.map((option, index) => (
                <button key={option} onClick={() => chooseAnswer(index)}>
                  {index + 1}. {option}
                </button>
              ))}
            </div>
            <div className={`answer-message ${answerState}`}>
              {answerState === "correct"
                ? `스탬프를 획득하셨습니다. ${activeMission.reward} XP가 추가되고 일정도 체크되었습니다.`
                : answerState === "wrong"
                  ? "조금만 더 관찰해 보세요. 장소 힌트와 질문을 다시 읽어보시면 좋겠습니다."
                  : "정답을 고르시면 여권과 지도 체크가 자동으로 기록됩니다."}
            </div>
            {activeMission.explanation ? (
              <p className="mission-explanation">{activeMission.explanation}</p>
            ) : null}
            {activeMission.resources?.length ? (
              <div className="mission-resources">
                {activeMission.resources.map((resource) => (
                  <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer">
                    {resource.label}
                  </a>
                ))}
              </div>
            ) : null}
          </article>

          <div className="code-box">
            <label htmlFor="stamp-code">현장 스탬프 코드</label>
            <p>
              코드는 학생이 직접 만드는 것이 아니라 현장에서 담임 또는 인솔 선생님이 안내하는 방문 확인 코드입니다.
            </p>
            <div>
              <input
                id="stamp-code"
                value={stampCode}
                onChange={(event) => setStampCode(event.target.value)}
                placeholder="예: 도시재생"
              />
              <button onClick={submitCode}>찍기</button>
            </div>
          </div>
          {renderPagePager("missions")}
        </div>
      </section>

      <section className="photo-album-section" id="photo-album">
        <div className="section-title">
          <span>{getAppPageNumber("photo")}</span>
          <div>
            <h2>폴라로이드 사진첩</h2>
            <p>선택한 일정의 사진을 업로드하고 미니, 스퀘어, 와이드 규격으로 저장합니다.</p>
          </div>
        </div>

        {selectedEvent ? (
          <>
            <div className="album-current-event">
              <div>
                <span>{currentDay.label} · {currentDay.date}</span>
                <strong>{selectedEvent.time} {selectedEvent.title}</strong>
                <p>{selectedEvent.place}</p>
              </div>
              <a href="https://gemini.google.com/share/247c0eb76828?skid=ee6c7f83-e133-492b-85de-5632d49d5874" target="_blank" rel="noreferrer">
                캐릭터 사진 만들기
              </a>
            </div>

            <div className="album-event-tabs" aria-label="사진첩 일정 선택">
              {albumEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={selectedEvent.id === event.id ? "active" : ""}
                  onClick={() => focusEvent(event)}
                >
                  <span>{event.time}</span>
                  {event.title}
                </button>
              ))}
            </div>

            {selectedEvent.id === freeMemoryEvent.id ? (
              <div className="free-memory-fields">
                <label>
                  <span>자유기록 제목</span>
                  <input
                    value={freeMemoryTitle}
                    onChange={(event) => setFreeMemoryTitle(event.target.value)}
                    placeholder="예: 숙소의 기억"
                  />
                </label>
                <label>
                  <span>장소</span>
                  <input
                    value={freeMemoryPlace}
                    onChange={(event) => setFreeMemoryPlace(event.target.value)}
                    placeholder="예: 숙소/자유 시간"
                  />
                </label>
              </div>
            ) : null}

            <div className="instant-camera-grid photo-album-grid">
              {selectedPhotos.map((photo, index) => (
                <article
                  className={`instant-camera tone-${photo.tone} format-${photo.format ?? "mini"} frame-${photo.frame ?? "classic"} ${
                    photo.showTags === false ? "tags-hidden" : ""
                  }`}
                  key={photo.id}
                >
                  <div className="instant-photo">
                    <img src={photo.src} alt={`${selectedEvent.place} 사진 ${index + 1}`} />
                    <span className="photo-sticker">
                      {photo.icon || "★"} {photo.sticker}
                    </span>
                  </div>
                  <input
                    className="photo-caption"
                    value={photo.caption}
                    onChange={(event) => updateMemoryPhoto(photo.id, { caption: event.target.value })}
                    placeholder="사진 메모 또는 태그: 야경 친구 추억"
                    aria-label="사진 캡션"
                  />
                  {photo.showTags !== false ? (
                    <div className="photo-tag-preview" aria-label="자동 생성된 사진 태그">
                      {makePhotoTags(photo.caption, selectedEvent.place).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="decorate-tools album-decorate-tools">
                    <select
                      value={photo.format ?? "mini"}
                      onChange={(event) =>
                        updateMemoryPhoto(photo.id, { format: event.target.value as PhotoFormat })
                      }
                      aria-label="사진 규격 선택"
                    >
                      {photoFormats.map((format) => (
                        <option key={format.value} value={format.value}>{format.label}</option>
                      ))}
                    </select>
                    <select
                      value={photo.frame ?? "classic"}
                      onChange={(event) =>
                        updateMemoryPhoto(photo.id, { frame: event.target.value as PhotoFrame })
                      }
                      aria-label="사진 프레임 선택"
                    >
                      {photoFrameOptions.map((frame) => (
                        <option key={frame.value} value={frame.value}>{frame.label}</option>
                      ))}
                    </select>
                    <select
                      value={photo.sticker}
                      onChange={(event) => updateMemoryPhoto(photo.id, { sticker: event.target.value })}
                      aria-label="스티커 선택"
                    >
                      {photoStickers.map((sticker) => (
                        <option key={sticker} value={sticker}>{sticker}</option>
                      ))}
                    </select>
                    <select
                      value={photo.icon || "★"}
                      onChange={(event) => updateMemoryPhoto(photo.id, { icon: event.target.value })}
                      aria-label="아이콘 선택"
                    >
                      {photoIcons.map((icon) => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                    <select
                      value={photo.tone}
                      onChange={(event) => updateMemoryPhoto(photo.id, { tone: event.target.value })}
                      aria-label="사진 톤 선택"
                    >
                      {photoToneOptions.map((tone) => (
                        <option key={tone.value} value={tone.value}>{tone.label}</option>
                      ))}
                    </select>
                    <label className="photo-tag-toggle">
                      <input
                        type="checkbox"
                        checked={photo.showTags !== false}
                        onChange={(event) => updateMemoryPhoto(photo.id, { showTags: event.target.checked })}
                      />
                      <span>해시태그 표시</span>
                    </label>
                    <label className="photo-tag-toggle">
                      <input
                        type="checkbox"
                        checked={photo.showCredit !== false}
                        onChange={(event) => updateMemoryPhoto(photo.id, { showCredit: event.target.checked })}
                      />
                      <span>SCH 표시</span>
                    </label>
                  </div>
                  <div className="photo-export-tools">
                    <button type="button" onClick={() => setPreviewPhoto({ photo, index })}>
                      미리보기
                    </button>
                    <button type="button" onClick={() => downloadMemoryPhoto(photo, index)}>
                      저장
                    </button>
                    <button type="button" onClick={() => removeMemoryPhoto(photo.id)}>삭제</button>
                  </div>
                </article>
              ))}

              {selectedPhotos.length < maxMemoryPhotos ? (
                <label className="instant-uploader album-uploader">
                  <strong>+</strong>
                  <span>사진 추가</span>
                  <small>선택한 일정에 최대 5장</small>
                  <input type="file" accept="image/*" multiple onChange={handleMemoryPhoto} />
                </label>
              ) : null}
            </div>

            <p className="memory-help">
              사진은 이 기기의 브라우저에 저장됩니다. 마음에 드는 사진은 미리보기 후 이미지로 저장해 주세요.
            </p>
            {memoryMessage ? <p className="memory-message">{memoryMessage}</p> : null}
          </>
        ) : null}
        {renderPagePager("photo")}
      </section>

      <section className="passport-section" id="stamp-passport">
        <div className="section-title">
          <span>{getAppPageNumber("passport")}</span>
          <div>
            <h2>스탬프 여권</h2>
            <p>각 장소를 누르시면 지도와 관련 미션으로 바로 이동합니다.</p>
          </div>
        </div>
        <div className="stamp-tour-guide" aria-label="스탬프 투어 이용 방법">
          <article>
            <span>1</span>
            <strong>지도에서 장소 확인</strong>
            <p>현재 일차의 동선과 방문 장소를 먼저 확인합니다.</p>
          </article>
          <article>
            <span>2</span>
            <strong>일정 체크와 기록</strong>
            <p>도착한 시간대에 체크하고 메모와 사진을 남깁니다.</p>
          </article>
          <article>
            <span>3</span>
            <strong>방탈출 미션 완료</strong>
            <p>학습 후 퀴즈를 풀면 스탬프와 랭킹 점수가 기록됩니다.</p>
          </article>
          <article>
            <span>4</span>
            <strong>현장 코드 인증</strong>
            <p>담임 또는 인솔 선생님이 안내한 코드를 입력하면 장소 방문 스탬프가 기록됩니다.</p>
          </article>
        </div>
        <div className="stamp-grid">
          {missions.map((mission) => {
            const isDone = completed.includes(mission.id);
            return (
              <button
                key={mission.id}
                className={isDone ? "stamp done" : "stamp"}
                onClick={() => {
                  setActiveDay(getScheduleDayForMission(mission)?.id ?? mission.day);
                  setActiveMission(mission);
                  setFocusedEventId(getScheduleEventForMission(mission)?.id ?? null);
                  setAnswerState("idle");
                  goToPage("missions");
                }}
              >
                <span>{mission.stamp}</span>
                <strong>{mission.place}</strong>
                <small>{isDone ? "스탬프 완료" : `${mission.reward} XP`}</small>
              </button>
            );
          })}
        </div>
        {renderPagePager("passport")}
      </section>

      <section className="learning-section" id="learning">
        <div className="section-title">
          <span>{getAppPageNumber("learning")}</span>
          <div>
            <h2>장소별 학습 포인트</h2>
            <p>교과 활동지의 질문으로 바로 옮겨갈 수 있는 짧은 생각거리입니다.</p>
          </div>
        </div>
        <div className="learning-grid">
          {learningCards.map((card) => (
            <article key={card.title}>
              <span>{card.subject}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a href={card.href} target="_blank" rel="noreferrer">
                자료 보기
              </a>
            </article>
          ))}
        </div>
        {renderPagePager("learning")}
      </section>

      <section className="submit-section" id="submit-record">
        <div className="section-title">
          <span>{getAppPageNumber("record")}</span>
          <div>
            <h2>수학여행 기록 제출</h2>
            <p>학생 정보, 퀴즈 답변, 스탬프 투어 기록, 소감문을 Google Sheets 백엔드로 보냅니다.</p>
          </div>
        </div>

        <div className="submit-grid">
          <div className="student-form">
            <label>
              <span>학번</span>
              <input
                value={studentProfile.studentNo}
                onChange={(event) =>
                  setStudentProfile((prev) => ({
                    ...prev,
                    studentNo: event.target.value,
                  }))
                }
                placeholder="예: 20101"
              />
            </label>
            <label>
              <span>이름</span>
              <input
                value={studentProfile.name}
                onChange={(event) =>
                  setStudentProfile((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="이름"
              />
            </label>
            <label>
              <span>학교메일</span>
              <input
                type="email"
                value={studentProfile.email ?? ""}
                onChange={(event) =>
                  setStudentProfile((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="2026학번@sch.hs.kr"
              />
            </label>
          </div>

          <div className="record-summary">
            <article>
              <span>스탬프</span>
              <strong>
                {completed.length}/{missions.length}
              </strong>
            </article>
            <article>
              <span>일정 체크</span>
              <strong>{checkedEvents.length}</strong>
            </article>
            <article>
              <span>방탈출 점수</span>
              <strong>{myEscapeScore}</strong>
            </article>
          </div>
        </div>

        <div className="score-submit-panel">
          <div>
            <strong>점수 별도 전송</strong>
            <p>스탬프 여권 점수와 방탈출 점수를 각각 따로 Google Sheet에 기록할 수 있습니다.</p>
          </div>
          <div>
            <button type="button" onClick={() => void submitScoreRecord("stamp")} disabled={scoreSubmitStatus === "saving"}>
              스탬프 점수 전송
            </button>
            <button type="button" onClick={() => void submitScoreRecord("escape")} disabled={scoreSubmitStatus === "saving"}>
              방탈출 점수 전송
            </button>
          </div>
          <span className={`submit-status ${scoreSubmitStatus}`}>
            {scoreSubmitMessage || "점수만 먼저 제출해야 할 때 사용하세요."}
          </span>
        </div>

        <label className="reflection-box">
          <span>수학여행 소감문</span>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={7}
            placeholder="가장 기억에 남은 장소, 새롭게 알게 된 점, 다음 여행에서 지키고 싶은 약속을 적어 보세요."
          />
        </label>

        <div className="photo-submit-box">
          <div className="photo-submit-head">
            <div>
              <span>사진자료 제출</span>
              <strong>Google Drive 제출용 사진</strong>
              <p>학번과 이름 정보를 기준으로 Apps Script가 Drive 폴더에 정리할 수 있게 전송합니다.</p>
            </div>
            <label className="photo-submit-upload">
              사진 선택
              <input type="file" accept="image/*" multiple onChange={handleSubmittedPhotos} />
            </label>
          </div>

          {submittedPhotos.length > 0 ? (
            <div className="submitted-photo-list">
              {submittedPhotos.map((photo) => (
                <article key={photo.id}>
                  <img src={photo.dataUrl} alt={photo.name} />
                  <div>
                    <strong>{photo.name}</strong>
                    <span>{Math.ceil(photo.size / 1024)} KB</span>
                  </div>
                  <button type="button" onClick={() => removeSubmittedPhoto(photo.id)}>
                    삭제
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="photo-submit-empty">아직 제출할 사진자료가 없습니다.</p>
          )}

          <label className="portrait-consent">
            <input
              type="checkbox"
              checked={portraitConsent}
              onChange={(event) => setPortraitConsent(event.target.checked)}
            />
            <span>
              제출하는 사진에 본인 또는 친구의 얼굴이 포함된 경우, 초상권 및 사진 제출 동의를 확인했습니다.
            </span>
          </label>
        </div>

        <div className="backend-note">
          <strong>데이터 저장 위치</strong>
          <p>
            제출 전에는 학생 기기의 브라우저에 임시 저장됩니다. 학생이 기록 제출을 누르면 Vercel의{" "}
            <code>/api/trip-submit</code>으로 전송되고, 이 API가 <code>TRIP_GOOGLE_SCRIPT_URL</code>
            로 설정된 Google Apps Script 웹앱에 전달하여 Google Sheet와 Google Drive 저장을 처리합니다.
          </p>
        </div>

        <div className="submit-actions">
          <button onClick={submitTripRecord} disabled={submitStatus === "saving"}>
            {submitStatus === "saving" ? "제출 중" : "기록 제출"}
          </button>
          <button type="button" className="secondary-action" onClick={sendRecordEmail}>
            내 기록 메일로 받기
          </button>
          <span className={`submit-status ${submitStatus}`}>{submitMessage || "아직 제출하지 않았습니다."}</span>
        </div>

        {renderPagePager("record")}

        <section className="safety-section submit-safety-section" id="safety">
          <div className="section-title">
            <span>안전</span>
            <div>
              <h2>안전교육 확인</h2>
              <p>안전한 수학여행을 위해 출발 전 반드시 확인하는 현장 안전수칙입니다.</p>
            </div>
          </div>

          <div className="safety-tabs" role="tablist" aria-label="안전교육 분야 선택">
            {safetyCards.map((card, index) => (
              <button
                key={card.title}
                type="button"
                role="tab"
                aria-selected={safetyIndex === index}
                className={safetyIndex === index ? "active" : ""}
                onClick={() => setSafetyIndex(index)}
              >
                <span>{card.category}</span>
                {card.title}
              </button>
            ))}
          </div>

          <div className="safety-carousel" aria-label="안전교육 자료">
            <article className="safety-card" role="tabpanel">
              <span>{currentSafetyCard.category}</span>
              <h3>{currentSafetyCard.title}</h3>
              <p>{currentSafetyCard.summary}</p>
              <ul>
                {currentSafetyCard.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <strong>{currentSafetyCard.action}</strong>
            </article>
          </div>

          <div className="safety-note">
            <strong>현장 약속</strong>
            <p>위험 상황을 보거나 몸이 좋지 않으면 혼자 판단하지 말고 가까운 인솔교사에게 바로 알려 주세요.</p>
          </div>
          {renderPagePager("safety")}
        </section>
      </section>

      <section className="game-hub" id="games">
        <div className="section-title">
          <span>{getAppPageNumber("games")}</span>
          <div>
            <h2>연계 게임 허브</h2>
            <p>수학여행 중 쉬는 시간이나 모둠 활동에 연결할 수 있는 게임입니다.</p>
          </div>
        </div>
        <div className="game-grid">
          {gameLinks.map((game) => {
            const overlay: ActiveOverlay =
              game.href === "#ladder-game"
                ? "ladder"
                : game.href === "#random-draw"
                  ? "random"
                  : null;

            if (overlay) {
              return (
                <button key={game.title} type="button" onClick={() => openOverlay(overlay)}>
                  <span>POPUP</span>
                  <strong>{game.title}</strong>
                  <p>{game.description}</p>
                </button>
              );
            }

            return (
              <a key={game.title} href={game.href} target="_blank" rel="noreferrer">
                <span>PLAY</span>
                <strong>{game.title}</strong>
                <p>{game.description}</p>
              </a>
            );
          })}
        </div>
        <div className="game-ranking-panel">
          {renderEscapeRankingBoard()}
        </div>
        {renderPagePager("games")}
      </section>

      <section className="draw-section standalone-draw" id="ladder-game">
        <div className="section-title">
          <span>{getAppPageNumber("games")}</span>
          <div>
            <h2>사다리타기 게임</h2>
            <p>이름과 결과를 줄마다 입력하시면 발표 순서나 역할을 재미있게 뽑으실 수 있습니다.</p>
          </div>
        </div>

        <div className="draw-grid">
          <label>
            <span>참가자</span>
            <textarea value={ladderNames} onChange={(event) => handleLadderNamesChange(event.target.value)} rows={6} />
          </label>
          <label>
            <span>결과</span>
            <textarea value={ladderResults} onChange={(event) => handleLadderResultsChange(event.target.value)} rows={6} />
          </label>
        </div>

        <div className="draw-actions">
          <button type="button" className="draw-secondary-button" onClick={() => arrangeLadder()}>
            사다리 배치하기
          </button>
          <button type="button" onClick={runLadder}>추첨 시작</button>
          <span>참가자를 추가하면 세로줄 수가 자동으로 맞춰지고, 배치하기를 누를 때마다 가로줄이 랜덤하게 바뀝니다.</span>
        </div>

        {linesToList(ladderNames).length > 0 ? (
          <>
            {renderLadderAnimation()}
            <div className={`ladder-result ${drawFx ? "is-spinning" : ""}`}>
              {ladderPairs.map((pair, index) => (
                <article key={`${pair.name}-${index}`}>
                  <span>{index + 1}</span>
                  <strong>{pair.name}</strong>
                  <div className="ladder-line" />
                  <em>{pair.result}</em>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="draw-section standalone-draw" id="random-draw">
        <div className="section-title">
          <span>{getAppPageNumber("games")}</span>
          <div>
            <h2>랜덤 뽑기</h2>
            <p>학생 이름, 장소, 미션 주제를 넣고 하나를 빠르게 뽑으실 수 있습니다.</p>
          </div>
        </div>

        <div className="random-draw-box">
          <label>
            <span>뽑기 목록</span>
            <textarea value={randomItems} onChange={(event) => setRandomItems(event.target.value)} rows={6} />
          </label>
          <div className="random-result">
            <span>이번 결과</span>
            <strong>{randomPick || "아직 뽑지 않았습니다"}</strong>
            <button onClick={drawRandomItem}>랜덤 뽑기</button>
            {randomHistory.length > 0 ? (
              <p>최근 결과: {randomHistory.join(" · ")}</p>
            ) : null}
          </div>
        </div>
      </section>
      <footer className="trip-footer" aria-label="저작권 및 방문자 집계">
        <a href="https://sc-h.goesh.kr/" target="_blank" rel="noreferrer">
          Copyright ⓒ 신천고등학교 All right reserved
        </a>
        <div className="footer-visitor-counter" aria-label="방문자 집계">
          <article>
            <span>Today</span>
            <strong>{visitorCounts.source === "loading" ? "-" : visitorCounts.today.toLocaleString("ko-KR")}</strong>
          </article>
          <article>
            <span>Total</span>
            <strong>{visitorCounts.source === "loading" ? "-" : visitorCounts.total.toLocaleString("ko-KR")}</strong>
          </article>
          <small>{visitorCounts.source === "local" ? "이 기기 기준" : "방문자 집계"}</small>
        </div>
      </footer>
      {activeOverlay ? (
        <div className={`trip-modal-backdrop ${drawFx ? "burst" : ""}`} role="presentation">
          <div
            ref={overlayModalRef}
            className={`trip-modal ${
              activeOverlay === "mission"
                ? "escape-modal"
                : activeOverlay === "map"
                  ? "map-modal"
                  : activeOverlay === "guide"
                    ? "guide-modal"
                  : "draw-modal"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label={
              activeOverlay === "mission"
                ? "방탈출 장소 미션"
                : activeOverlay === "map"
                  ? "수학여행 전체 지도"
                  : activeOverlay === "guide"
                    ? "리플렛 실행 전 사용 안내"
                    : activeOverlay === "ladder"
                      ? "사다리타기 추첨"
                      : "랜덤 뽑기 추첨"
            }
          >
            <button
              className="trip-modal-close"
              type="button"
              onClick={() => setActiveOverlay(null)}
              aria-label="팝업 닫기"
            >
              ×
            </button>

            {activeOverlay === "mission" ? (
              <div className="escape-story-shell">
                <header className="escape-story-header">
                  <div className="escape-lock">
                    <span>BUSAN TIME ARCHIVE</span>
                    <strong>{activeTeam}팀 · {activeEscapeChapter.day + 1}일차</strong>
                  </div>
                  <label className="escape-sound-toggle">
                    <input
                      type="checkbox"
                      checked={escapeSoundOn}
                      onChange={(event) => setEscapeSoundOn(event.target.checked)}
                    />
                    <span aria-hidden="true" />
                    <b>효과음</b>
                  </label>
                </header>

                <div className="escape-chapter-tabs" role="tablist" aria-label="방탈출 챕터 선택">
                  {escapeChapters.map((chapter) => {
                    const isActive = chapter.day === activeEscapeChapter.day;
                    const isComplete = completedEscapeChapterIds.has(chapter.id);
                    return (
                      <button
                        key={chapter.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={isActive ? "active" : ""}
                        disabled={missionStudyDone && escapeStage !== "result" && !isActive}
                        onClick={() => selectEscapeChapter(chapter.day)}
                      >
                        <span>{isComplete ? "완료" : `CHAPTER ${chapter.day + 1}`}</span>
                        <strong>{chapter.day + 1}일차</strong>
                      </button>
                    );
                  })}
                </div>

                {missionStudyDone ? (
                  <div
                    className="escape-progress-track"
                    aria-label="방탈출 문제 진행 단계"
                    style={{ gridTemplateColumns: `repeat(${escapeAttemptChallenges.length + 1}, minmax(24px, 1fr))` }}
                  >
                    {escapeAttemptChallenges.map((challenge, index) => (
                      <span
                        key={challenge.id}
                        className={
                          escapeSolvedIds.includes(challenge.id)
                            ? "done"
                            : escapeStage === "challenge" && index === escapeChallengeIndex
                              ? "active"
                              : ""
                        }
                      >
                        {index + 1}
                      </span>
                    ))}
                    <span className={escapeStage === "final" ? "active" : escapeStage === "result" ? "done" : ""}>
                      KEY
                    </span>
                  </div>
                ) : null}

                {escapeStage === "briefing" ? (
                  <div className="escape-briefing-layout">
                    <section className="escape-briefing-copy">
                      <span className="escape-eyebrow">부산 시간기록국 · 프롤로그</span>
                      <h2>{activeEscapeChapter.title}</h2>
                      <p className="escape-place">{activeEscapeChapter.subtitle}</p>
                      <p className="escape-story-text">{activeEscapeChapter.briefing}</p>
                      <div className="escape-objective">
                        <span>오늘의 임무</span>
                        <strong>{activeEscapeChapter.objective}</strong>
                      </div>
                      <ol className="escape-route-preview">
                        {activeEscapeChapter.challenges.map((challenge, index) => (
                          <li key={challenge.id}>
                            <span>{index + 1}</span>
                            <div>
                              <strong>{challenge.title}</strong>
                              <small>{challenge.item.label} 회수</small>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>

                    <section className="escape-study-panel">
                      <div className="study-slide modal-study-slide">
                        <span>{currentLearningSlide.subject}</span>
                        <h3>{currentLearningSlide.title}</h3>
                        <p>{currentLearningSlide.body}</p>
                        <a
                          href={currentLearningSlide.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={currentLearningSlide.videoReward ? startVideoLearning : undefined}
                        >
                          {currentLearningSlide.mediaLabel} 보기
                        </a>
                        {renderVideoLearningReward()}
                      </div>
                      <div className="study-controls" aria-label="방탈출 전 학습 캐러셀">
                        <button
                          type="button"
                          onClick={() =>
                            setLearningIndex((prev) => (prev - 1 + learningCards.length) % learningCards.length)
                          }
                        >
                          이전
                        </button>
                        <span>{learningIndex + 1}/{learningCards.length}</span>
                        <button
                          type="button"
                          onClick={() => setLearningIndex((prev) => (prev + 1) % learningCards.length)}
                        >
                          다음
                        </button>
                      </div>
                      <div className="escape-profile-entry">
                        <label>
                          <span>학번</span>
                          <input
                            value={studentProfile.studentNo}
                            onChange={(event) => setStudentProfile((prev) => ({ ...prev, studentNo: event.target.value }))}
                            placeholder="예: 20101"
                            inputMode="numeric"
                          />
                        </label>
                        <label>
                          <span>이름</span>
                          <input
                            value={studentProfile.name}
                            onChange={(event) => setStudentProfile((prev) => ({ ...prev, name: event.target.value }))}
                            placeholder="이름"
                          />
                        </label>
                        <small>한 번 입력하면 이 기기에 저장되고 다음 챕터에도 사용됩니다.</small>
                      </div>
                      {escapeFeedback ? <p className="escape-feedback wrong">{escapeFeedback}</p> : null}
                      <button className="escape-start" type="button" onClick={startEscapeMission}>
                        타이머 시작 · 무작위 10문제 도전
                      </button>
                      <p className="escape-score-rule">
                        챕터를 시작할 때마다 전체 150문항 중 서로 다른 문제군 10문항이 무작위 출제됩니다. 기본 1,000점에 영상 학습·시간·힌트·정확도·관찰·복불복 점수가 반영됩니다.
                      </p>
                    </section>
                  </div>
                ) : null}

                {escapeStage === "challenge" ? (
                  <div className="escape-game-layout">
                    <section className="escape-puzzle-panel">
                      <div className="escape-timer-bar">
                        <span>기록 복구 타이머</span>
                        <strong>{currentEscapeSeconds}초 · 문제 {escapeChallengeIndex + 1}/{escapeAttemptChallenges.length}</strong>
                      </div>
                      <p className="escape-scene">{currentEscapeChallenge.scene}</p>
                      <div className="escape-puzzle-title">
                        <span>{currentEscapeChallenge.typeLabel} · LOCK {escapeChallengeIndex + 1}</span>
                        <h2>{currentEscapeChallenge.title}</h2>
                      </div>
                      <p className="escape-question">{currentEscapeChallenge.prompt}</p>
                      {currentEscapeChallenge.kind === "choice" ? (
                        <div className="escape-answer-grid">
                          {currentEscapeChallenge.options?.map((option, index) => (
                            <button
                              key={option}
                              type="button"
                              disabled={escapeSolvedIds.includes(currentEscapeChallenge.id)}
                              onClick={() => chooseEscapeAnswer(index)}
                            >
                              <span>{index + 1}</span>
                              {option}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="escape-short-answer">
                          <label>
                            <span>단답 입력</span>
                            <input
                              value={escapeShortAnswer}
                              onChange={(event) => setEscapeShortAnswer(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") submitEscapeShortAnswer();
                              }}
                              disabled={escapeSolvedIds.includes(currentEscapeChallenge.id)}
                              placeholder="정답을 입력하세요"
                              autoComplete="off"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={escapeSolvedIds.includes(currentEscapeChallenge.id)}
                            onClick={submitEscapeShortAnswer}
                          >
                            정답 확인
                          </button>
                        </div>
                      )}
                      <div className="escape-puzzle-actions">
                        <button
                          className="escape-hint-button"
                          type="button"
                          disabled={escapeHintIds.includes(currentEscapeChallenge.id)}
                          onClick={revealEscapeHint}
                        >
                          {escapeHintIds.includes(currentEscapeChallenge.id) ? "힌트 확인됨" : "힌트 열기 · 100점 감점"}
                        </button>
                        <button
                          className="escape-skip-button"
                          type="button"
                          disabled={escapeSolvedIds.includes(currentEscapeChallenge.id)}
                          onClick={skipEscapeQuestion}
                        >
                          모르겠어요 · 정답 보기 (-60점)
                        </button>
                      </div>
                      {escapeHintIds.includes(currentEscapeChallenge.id) ? (
                        <p className="escape-hint">{currentEscapeChallenge.hint}</p>
                      ) : null}
                      {escapeFeedback ? (
                        <p className={`escape-feedback ${answerState}`}>{escapeFeedback}</p>
                      ) : null}
                      {escapeSolvedIds.includes(currentEscapeChallenge.id) ? (
                        <>
                          {currentEscapeChallenge.grantsItem ? (
                            <div className="escape-item-reveal">
                              <span>{currentEscapeChallenge.item.icon}</span>
                              <div>
                                <small>ITEM ACQUIRED</small>
                                <strong>{currentEscapeChallenge.item.label}</strong>
                                <p>암호 조각 {currentEscapeChallenge.item.fragment}</p>
                              </div>
                            </div>
                          ) : null}
                          <p className="escape-learning-note">{currentEscapeChallenge.explanation}</p>
                          {currentEscapeMission?.resources?.length ? (
                            <div className="mission-resources escape-resource-links">
                              {currentEscapeMission.resources.map((resource) => (
                                <a key={resource.href} href={resource.href} target="_blank" rel="noreferrer">
                                  {resource.label}
                                </a>
                              ))}
                            </div>
                          ) : null}
                          <button className="escape-next-clue" type="button" onClick={advanceEscapeChallenge}>
                            {escapeChallengeIndex >= escapeAttemptChallenges.length - 1
                              ? "최종 암호 장치로 이동"
                              : "다음 문제"}
                          </button>
                        </>
                      ) : null}
                    </section>

                    <aside className="escape-inventory" aria-label="획득한 방탈출 아이템">
                      <span>CLUE INVENTORY</span>
                      <strong>{escapeInventory.length}/3 기록 조각</strong>
                      <div>
                        {activeEscapeChapter.challenges.map((challenge) => {
                          const item = escapeInventory.find((entry) => entry.label === challenge.item.label);
                          return (
                            <article key={challenge.id} className={item ? "unlocked" : "locked"}>
                              <span>{item?.icon ?? "?"}</span>
                              <div>
                                <strong>{item?.label ?? "잠긴 기록"}</strong>
                                <small>{item ? `조각 ${item.fragment}` : "문제를 풀면 열립니다"}</small>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      <p>힌트 {escapeHintIds.length}회 · 오답 {escapeWrongCount}회</p>
                    </aside>
                  </div>
                ) : null}

                {escapeStage === "final" ? (
                  <div className="escape-final-layout">
                    <section className="escape-final-lock">
                      <span className="escape-eyebrow">FINAL LOCK</span>
                      <h2>{activeEscapeChapter.title}</h2>
                      <p>{activeEscapeChapter.finalPrompt}</p>
                      <div className="escape-fragments" aria-label="획득한 암호 조각">
                        {escapeInventory.map((item) => (
                          <span key={item.label}>{item.fragment}</span>
                        ))}
                      </div>
                      <label>
                        <span>최종 암호</span>
                        <input
                          value={escapeFinalCode}
                          onChange={(event) => setEscapeFinalCode(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") submitEscapeFinalCode();
                          }}
                          placeholder="암호를 입력하세요"
                          autoComplete="off"
                        />
                      </label>
                      <div className="escape-final-actions">
                        <button type="button" onClick={submitEscapeFinalCode}>여권 잠금 해제</button>
                        <button
                          type="button"
                          className="escape-hint-button"
                          disabled={escapeHintIds.includes(`final-${activeEscapeChapter.id}`)}
                          onClick={revealEscapeFinalHint}
                        >
                          최종 힌트
                        </button>
                      </div>
                      {escapeHintIds.includes(`final-${activeEscapeChapter.id}`) ? (
                        <p className="escape-hint">{activeEscapeChapter.finalHint}</p>
                      ) : null}
                      {escapeFeedback ? <p className={`escape-feedback ${answerState}`}>{escapeFeedback}</p> : null}
                    </section>
                    <aside className="escape-final-status">
                      <span>MISSION STATUS</span>
                      <strong>3개의 기록 복구 완료</strong>
                      <p>{currentEscapeSeconds}초 경과</p>
                      <p>힌트 {escapeHintIds.length}회 · 오답 {escapeWrongCount}회</p>
                      <small>암호가 맞으면 이번 챕터 점수가 즉시 새 기록으로 전송됩니다.</small>
                    </aside>
                  </div>
                ) : null}

                {escapeStage === "result" ? (
                  <div className="escape-result-layout">
                    <section className="escape-result-scene">
                      <span className="escape-result-mark">UNLOCKED</span>
                      <h2>여행 여권 기록 복구 성공</h2>
                      <p>
                        {activeEscapeChapter.day === 2
                          ? "15시 43분 귀환 열차의 잠금이 풀렸습니다. 부산에서 모은 기억이 여행 여권의 마지막 장에 저장되었습니다."
                          : `${activeEscapeChapter.day + 1}일차 기록이 여권에 복원되었습니다. 다음 챕터의 잠금 장치가 활성화되었습니다.`}
                      </p>
                      <div className="escape-score-total">
                        <span>이번 챕터 점수</span>
                        <strong>{lastEarnedScore?.toLocaleString("ko-KR") ?? 0}</strong>
                        <small>{escapeElapsedSeconds}초</small>
                      </div>
                      <p className="escape-score-breakdown">{lastScoreBreakdown}</p>
                      <div className="escape-result-actions">
                        <button type="button" onClick={startEscapeMission}>같은 챕터 다시 도전</button>
                        <button
                          type="button"
                          onClick={() =>
                            activeEscapeChapter.day < 2
                              ? selectEscapeChapter(activeEscapeChapter.day + 1)
                              : setActiveOverlay(null)
                          }
                        >
                          {activeEscapeChapter.day < 2 ? "다음 챕터 준비" : "방탈출 종료"}
                        </button>
                      </div>
                    </section>
                    {renderEscapeRankingBoard("compact")}
                  </div>
                ) : null}

                {earnedItemFx ? (
                  <div className="escape-item-acquired-backdrop" role="presentation">
                    <div
                      className="escape-item-acquired-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label={`${earnedItemFx.label} 획득`}
                    >
                      <div className="escape-item-particles" aria-hidden="true">
                        {Array.from({ length: 12 }, (_, index) => (
                          <span key={index} />
                        ))}
                      </div>
                      <span className="escape-item-acquired-kicker">ITEM ACQUIRED</span>
                      <div className="escape-item-orbit" aria-hidden="true">
                        <span>{earnedItemFx.icon}</span>
                      </div>
                      <h2>{earnedItemFx.label}</h2>
                      <p>{earnedItemFx.detail}</p>
                      <div className="escape-item-code">
                        <span>암호 조각</span>
                        <strong>{earnedItemFx.fragment}</strong>
                      </div>
                      <button type="button" onClick={() => setEarnedItemFx(null)}>
                        인벤토리에 보관
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeOverlay === "guide" ? (
              <>
                <div className="guide-modal-head">
                  <span>START GUIDE</span>
                  <h2>수학여행 가이드</h2>
                  <p>지도, 일정, 스탬프, 기록 제출과 함께 안전교육 확인 방법까지 한 번에 살펴볼 수 있습니다.</p>
                </div>
                <div className="guide-carousel">
                  {renderGuideScreenshot()}
                  <div className="guide-copy">
                    <span>{currentGuideCard.tag}</span>
                    <h3>{currentGuideCard.title}</h3>
                    <p>{currentGuideCard.body}</p>
                    <ol>
                      {currentGuideCard.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="guide-modal-controls" aria-label="수학여행 가이드 캐러셀">
                  <button
                    type="button"
                    onClick={() => setGuideIndex((prev) => (prev - 1 + guideCards.length) % guideCards.length)}
                  >
                    이전
                  </button>
                  <span>
                    {guideIndex + 1}/{guideCards.length}
                  </span>
                  <button type="button" onClick={() => setGuideIndex((prev) => (prev + 1) % guideCards.length)}>
                    다음
                  </button>
                </div>
              </>
            ) : null}

            {activeOverlay === "map" ? (
              <>
                <div className="map-modal-head">
                  <span>{activeTeam}팀 · {currentDay.date}</span>
                  <h2>{activeTeam}팀 수학여행 전체 지도</h2>
                  <p>{currentDay.theme}</p>
                </div>
                <div
                  className="trip-map trip-map-fullscreen"
                  ref={modalMapNodeRef}
                  aria-label="확대된 부산 수학여행 Leaflet 지도"
                />
              </>
            ) : null}

            {activeOverlay === "ladder" ? (
              <>
                <div className="draw-modal-head">
                  <span>ROLE DRAW</span>
                  <h2>사다리타기 추첨</h2>
                  <p>참가자와 결과를 입력하고 바로 역할을 배정해 보세요.</p>
                </div>
                <div className="draw-grid modal-draw-grid">
                  <label>
                    <span>참가자</span>
                    <textarea
                      value={ladderNames}
                      onChange={(event) => handleLadderNamesChange(event.target.value)}
                      rows={6}
                    />
                  </label>
                  <label>
                    <span>결과</span>
                    <textarea
                      value={ladderResults}
                      onChange={(event) => handleLadderResultsChange(event.target.value)}
                      rows={6}
                    />
                  </label>
                </div>
                <div className="draw-main-group">
                  <button className="draw-secondary-button" type="button" onClick={() => arrangeLadder()}>
                    사다리 배치하기
                  </button>
                  <button className="draw-main-button" type="button" onClick={runLadder}>
                    추첨 시작
                  </button>
                </div>
                {linesToList(ladderNames).length > 0 ? (
                  <>
                    {renderLadderAnimation()}
                    <div className={`ladder-result modal-result ${drawFx ? "is-spinning" : ""}`}>
                      {ladderPairs.map((pair, index) => (
                        <article key={`${pair.name}-${index}`}>
                          <span>{index + 1}</span>
                          <strong>{pair.name}</strong>
                          <div className="ladder-line" />
                          <em>{pair.result}</em>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            {activeOverlay === "random" ? (
              <>
                <div className="draw-modal-head">
                  <span>QUICK PICK</span>
                  <h2>랜덤 뽑기</h2>
                  <p>이름, 장소, 발표 순서, 미션 주제를 넣고 하나를 뽑습니다.</p>
                </div>
                <div className="random-draw-box modal-random-box">
                  <label>
                    <span>뽑기 목록</span>
                    <textarea
                      value={randomItems}
                      onChange={(event) => setRandomItems(event.target.value)}
                      rows={7}
                    />
                  </label>
                  <div className={`random-result modal-random-result ${drawFx ? "is-spinning" : ""}`}>
                    <span>이번 결과</span>
                    <strong>{randomPick || "READY"}</strong>
                    <button type="button" onClick={drawRandomItem}>
                      랜덤 뽑기
                    </button>
                    {randomHistory.length > 0 ? (
                      <p>최근 결과: {randomHistory.join(" · ")}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {previewPhoto && selectedEvent ? (
        <div className="trip-modal-backdrop photo-preview-backdrop" role="presentation">
          <div className="trip-modal photo-preview-modal" role="dialog" aria-modal="true" aria-label="폴라로이드 사진 미리보기">
            <button
              className="trip-modal-close"
              type="button"
              onClick={() => setPreviewPhoto(null)}
              aria-label="미리보기 닫기"
            >
              ×
            </button>
            <div className="photo-preview-head">
              <span>
                {photoFormats.find((format) => format.value === (previewPhoto.photo.format ?? "mini"))?.label} ·{" "}
                {photoFrameOptions.find((frame) => frame.value === (previewPhoto.photo.frame ?? "classic"))?.label}
              </span>
              <h2>저장 전 미리보기</h2>
            </div>
            <div className={`photo-preview-card format-${previewPhoto.photo.format ?? "mini"} tone-${previewPhoto.photo.tone} frame-${previewPhoto.photo.frame ?? "classic"}`}>
              <div className="photo-preview-frame">
                <img src={previewPhoto.photo.src} alt={`${selectedEvent.place} 미리보기`} />
                <span>{previewPhoto.photo.icon || "★"} {previewPhoto.photo.sticker}</span>
              </div>
              <strong>{selectedEvent.place}</strong>
              <p>{previewPhoto.photo.caption || selectedMemory.note || "부산에서 건진 오늘의 한 장"}</p>
              {previewPhoto.photo.showTags !== false ? (
                <div className="photo-tag-preview preview-tags">
                  {makePhotoTags(previewPhoto.photo.caption, selectedEvent.place).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
              {previewPhoto.photo.showCredit !== false ? <small>SCH BUSAN STAMP TOUR</small> : null}
            </div>
            <div className="photo-preview-actions">
              <button type="button" onClick={() => setPreviewPhoto(null)}>닫기</button>
              <button
                type="button"
                onClick={() => {
                  void downloadMemoryPhoto(previewPhoto.photo, previewPhoto.index);
                  setPreviewPhoto(null);
                }}
              >
                이대로 저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <button
        className="back-to-top"
        type="button"
        onClick={() => goToPage("home")}
        aria-label="첫 페이지로 이동"
        title="첫 페이지로 이동"
      >
        ⌂
      </button>
    </main>
  );
}

