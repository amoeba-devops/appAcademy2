---
document_id: PORTAL-REQ-TRINITY-1.0.0
title: Trinity Academy Portal Redesign Requirements (trinityacademy.kr 이관)
version: 1.0.0
status: DRAFT
owner: gray.kim@amoeba.group
change_log:
  - date: 2026-04-20
    version: 1.0.0
    change: Initial draft — trinityacademy.kr 라이브 사이트를 (portal) 라우트로 이관하기 위한 요구사항 정의
---

# Portal Redesign Requirements (trinityacademy.kr 이관)

## 1. Objective (목적)

- 현재 운영 중인 **trinityacademy.kr** (Imweb 기반 랜딩) 의 디자인·콘텐츠·IA 를 **Next.js 14 (portal) 라우트 그룹**으로 1:1 이관한다.
- Imweb 템플릿에 "구워진" 이미지 텍스트를 HTML/CSS 타이포그래피로 재구성하여 반응형·SEO·다국어 확장성을 확보한다.
- 기존 `(portal)` 의 Heraldic 랜딩 (OMNIBUS OMNIA, 영어·수학 콘셉트) 은 실제 사이트 포지셔닝 (국제학교 입시 · MAP TEST) 으로 대체한다.

## 2. Scope (범위)

### 2.1 In Scope
| Route | 대상 | 액션 |
|-------|------|------|
| `/` | Home | **전면 교체** — trinityacademy.kr 루트 1:1 이관 |
| `/map-test` | MAP TEST 응시 신청 | **전면 교체** — trinityacademy.kr `/test` 폼 이관 |
| `/contact` | 상담 신청 | **전면 교체** — trinityacademy.kr `/contact` 폼 이관 |
| `(portal)/layout.tsx` | 공통 헤더·푸터 | **전면 교체** — 실제 사이트 헤더 2-링크 + 우측 플로팅 CTA + 단일 컬럼 푸터 |

### 2.2 Out of Scope (본 작업에서 제외)
- `/about`, `/programs`, `/news` — 실 사이트에 대응 라우트 없음. 본 작업에서는 **현상 유지** (기존 Heraldic 페이지 보류). SPEC 상 유지 필요 시 후속 작업으로 분리.
- 관리콘솔 `(admin)`, API 라우트 — 영향 없음.
- 실제 학교 로고 이미지 자산 라이선스 확보 — 본 작업에서는 **플레이스홀더 로고 박스**로 대체 후, 자산 확보 후 교체.
- 결제·알림 등 Trinity Pay / AMA 연동 로직 — 변경 없음.

### 2.3 브랜드 정합성
- SPEC.md 의 Trinity Heraldic 팔레트 (Navy `#0E1E3A`, Gold `#C9A656`, Cream `#FAF7EE`) 는 실 사이트의 지배 톤 (딥 네이비 + 아이보리 + 포인트 골드/베이지) 과 **충분히 호환**된다. 기존 Tailwind 토큰을 그대로 사용하되, OMNIBUS OMNIA 모토·Shield 로고·Cormorant 디스플레이 서체는 **본 포털에서 제거**한다 (실 사이트에 없음).
- 본문 서체는 `Pretendard` / `Noto Sans KR` 중심으로 전환.

## 3. Functional Requirements (기능 요구사항)

### FR-01. Home (`/`)
10개 섹션을 실 사이트 순서 그대로 렌더링한다.

1. **Hero** — `NWEA MAP TEST 공식 기관` 아이브라우 + `TRINITY ACADEMY` 워드마크 + 리드 카피 2문장. 풀블리드 배경 사진.
2. **Results Band** — 헤딩 `트리니티 아카데미의 자신감은 확실한 결과에서 나옵니다.` + 본문 2문장 + **144명 국제학교 합격** 수치 카드 + 학교 로고 4개 그리드.
3. **Dual Campus / Delivery** — 헤딩 `제주 영어교육도시 본원 · 압구정 도산공원 센터의 오프라인 입학 준비 수업과 엄선된 교사진의 온라인 개인 수업` + 본문.
4. **Pillar 1 · 학교별 맞춤 전략** — 카드 헤딩 + 문제제기 + `실전 분석 데이터:` 라벨 본문.
5. **Pillar 2 · 완벽한 원서 지원 전략** — 합격률 99% 헤딩.
6. **Pillar 3 · 상세 진단과 학습 로드맵**.
7. **Pillar 4 · All in One 관리**.
8. **Results Reprise** — §2 의 수치 블록 + 학교 로고를 반복 노출.
9. **5-Step Process** — 세로 타임라인. Step 01~05 각각 번호 배지 + `라벨: 설명` 본문.
10. **Closing CTA 3-grid** — `MAP TEST 신청` · `1:1 무료 상담` · `전화상담` (064-792-1906 / 010-6703-1906).

