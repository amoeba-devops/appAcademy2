---
document_id: SYS-REQ-260903
version: 1.1.0
status: CONFIRMED (2026-09-03 사용자 확정 "진행")
date: 2026-09-03
change_log:
  - 2026-09-03 v1.1.0 사용자 확정. CSL→CAL 9시간 버그는 승인 미회신으로 범위 외 유지(§4)
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# REQ-260903 — 테넌트 타임존 설정 / Tenant Timezone Setting

## 1. Overview (개요)

`/admin/config`에 **타임존 설정**(기본 `Asia/Seoul` — 서비스 국가 한국)을 추가하고, 수업일정(`/admin/cal`)의 **모든 시간 표시·입력·조회 범위가 브라우저 위치와 무관하게 설정된 타임존(한국시간) 기준**으로 동작하게 한다.

## 2. Current State (현행 문제)

- 프론트 전체에 `timeZone` 지정이 **0건** — 모든 시간이 브라우저 로컬 기준:
  1. **표시**: `formatTime` 등 모든 포매터가 브라우저 TZ로 렌더 → 해외(예: UTC+7)에서 접속하면 한국 15:00 수업이 13:00으로 표시.
  2. **입력**: 일정 등록 모달의 `datetime-local` 왕복(`formatDateTimeLocal`/`localInputToIso`)이 브라우저 TZ 기준 → 해외에서 "14:00" 입력 시 한국 14:00이 아닌 다른 시각으로 저장.
  3. **조회 범위·날짜 버킷**: 월/주/일 범위와 날짜 그룹핑이 브라우저 자정 기준 → 해외 접속 시 일정이 옆 날짜 칸에 표시되거나 범위가 밀림.
- 백엔드는 이미 `Asia/Seoul` 하드코딩 다수(KPI SQL, 크론, 학부모포털, 피드백 메일 `formatKst`) — 한국 단일 서비스 전제로 동작 중.
- 테넌트 정보 저장소: `amb_acm_tenant` (ent당 1행, seed 존재) — 타임존 컬럼 추가 적합. 관리자용 조회/수정 엔드포인트는 없음(APP_ADMIN 전용만 존재).

## 3. Requirements (요구사항)

| ID | 요구사항 |
|----|---------|
| FR-1 | `/admin/config`에 "🌏 일반(타임존)" 카드 → `/admin/config/general` — 타임존 선택(기본 `Asia/Seoul`, 주요 IANA 타임존 목록), ADMIN 전용 저장 |
| FR-2 | 저장소: `amb_acm_tenant.tnt_timezone` (default 'Asia/Seoul'). 조회는 전 인증 사용자(`GET /acm/me/tenant-settings`), 수정은 ADMIN(`PUT /acm/admin/tenant-settings`) |
| FR-3 | **관리자 캘린더(cal 모듈) 전면 TZ 적용** — 표시(월/주/일/리스트 셀·상세·모달·삭제목록), 입력(datetime-local 왕복), 조회 범위·날짜 버킷을 테넌트 TZ 기준으로 전환. 라이브러리 미도입, Intl 기반 유틸로 구현 |
| FR-4 | 피드백 메일 일시 표기(`formatKst`) → 테넌트 TZ 사용 |
| FR-5 | 설정 미존재·조회 실패 시 **`Asia/Seoul`로 fail-open** (현행 한국 서비스 유지) |
| NFR | i18n 4 locale 동시, 기존 KST 브라우저 사용자에겐 동작 변화 없음(Asia/Seoul 기본) |

## 4. Out of Scope (범위 외 — 후속 과제로 기록)

- 포털(학생·학부모) 캘린더, 대시보드(dsh), cls/csl 화면의 TZ 전환 — P2 후속
- 백엔드 크론·SQL `Asia/Seoul` 하드코딩의 테넌트 TZ 전환 — 단일 한국 테넌트 동안 현행 유지
- **[발견된 별도 버그]** CSL→CAL 연동 일정(`csl-cal-linker.service.ts:147`)이 naive ISO를 UTC로 저장해 레벨테스트/데모수업 일정이 9시간 어긋나는 문제 — 별도 FIX 권고

## 5. Open Question (확인)

- Q-A: 타임존 선택지 — 주요 목록(Asia/Seoul, Asia/Ho_Chi_Minh, Asia/Bangkok, Asia/Tokyo, Asia/Shanghai, Asia/Singapore, UTC, America/Los_Angeles, America/New_York) 제안. 추가 필요 시 요청
