---
document_id: PLN-260718-portal-materials-cal-batch
title: 자료실 작성/공유 + 포털 로그인·캘린더 + 관리자 캘린더 개편 (일괄 요구)
version: 0.1.0
status: DRAFT (awaiting user confirmation)
author: Claude (Opus 4.8)
created: 2026-07-18
---

# PLN-260718 — 자료실·포털·관리자 캘린더 일괄 개편

> 규모가 커서 **4개 Phase(=PR)** 로 분할한다. 의존성: 파일첨부·자료파일은 S3/MinIO 필요 → **staging·prod는 이미 설정됨**(로컬만 미설정, 로컬 e2e 제한).

## 0. 요구사항 → Phase 매핑

| 요구 | 내용 | Phase |
|------|------|-------|
| B | 포털 로그인 학원코드/아이디 저장(remember-me) + 눈아이콘 + 최초로그인 비번변경 안내 삭제 | **P1** |
| C1 | `/portal/calendar` 리스트보기 옵션 | **P1** |
| C2 | 포털 수업일정 상세 — 관련자·메모 표시 | **P1** |
| D1 | 관리자 캘린더 필터/모달 개편 (아래 세부) — 첨부 제외 | **P1** |
| C3/D2 | 이벤트 파일첨부(업로드/상세 링크) — 관리자 등록 + 강사·학생 상세에서 자료 링크 | **P2** (S3) |
| A | 자료실 강사/학생 작성 + 공유대상 + 역할별 뷰 + 댓글 | **P3–P4** (S3, 데이터모델 신설) |

---

## 1. Phase 1 — 포털 UX + 캘린더 필터/상세 (무-저장소, 저위험)

### B. 포털 로그인 (`portal-login-page.tsx`, `auth.store` 무관)
- **remember-me**: "학원코드·아이디 저장" 체크박스 → `localStorage`(예: `acm-portal-remember`)에 tenantCode·loginId 저장, 다음 방문 시 프리필. 비밀번호는 저장하지 않음.
- **눈 아이콘**: 비밀번호 input 을 relative wrapper + show/hide 토글(Eye/EyeOff).
- **최초 로그인 안내 삭제**: 로그인 페이지 `portalApp.login.firstHint`(line 94) 문구 제거 + `mustChangePassword` 리다이렉트 분기 제거(항상 `returnTo ?? '/portal'`). 변경 페이지 subtitle `portalApp.changePw.subtitle` 의 "최초 로그인" 문구도 일반 문구로.

### C1. 포털 캘린더 리스트보기 (`portal-calendar-page.tsx`)
- `ViewMode` 에 `'list'` 추가 + 토글 버튼 + i18n `portalApp.cal.list`.
- 리스트뷰: 기간(예: 이번 달~향후 N일) 이벤트를 평면 정렬해 `EventRow` 재사용, 날짜 헤더 그룹핑. 클릭 시 기존 상세 모달/페이지.

### C2. 포털 상세 — 관련자·메모 (`getForPortal` 확장 + 상세페이지)
- 백엔드 `getForPortal`/`enrichItems` 에 **invitees 목록**(assignee + 참석자) 포함(admin `findOne` 의 `inviteeSvc.listForEvent` 재사용). 학생/학부모 화면 개인정보 노출은 admin 과 달리 **이름만** 노출(마스킹 최소).
- 프론트 `PortalCalEvent` 에 `invitees` 추가 → 상세페이지에 **관련자(담당강사+참석자)** + **메모** 표시. (첨부자료는 P2)

### D1. 관리자 캘린더 (`cal-month-page.tsx`, `cal-event-modal.tsx`, `invitee-picker-modal.tsx`)
- **필터 개편**: `TeacherMultiCombo`("+강사추가") 제거 → **강사: 전체보기 / 선택보기(복수)** + **학생: 전체보기 / 선택보기(복수)**. 백엔드는 `ownerUserIds`(강사) + `attendeeKind='STUDENT'`+`attendeeRefIds`(학생) 재사용(cap 10 → 필요 시 상향). "전체보기"=필터 없음.
- **참석자 선택 팝업**: kinds = **[학생|강사|학부모]** 만(현 `ALL` 제거) + 안내문구 "수업에 참여할 학생을 추가하세요. 다른 강사도 추가 가능합니다." + **모달 상단 고정**(DialogContent `top-1/2 -translate-y-1/2` → `top-[8vh] translate-y-0`).
- **일정 등록 폼**:
  - 담당자 라벨 **"담당 강사" → "담당자/강사"** (이 담당자도 수업링크 확인 가능 — 이미 assignee 는 launch-context 강사(11) 인가 대상).
  - **날짜/시간**: 시작 기본값 = **현재 이후**(다음 정각/30분), 날짜 지정 후 **시간은 셀렉트 리스트**(09:00~22:00 등 30분 간격)로 선택.
  - **보다 화상강의실(BodaRoomPanel) 박스를 참석자 박스 아래로 이동.**
- (파일첨부는 P2)