**Props**: 모든 카피는 TypeScript constants 로 하드코드 (CMS 도입은 후속).

### FR-02. MAP Test (`/map-test`)
- Heading: `MAP Test를 응시하는 학생의 기본 인적사항을 입력해 주세요.`
- 필드 (전부 필수):
  1. 학생 한글 이름 (text)
  2. 학생 영문 이름 (text)
  3. 학생 생년월일 (date)
  4. 학생 학년 (select: G2~G12)
  5. 학생 성별 (radio: 남 / 여)
  6. 연락 가능한 전화번호 (tel, 패턴 `010-0000-0000`)
  7. 학부모 이메일 (email)
  8. 응시 국가·도시 (text)
- 개인정보 수집 동의 체크박스 + 제1조~제13조 처리방침 전문 (expandable).
- 제출 버튼: `상담하기`. 제출 후 `정상적으로 접수되었습니다 / 영업일 기준 24시간 이내 연락` 성공 메시지.
- **검증**: React Hook Form + Zod. 제출 시 `/api/consultations` (기존 라우트 재사용) 로 POST. type 필드에 `MAP_TEST_INQUIRY` 태깅.
- 하단에 두 캠퍼스 주소 블록 재노출.

### FR-03. Contact (`/contact`)
- Hero: `정확한 학업 진단 독보적인 입학 시험 클래스 확실한 국제학교 합격, 트리니티가 선사합니다.`
- 필드:
  1. 상담 유형 (checkbox 멀티):
     - 인가 국제학교 입학 준비
     - 비인가 국제학교 입학 준비
     - 외국인학교 입학 준비
     - 해외 주니어 보딩스쿨 / 하이 보딩스쿨 입학 준비
     - All in One 입학 준비 컨설팅 (수업+포트폴리오+원서 지원+GPA관리)
  2. 학생 이름 (text, 필수)
  3. 학년 (text, 필수)
  4. 연락처 (tel, 필수)
- 개인정보 수집 동의 (필수).
- 제출 버튼: `상담하기`. 성공 메시지 동일.
- **검증·백엔드**: `/api/consultations` POST. type `GENERAL_INQUIRY`.
- 하단에 두 캠퍼스 주소 + 전화 + 이메일 블록.

### FR-04. Common Header
- 좌측: 로고 (이미지 자산). 클릭 시 `/` 이동.
- 우측 데스크톱 메뉴: `국제학교 입학 준비 상담 신청` (→ `/contact`), `온라인 MAP TEST 응시 신청` (→ `/map-test`) — 2개만.
- 우측 상단 **고정 플로팅 CTA 그룹** (sticky, 모바일·데스크톱 공통):
  - `맵테스트 응시` (icon + 라벨) → `/map-test`
  - `상담신청` → `/contact`
  - `카카오톡 상담` → `https://pf.kakao.com/_LxdHxexj` (외부 링크, target=_blank)
  - `전화 064-792-1906` → `tel:064-792-1906`
- 모바일: 햄버거 대신 우측 플로팅 CTA 유지 + 상단 헤더 단순화.

### FR-05. Common Footer
- 단일 섹션, 중앙 정렬:
  - 상담 시간 / 수업 시간
  - 제주 본원 주소 전문
  - 압구정 센터 주소 전문
  - 전화 2종, 이메일, 카카오 채널 링크
  - `COPYRIGHT © TRINITY ACADEMY ALL RIGHTS RESERVED.`
- **보강** (원본에 누락): 사업자등록번호·대표자·통신판매업신고·개인정보책임자 표기 (값은 TBD, placeholder 로 마크업만 준비).

## 4. Non-Functional Requirements (비기능 요구사항)

