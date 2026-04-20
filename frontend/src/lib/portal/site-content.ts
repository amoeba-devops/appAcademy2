export const SITE = {
  name: "TRINITY ACADEMY",
  tagline: "NWEA MAP TEST 공식 기관",
  phones: ["064-792-1906", "010-6703-1906"],
  email: "103trinityacademy@gmail.com",
  kakao: "https://pf.kakao.com/_LxdHxexj",
  hours: {
    consultation: "14:00 – 22:00 (사전 예약제)",
    class: "14:30 – 21:30",
  },
} as const;

export const CAMPUS = {
  jeju: {
    name: "제주 본원",
    line1: "제주특별자치도 서귀포시 대정읍",
    line2: "글로벌에듀로 145번길 40, 2층",
    note: "(영어교육도시 내)",
  },
  seoul: {
    name: "압구정 도산공원 센터",
    line1: "서울특별시 강남구 신사동 631-31, 2층",
    note: "(도산공원, 메종에르메스 뒷 건물)",
  },
} as const;

export const HERO = {
  eyebrow: "NWEA MAP TEST 공식 기관",
  title: "TRINITY ACADEMY",
  subtitle: "정확한 진단 · 확실한 합격",
  lead: "2020년 설립 이후 230명 이상의 국제학교 학생을 배출한 검증된 국제학교 입학 준비 기관. MAP TEST를 통한 체계적인 진단부터 목표 국제학교 합격까지 완벽한 로드맵을 제공합니다.",
} as const;

export const RESULTS = {
  eyebrow: "TRUSTED RESULTS",
  title: "트리니티 아카데미의 자신감은\n확실한 결과에서 나옵니다.",
  lead: "트리니티는 2020년 설립 이후 인가 국제학교 7개와 국내 각지의 비인가 국제학교 입학을 희망하는 학생들에게 합격이라는 확실한 결과를 선사했습니다. 검증된 데이터와 노하우로 합격을 선사합니다.",
  stat: {
    value: "144",
    unit: "명",
    label: "국제학교 합격 · 채드윅 · DIS · 비인가 포함",
  },
  schools: [
    { name: "NLCS", region: "JEJU" },
    { name: "SJA", region: "JEJU" },
    { name: "KIS", region: "JEJU" },
    { name: "CHADWICK", region: "INTL" },
  ],
} as const;

export const RESULTS_STATS = {
  eyebrow: "PROVEN TRACK RECORD",
  title: "데이터로 증명하는 트리니티",
  items: [
    { value: "230+", label: "누적 졸업생" },
    { value: "144", label: "국제학교 합격" },
    { value: "99%", label: "합격률" },
    { value: "2020", label: "설립" },
  ],
} as const;

export const CAMPUS_BAND = {
  eyebrow: "DUAL CAMPUS",
  title:
    "제주 영어교육도시 본원 · 압구정 도산공원 센터의 오프라인 입학 준비 수업과\n엄선된 교사진의 온라인 개인 수업",
  lead: "트리니티 아카데미는 제주 영어 교육도시 현지에 위치한 본원을 통하여 입시와 관련된 가장 필수적이고 중요한 정보를 세밀하게 파악하고 있습니다. 트리니티의 노하우는 오프라인·온라인 수업을 통해서 국제학교 입시를 준비하는 학생에게 확실한 결과를 선사합니다.",
} as const;

export const PILLARS_SECTION = {
  eyebrow: "OUR DIFFERENTIATORS",
  title: "합격을 위한 네 가지 축",
} as const;

export const PILLARS = [
  {
    n: "01",
    title: "230명 이상의 합격 사례로 축적된 ‘학교별 맞춤 전략’",
    problem:
      "국제학교 입시는 단순한 영어 테스트가 아니기에, 학교마다 요구하는 평가 기준을 정확히 파악하는 것이 중요합니다.",
    label: "실전 분석 데이터:",
    solution:
      "지난 수년간 230명이 넘는 합격생을 배출하며 쌓아온 학교별(NLCS, SJA, KIS, Chadwick 등) 입학 시험 기출 유형과 각 학교가 선호하는 인재상을 체계적으로 보유하고 있습니다. 지망 학교의 출제 경향을 면밀히 분석하여 합격에 가까운 학습 경로를 제시합니다.",
  },
  {
    n: "02",
    title: "합격률 99%를 뒷받침하는 ‘완벽한 원서 지원 전략’",
    problem:
      "높은 시험 점수만으로는 학생의 잠재력을 충분히 보여주기 어렵습니다. 지원자만의 특징이 선명하게 드러나야 합니다.",
    label: "맞춤형 원서 지원 가이드:",
    solution:
      "트리니티는 99%의 합격률을 유지하기 위해, 학생이 가진 개별 활동과 경험을 학교의 교육 철학에 맞춰 설득력 있는 스토리텔링으로 구현합니다. 인터뷰와 에세이에서 학생의 역량이 돋보일 수 있도록 세밀하게 조율합니다.",
  },
  {
    n: "03",
    title: "합격을 달성하는 ‘상세 진단과 학습 로드맵’",
    problem:
      "막연한 준비가 아닌, 객관적인 지표를 바탕으로 학습 방향을 결정합니다.",
    label: "합격 데이터 기반 분석:",
    solution:
      "누적 230여 건의 합격 사례를 기준으로 현재 학생의 학업 수준을 진단합니다. MAP Test, ISEE 등 영역별 강약점을 수치화하여, 부족한 부분을 우선순위에 따라 보완하는 효율적인 로드맵을 제공합니다.",
  },
  {
    n: "04",
    title: "원서 준비부터 입학 후 적응까지 ‘All in One’ 관리",
    problem:
      "원서 접수 과정의 실수를 방지하고, 합격 이후의 안정적인 학교 생활까지 고려합니다.",
    label: "체계적인 가이드:",
    solution:
      "추천서 준비부터 활동 증빙 서류까지 오차 없는 서류 패키징을 지원합니다. 또한, 입학 후 실제 교과 과정(IB, AP 등)에서 어려움을 겪지 않도록 입학 전 학업 기초를 탄탄하게 다져 실질적인 적응을 돕습니다.",
  },
] as const;

