---
document_id: PLN-260715-portal-boda-entry
version: 0.1.0
status: DRAFT (decisions confirmed)
author: Claude (Opus 4.8)
created: 2026-07-15
change_log:
  - 0.1.0 (2026-07-15): initial
---

# PLN-260715 — 포털 수업일정 상세보기 + 학생/학부모 BODA 강의실 입장

## 1. Overview
`/portal/calendar` 후속: (1) 이벤트 **상세보기 모달** 없음 → 추가, (2) 상세에서 등록된 화상수업 링크 클릭 시 **BODA(보다스쿨) 강의실 입장**. 학생/학부모는 웹이므로 **브라우저 모드**(`webBrowserUrl` 새 탭)로 입장.

## 2. 조사 결론 — 입장에 필요한 정보 & 현재 차단
입장(bodaJoin, 학생 UTy=12)에 필요한 정보: `meetKey`(+학생 `meetIdx`), `bodaWeb`, 회사 `CCd/CId`, `UId/UNm/UTy`, `lang` → 브라우저 모드는 서버가 `webBrowserUrl`(CCd·CId·meetKey·roomCode·UTy·UId·UNm·lang)로 합성. room 데이터는 완비.

**현재 3중 차단(콘솔 전용):** ① launch-context 가 AcmJwtAuthGuard → 포털 토큰 401 ② resolveUserType 이 invitee-only + 콘솔 user id 매칭 → 수강생(invitee 아님) 403 ③ 런처 페이지 콘솔 세션 전용.

## 3. Design (결정: 브라우저 모드 + 모달)
### 3.1 Backend
- `BodaLaunchContextService.buildForPortal(evtId, entId, kind, refId, lang)` 신설: 이벤트/room 확인(BODASCHOOL) → `resolvePortalUserType` → time-window → uname(학생/학부모 실명) + uid(refId) → `webBrowserUrl` 등 컨텍스트 반환.
- `resolvePortalUserType(event, kind, refId, entId)`: **포털 신원(std_id/par_id) + 수강반 기반**.
  - STUDENT: invitee(STUDENT,refId) OR `event.clsId` 수강(`cst_student_user_id=refId, cst_left_at NULL`) → 12, else 403 NOT_AN_ATTENDEE.
  - PARENT: 자녀(student_parent) 중 invitee OR 해당 반 수강 → 12, else 403.
- 신규 repo 주입: ClassStudent, Parent, StudentParent (acm-cal.module forFeature 추가).
- 신규 컨트롤러 `PortalBodaLaunchController` `@Controller('portal/cal/boda')` `@UseGuards(PortalJwtAuthGuard)`, `GET launch-context?evtId=&lang=` → `buildForPortal(...)`.
- time-window / 미프로비저닝 / not-attendee 는 기존 에러코드 재사용.

### 3.2 Frontend (portal-app)
- `api-client` `isPortalEndpoint` 는 `/portal/cal` 프리픽스 매칭 → `/portal/cal/boda/*` 자동으로 포털 토큰 사용(변경 불필요, 확인).
- `portal-api.ts`: `bodaLaunch(evtId)` → GET `/portal/cal/boda/launch-context`.
- `portal-calendar-page.tsx`: 이벤트 클릭 → **상세 모달**(공용 Dialog): 제목·시간·분류·담당강사·설명 + BODASCHOOL 이면 **[보다스쿨 강의실 입장]** 버튼 → `bodaLaunch` → `window.open(webBrowserUrl)`. 오류(403/시간창/미설정) 토스트·비활성 처리.
- i18n `portalApp.cal.*` 신규 키 4 locale.

## 4. 운영 전제 (코드 외)
실제 입장 성공하려면 테넌트 BODA 설정에 **company_code(CCd)** + **webrtc_url** 이 채워져 있어야 함. (로컬 db_acm 은 webrtc_url 있음, company_code 비어있음)

## 5. Out of scope
- 데스크톱 앱/iframe 임베드 모드(추후). 강사 콘솔 launch-context 는 현행 유지(포털 경로만 신규).