| ID | 항목 | 요구 |
|----|------|------|
| NFR-P1 | 성능 | Lighthouse Performance ≥ 85 (mobile), LCP ≤ 2.5s. Hero 이미지 `next/image` + `priority`. |
| NFR-P2 | 반응형 | 360 / 768 / 1024 / 1440 4-브레이크포인트 검수. 플로팅 CTA 가 본문 가리지 않도록 `padding-right` 확보. |
| NFR-P3 | SEO | `metadata` API 로 각 라우트 title·description·OG 이미지 설정. `lang="ko"` 기본. |
| NFR-P4 | A11y | WCAG 2.1 AA. form label 연결, 플로팅 CTA `aria-label`, 이미지 `alt`. |
| NFR-P5 | i18n | react-i18next 기반 ko 기본. 본 작업은 ko only, 다국어 키만 분리해 두어 후속 en 추가 용이. |
| NFR-P6 | 보안 | reCAPTCHA v3 (CLAUDE.md §11) 두 폼에 적용. 서버 측 검증 중복. |
| NFR-P7 | 브라우저 | Chrome·Safari·Edge 최신 2버전, iOS Safari 16+, Android Chrome 최신. |

## 5. Information Architecture

```
(portal)
├── /                   · Home (교체)
├── /map-test           · MAP TEST 응시 신청 (교체)
├── /contact            · 상담 신청 (교체)
├── /about              · 기존 유지 (본 작업 out-of-scope)
├── /programs           · 기존 유지 (본 작업 out-of-scope)
└── /news               · 기존 유지 (본 작업 out-of-scope)
```

## 6. Content Source Mapping

| 실 사이트 | 본 구현 위치 |
|-----------|--------------|
| `/` Hero → §10 | `(portal)/page.tsx` 의 10 개 컴포넌트 |
| `/test` 폼 | `(portal)/map-test/page.tsx` |
| `/contact` 폼 | `(portal)/contact/page.tsx` |
| 헤더 2-링크 + 플로팅 CTA | `(portal)/layout.tsx` + `components/portal/FloatingCta.tsx` |
| 단일 컬럼 푸터 | `(portal)/layout.tsx` 내부 |

## 7. Assumptions & Open Questions

| ID | 항목 | 상태 |
|----|------|------|
| A-01 | 학교 로고 4개 (NLCS·SJA·KIS·Chadwick) 라이선스 확인 불가 → 본 작업은 **플레이스홀더 로고 박스**로 대체. | **확인 필요** |
| A-02 | 실 사이트 Hero 배경 사진 저작권 → 자체 이미지 또는 stock 으로 교체. 본 작업은 네이비 그라디언트 + 타이포 대체 후 자산 확보 시 교체. | **확인 필요** |
| A-03 | reCAPTCHA v3 사이트 키 발급 → 없으면 본 작업은 UI 만 연결, 서버 검증은 placeholder. | **확인 필요** |
| A-04 | 사업자등록번호·통신판매업신고 등 법정 표기 값 → 푸터 마크업만 작성, 값은 TBD. | **확인 필요** |
| A-05 | Home §4–7 의 4개 필라 카드를 실 사이트처럼 "세로 스택"으로 둘지, 2×2 그리드로 바꿀지 → **세로 스택 유지** (원본 충실). | 확정 |

## 8. Acceptance Criteria

- [ ] `/` 가 실 사이트와 동일한 10개 섹션 순서로 렌더링되며, 카피가 본 문서 FR-01 과 일치한다.
- [ ] `/map-test` 가 8개 필수 필드 + 동의 체크 + 제출 성공 메시지를 지원하고, `/api/consultations` 로 정상 POST 된다.
- [ ] `/contact` 가 5종 상담 유형 멀티 체크 + 3 필수 필드 + 동의 + 제출을 지원한다.
- [ ] 헤더 우측 플로팅 CTA 4종 (맵테스트/상담/카톡/전화) 이 데스크톱·모바일 모두에서 스크롤 시 고정된다.
- [ ] 모든 폼이 React Hook Form + Zod 검증을 통과하며, 서버 에러는 토스트로 표시된다.
- [ ] Lighthouse mobile Performance ≥ 85, Accessibility ≥ 95.
- [ ] `/about`, `/programs`, `/news` 는 본 작업 전후로 렌더링 결과가 동일하다 (회귀 없음).