export const PROCESS_SECTION = {
  eyebrow: "ENROLLMENT PROCESS",
  title: "트리니티 아카데미\n입학 준비반 프로세스",
} as const;

export const PROCESS_STEPS = [
  {
    n: "01",
    title: "맞춤형 기초 상담",
    label: "학생 기본 정보 등록 및 학습 성향 파악:",
    body: "학생의 기존 학습 이력과 기본 정보를 바탕으로 1:1 기초 상담을 진행하여 합격을 달성하기 위한 현재 상황을 확인합니다.",
  },
  {
    n: "02",
    title: "객관적 실력 진단",
    label: "공인 지표 기반 레벨테스트:",
    body: "NWEA 공식 MAP Test를 포함하여 체험수업을 통한 Writing·Speaking 자체 평가를 실시합니다. 이를 통해 현재 학생의 학업 성취도를 수치화하여 상세히 안내합니다.",
  },
  {
    n: "03",
    title: "전략적 목표 설정",
    label: "심층 컨설팅 및 학교 매칭:",
    body: "진단 결과를 토대로 학생의 역량이 가장 돋보일 수 있는 목표 학교를 설정하고, 합격을 위한 구체적인 지원 전략을 수립합니다.",
  },
  {
    n: "04",
    title: "맞춤형 학습 유형·스케줄 편성",
    label: "수준별 최적 반 편성:",
    body: "학생의 현재 실력과 목표 시기에 맞춰 그룹 수업·개인 수업 혹은 여름·겨울 특강반 등 가장 효율적인 학습 환경을 배정합니다.",
  },
  {
    n: "05",
    title: "밀착 관리 및 성과 공유",
    label: "정규 커리큘럼 및 피드백 시스템:",
    body: "체계적인 수업 진행과 함께 주기적인 모의고사(NWEA MAP TEST)를 실시합니다. 분석된 성취도 데이터는 학부모 피드백 리포트를 통해 상세히 공유하며 확실한 성장을 돕습니다.",
  },
] as const;

export const CLOSING = {
  eyebrow: "CONTACT US",
  title: "트리니티 아카데미가 확실하게 선사하겠습니다.",
  lead: "트리니티의 정밀한 학업 진단, 열정적인 튜터링, 검증된 노하우로 확실한 국제학교 입학을 보장합니다.",
} as const;

export const ABOUT = {
  hero: {
    eyebrow: "PHILOSOPHY",
    title: "OMNIBUS\nOMNIA",
    verse:
      "내가 모든 사람에게 모든 것이 된 것은, 아무쪼록 몇 사람이라도 구원하고자 함이니.",
    verseRef: "— 고린도전서 9:22",
  },
  story: {
    eyebrow: "OUR STORY",
    title: "연혁",
    timeline: [
      {
        year: "2014",
        heading: "Trinity Academy 개원",
        body: "강남구 대치동, 영어 RC 단일 과목 시작.",
      },
      {
        year: "2017",
        heading: "MAP 진단 체계 도입",
        body: "G2-G5 RC/Math/Language 3 트랙 구축.",
      },
      {
        year: "2020",
        heading: "수학 프로그램 런칭",
        body: "영어-수학 통합 커리큘럼 완성.",
      },
      {
        year: "2026",
        heading: "Trinity 관리 솔루션 v1.3",
        body: "AMA 연동, 자체 결제, 수업일 기준 환불 정책 도입.",
      },
    ],
  },
  principle: {
    eyebrow: "OUR PRINCIPLE",
    title: "한 사람의 성장을 위해",
    paragraphs: [
      "Trinity 는 학생 개개인이 가진 학습 속도·성향·목표를 존중합니다. 같은 학년이라도 같은 커리큘럼을 주지 않습니다. MAP 진단으로 출발점을 명확히 하고, TPI (Trinity Profile Index) 로 성향을 읽어, 각자에게 맞는 경로를 제안합니다.",
      "방패 문양의 중심에는 T자와 십자가, 세 개의 별, 왕관, 페넌트가 놓여 있습니다. 학문·신앙·품격·연대 — 이 네 가치가 Trinity 의 교육 기반입니다.",
    ],
  },
} as const;

export const CONSULTATION_TYPES = [
  { id: "ACCREDITED", label: "인가 국제학교 입학 준비" },
  { id: "UNACCREDITED", label: "비인가 국제학교 입학 준비" },
  { id: "FOREIGN_SCHOOL", label: "외국인학교 입학 준비" },
  { id: "BOARDING", label: "해외 주니어 보딩스쿨 / 하이 보딩스쿨 입학 준비" },
  {
    id: "ALL_IN_ONE",
    label: "All in One 입학 준비 컨설팅",
    sub: "(수업 + 포트폴리오 + 원서 지원 + GPA 관리)",
  },
] as const;

export const FORM_SUCCESS_NOTE =
  "※ 접수 후 영업일 기준 24시간 이내에 전문 컨설턴트가 순차적으로 연락드립니다.";

export const GRADE_OPTIONS = [
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
  "G12",
] as const;