**목업 (관리자 일정 등록 모달 순서)**
```
제목
분류 | 담당자/강사
[ 날짜/시간 박스: 종일 · 시작(날짜+시간셀렉트) → 종료(날짜+시간셀렉트) ]
장소 / 설명
[P2: 파일첨부]
참석자 (안내문구) [+ 참석자 추가]  ← 팝업 상단고정, kinds 학생/강사/학부모
화상수업(입장링크)
보다 화상강의실(BodaRoomPanel)   ← 참석자 아래로 이동
```

---

## 2. Phase 2 — 이벤트 파일첨부 (S3)  ✅ 구현 완료 (PR pending)

> 구현: `amb_acm_cal_event_attachment`(sql/acm/999c) + `CalEventAttachmentService`(isConfigured→503, MIME allow-list, 20MB×20/이벤트, 한글파일명 latin1→utf8) + 관리자 컨트롤러(`/acm/cal/events/:id/attachments` CRUD·download) + 포털 다운로드(`/portal/cal/events/:id/attachments/:attId/download`, `ensurePortalEventAccess` 스코프). findOne·getForPortal 에 `attachments` 포함. 관리자 모달 `CalEventAttachmentPanel`(장소/설명 하단), 포털 상세 첨부 링크. i18n 4locale. be tsc/eslint clean, acm-cal 96 tests pass, fe tsc/build clean.
> **배포 후 수동 마이그레이션 필요**(sql/acm 는 init-only): `sql/acm/999c-acm-cal-event-attachment.sql` 를 staging/prod `db_acm` 에 psql 적용.

- **백엔드**: 신규 `amb_acm_cal_event_attachment`(evt_id FK, s3_key, filename, mime, size, uploaded_by, created_at, deleted_at) + 업로드(`POST /acm/cal/events/:id/attachments`, multipart)·목록·다운로드(`GET .../:attId/download`) + **포털 다운로드**(`GET /portal/cal/events/:id/attachments/:attId/download`, 스코프 검증). `AttachmentService` 패턴 채택(isConfigured()→503, MIME allow-list, size cap, 한글파일명 처리).
- **프론트**: 관리자 모달 장소/설명 하단 파일첨부 UI. 상세(관리자 모달 + 포털 상세)에 자료 링크. `getForPortal` 에 attachments 포함.
- 전제: prod/staging S3 설정됨(확인 완료). 로컬은 MinIO 컨테이너 필요(선택).

---

## 3. Phase 3–4 — 자료실 작성/공유/댓글 (S3 + 데이터모델 신설)

### 데이터 모델 (신설)
- `amb_acm_material` 확장: `mat_author_kind`(STAFF/TEACHER/STUDENT), `cls_id` **nullable화**(학생 제출은 반 비종속 가능), `mat_uploaded_by`(기존).
- 신규 `amb_acm_material_share`(mat_id, tgt_kind[STUDENT|TEACHER], tgt_ref_id) — 공유 대상 조인.
- 신규 `amb_acm_material_comment`(mat_id, body, author_id, author_kind, created_at, deleted_at) — 댓글(flat, `RemarkTypeormEntity` 패턴).

### 권한/뷰 규칙
- **강사 작성**: 공유할 **학생 다중 선택**(없으면 본인만). 
- **학생 작성**: 공유할 **강사 지정**(= 제출).
- **학생 뷰**: (1) 내가 작성한 글, (2) 강사가 나에게 공유한 글 — **탭 구분**.
- **강사 뷰**: (1) 내가 작성한 글, (2) 학생이 나에게 제출한 글 — **탭 구분**, 제출글에 **댓글** 작성 가능.
- 삭제는 작성자 본인(+관리자)만.

### 엔드포인트/프론트
- 포털 create(`POST /portal/materials`, multipart + shareTargets[]) + 댓글(`POST /portal/materials/:id/comments`, `GET .../comments`).
- `listForPortal` 을 own/shared 브랜치로 재작성(현 class-membership → author + share 기반).
- 포털 자료실 UI: 작성폼(공유대상 피커=AttendeeFilter 재사용) + 탭(내글/공유받은글) + 댓글 스레드.

> Phase 3 = 백엔드(모델·엔드포인트·권한), Phase 4 = 프론트(작성/탭/댓글) 로 분할 가능.

---

## 4. 공통 사항
- i18n ko/en/vi/zh-CN 동시.
- DB 마이그레이션: P2(이벤트 첨부 테이블), P3(자료 공유/댓글 테이블 + material 확장) — 수동 적용(런북).
- 각 Phase = 별도 PR, CI→staging→prod.

## 5. 확인 필요 (결정)
1. **진행 범위/순서**: P1부터 순차? P1+P2 먼저? 전체?
2. **자료실 공유 모델**: 위 설계(공유대상 조인 + flat 댓글 + cls_id nullable) 로 진행?
3. **이벤트 첨부 vs 자료실**: 별개 기능으로(이벤트=이벤트첨부테이블, 자료실=확장) 진행?
