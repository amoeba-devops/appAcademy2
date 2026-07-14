---
document_id: PLN-260714-cal-datetime-boda-portal
version: 0.1.0
status: DRAFT (awaiting user confirmation)
author: Claude (Opus 4.8)
created: 2026-07-14
change_log:
  - 0.1.0 (2026-07-14): initial draft
---

# PLN-260714 — 캘린더 날짜/시간 UI + 화상수업 입장링크 + 포털 수업일정 읽기

## 1. Overview (개요)
`/admin/cal`·`/portal/calendar` 3건.
- **R-A**: 일정 등록/수정 모달의 **날짜/시간 선택 UI 재설계** (첨부 이미지 기준: 종일 토글 + 날짜/시간 분리 + 소요시간 + 요일).
- **R-B**: 등록된 화상수업(BODA)에 **강사용 [입장링크] 버튼** 추가.
- **R-C**: 학생/학부모 포털 `/portal/calendar` 에서 **수업일정이 안 보이는 버그** 수정 (인증 문제 아님 — 데이터 스코프 갭).

## 2. 현황 분석 (탐색 결과)
- 모달: [cal-event-modal.tsx](frontend-acm/src/modules/cal/components/cal-event-modal.tsx) — 현재 `<input type="datetime-local">` 2개(시작/종료). 종일 체크박스는 존재하나 입력에 영향 없음. 날짜 유틸: [date-utils.ts](frontend-acm/src/modules/cal/lib/date-utils.ts) (`formatShortDate`, `formatTime`, `defaultEventTimes` 등). 피커 라이브러리 없음 → 네이티브 input 컨벤션 유지.
- 화상수업: provider `BODASCHOOL` 일 때 `BodaRoomService.createPending` 이 `event.meetingUrl = /web/classroom/{evtId}` (런처)로 기록. 강사=이벤트 owner → 런처가 `bodaOpen()`(강사 입장). 모달엔 **읽기전용 링크만**, 버튼 없음. 재사용 패턴: `window.open(url,'_blank','noopener,noreferrer')` ([instant-class-modal.tsx](frontend-acm/src/modules/cal/components/instant-class-modal.tsx):102, `?autoStart=1` 부여 시 강사 자동입장).
- 포털: `/portal/cal/events` (PortalJwtAuthGuard) 는 포털 토큰 **정상 수신**. 근본원인 = [cal-event.service.ts](backend/src/modules/acm-cal/application/cal-event.service.ts) `listForPortal` 이 **명시적 `amb_acm_cal_invitee` 행**만 매칭 → 정규수업엔 학생별 invitee가 생성되지 않아 **빈 목록**. 수강반 매핑은 `amb_acm_cls_class_students`(`cls_id`/`cst_student_user_id`/`cst_left_at`)에 존재하고 이벤트엔 `evt_cls_id` 가 있음.

## 3. Design (설계)

### 3.1 R-A — 날짜/시간 UI 재설계 (cal-event-modal.tsx)
이미지 기준 레이아웃(네이티브 `type="date"` + `type="time"` + lucide `Calendar`/`Clock` 아이콘):
```
┌───────────────────────────────────────────┐
│ ☐ 종일                                      │
│ 📅 [2026-06-29]   🕐 [09:00]               │  ← 종일 ON이면 시간 숨김
│ → 종료일                                    │
│ 📅 [2026-06-29]   🕐 [10:00]  · 1시간       │  ← 소요시간 표시
│    2026-06-29 (월)                          │  ← 요일 라벨
└───────────────────────────────────────────┘
```
- 폼 값을 `evtStartDate/evtStartTime/evtEndDate/evtEndTime` 4개로 분리(react-hook-form). 제출 시 `date+time → ISO` 합성해 기존 `evtStartAt/evtEndAt`(ISO) payload 유지 → **백엔드 DTO 변경 없음**.
- 종일(`evtAllDay`) ON: 시간 input 숨김, 시작 00:00 / 종료 23:59(또는 익일 00:00) 합성. OFF: 시간 표시.
- 소요시간 힌트: `watch` 로 (end-start) 계산 → "N시간 M분". 요일: `Intl.DateTimeFormat(locale,{weekday})`.
- 검증(기존 유지): 제목/시간 필수, 종료 ≤ 시작 금지.
- i18n(4 locale): `field.allDay`(기존) 재사용 + 신규 `field.endDate`(종료일), `hint.duration`(소요시간 표기 보조) 최소 추가. 요일/숫자는 런타임.

### 3.2 R-B — 강사용 [입장링크] 버튼
- 대상: **edit 모드 + provider `BODASCHOOL` + `meetingUrl` 존재**(=등록된 화상수업).
- 위치: 모달 "화상수업" 섹션의 읽기전용 링크 옆에 **[입장링크]** 버튼(+ 보조로 [링크 복사]). 추가로 월뷰 이벤트 카드(BODA 이벤트)에 작은 입장 아이콘 버튼(선택).
- 동작(강사용): `window.open(`${meetingUrl}?autoStart=1`, '_blank', 'noopener,noreferrer')` → 런처가 owner=강사를 `bodaOpen()`으로 자동 입장. (일반 링크 복사는 `?autoStart` 없이 런처 URL 제공)
- i18n: `actions.enterLink`("입장링크"), `actions.copyLink`("링크 복사") 4 locale.
- 백엔드 변경 없음(기존 launch-context/launcher 재사용).

### 3.3 R-C — 포털 수업일정 읽기 (listForPortal 스코프 확장)
`cal-event.service.ts listForPortal` STUDENT/PARENT 분기에 **수강반 기반 매칭 OR** 추가(읽기 시점 조인, 마이그레이션·백필 불필요, 기존 정규수업 즉시 노출):
```sql
-- STUDENT: 기존 invitee OR 내 수강반 이벤트
OR (e.evt_cls_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM amb_acm_cls_class_students cs
  WHERE cs.cls_id = e.evt_cls_id AND cs.ent_id = e.ent_id
    AND cs.cst_student_user_id = :ref AND cs.cst_left_at IS NULL))
-- PARENT: 자녀의 수강반 이벤트
OR (e.evt_cls_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM amb_acm_cls_class_students cs
  JOIN amb_acm_std_student_parent sp
    ON sp.std_id = cs.cst_student_user_id AND sp.ent_id = cs.ent_id
  WHERE cs.cls_id = e.evt_cls_id AND cs.ent_id = e.ent_id
    AND cs.cst_left_at IS NULL AND sp.par_id = :ref))
```
- 탈퇴(cst_left_at) 학생은 제외. TEACHER 분기는 현행 유지.
- 백엔드만 변경, DB 마이그레이션 없음.

## 4. Out of scope
- 화상수업 참석자 초대 자동 생성(별도). BODA 벤더 로직 변경 없음.
- 날짜 피커 라이브러리 도입(네이티브 유지).

## 5. Task Checklist
- [ ] R-A cal-event-modal 날짜/시간 UI + 폼값 분리/합성 + 종일/소요시간/요일 + i18n
- [ ] R-B 입장링크/복사 버튼(모달, +카드 선택) + i18n
- [ ] R-C listForPortal STUDENT/PARENT 수강반 OR 확장 + 유닛테스트
- [ ] Verify: fe typecheck/build, be test, 로컬 e2e(포털 학생 캘린더에 수강반 이벤트 노출 / 강사 입장링크 동작)
