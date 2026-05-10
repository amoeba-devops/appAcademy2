---
document_id: TC-260510-acm-tch-list-and-resume
title: ACM 교사관리 — 목록 항목 확장 및 이력서 업로드 테스트케이스
version: 1.0.0
status: DRAFT
author: GitHub Copilot (Claude)
created_at: 2026-05-10
related_requirements: REQ-260510-acm-tch-list-and-resume
related_plan: PLN-260510-acm-tch-list-and-resume
---

# TC-260510 — ACM 교사관리 기능 개선 테스트케이스

> 분석서: [REQ-260510](../analysis/REQ-260510-acm-tch-list-and-resume.md) · 계획서: [PLN-260510](../plan/PLN-260510-acm-tch-list-and-resume.md)

## 1. AC ↔ TC 매핑

| AC | TC IDs |
|----|--------|
| AC-1 (12 컬럼 표시) | TC-001, TC-002 |
| AC-2 (신규 4 필드 저장) | TC-010, TC-011 |
| AC-3 (재직상태 필터) | TC-020, TC-021, TC-022 |
| AC-4 (첨부 다중 업로드/다운로드) | TC-030, TC-031, TC-032 |
| AC-5 (크기·형식 거부) | TC-033, TC-034, TC-035 |
| AC-6 (ent 격리 다운로드 거부) | TC-036 |
| AC-7 (계정 잠금 → 로그인 차단) | TC-040, TC-041, TC-042 |
| AC-8 (INACTIVE → RESIGNED 마이그레이션) | TC-050 |
| AC-9 (ADMIN 권한 필요) | TC-060, TC-061 |
| AC-10 (교사 soft-delete 시 디스크 보존) | TC-070 |

## 2. Test Cases

> 우선순위: P0 = 배포 차단, P1 = 출시 차단, P2 = nice-to-have.
> 분류: U=Unit, I=Integration, E=E2E, M=Manual.

### TC-001 — 목록 12 컬럼 렌더 (E, P0)
- 전제: TPI 운영자(admin@tpi.co.kr) 로그인. 교사 ≥3명 존재(강사/비강사/계정미연계 각 1명 이상).
- 입력: `/admin/tch` 진입.
- 기대: 헤더 12 컬럼 노출 — 이름/강사/고용/아이디/생년월일/이메일/핸드폰/입사일자/출결#/최종로그인/재직/계정.
- 데이터 없는 셀은 `—` 노출. 첫 컬럼(이름) sticky.

### TC-002 — 가로 스크롤 동작 (E, P2)
- 입력: 목록 화면에서 가로 스크롤.
- 기대: 첫 컬럼(이름) 고정, 나머지 컬럼 좌우로 스크롤됨.

### TC-010 — 신규 등록: 4 필드 저장 (E, P0)
- 입력: [+신규등록] → 이름·이메일 + 강사여부=비강사, 고용형태=시간제, 입사일자=2026-04-01, 출결번호=A099 입력 후 저장.
- 기대: 201 응답. 목록에 강사✗ / 시간제 / 2026-04-01 / A099 표시. DB row 의 컬럼값 일치.

### TC-011 — 신규 등록 DTO: 알 수 없는 필드 거부 (I, P1)
- 입력: POST `/api/acm/tch/teachers` body 에 `tchUnknown: "x"` 포함.
- 기대: 400 `property tchUnknown should not exist`.

### TC-020 — 재직상태 옵션 노출 (E, P0)
- 입력: 신규/수정 모달의 재직상태 셀렉트 클릭.
- 기대: 옵션 3개 = 재직중 / 휴직 / 퇴사.

### TC-021 — 재직상태 필터: LEAVE (E, P0)
- 전제: 휴직 교사 1명 존재.
- 입력: 목록 필터 재직상태=휴직.
- 기대: 휴직 교사만 노출. URL `?status=LEAVE` 유지.

### TC-022 — 재직상태 필터 default ACTIVE (E, P1)
- 입력: 목록 진입 직후.
- 기대: 필터 default=재직중. RESIGNED 교사는 비노출.

### TC-030 — 첨부 PDF 업로드 (E, P0)
- 입력: 교사 상세 Drawer → 첨부 탭 → `이력서.pdf` (1MB) drop.
- 기대: 201 응답. 목록에 행 추가, 파일명·크기·시각 표시.

### TC-031 — 첨부 다중 업로드 (E, P0)
- 입력: PDF + JPG 동시 업로드.
- 기대: 첨부 목록 2건. 각 row 의 다운로드/삭제 버튼 활성.

### TC-032 — 첨부 다운로드 (E, P0)
- 입력: 업로드된 PDF 의 [⬇] 클릭.
- 기대: 응답 헤더 `Content-Disposition: attachment; filename="이력서.pdf"` (RFC 5987 인코딩 포함). 파일 바이트 동일.

### TC-033 — 크기 초과 거부 (I, P0)
- 입력: 11MB PDF 업로드.
- 기대: 400 `FILE_TOO_LARGE` (또는 동등 메시지). UI 에 검증 실패 토스트.

### TC-034 — 미지원 형식 거부 (I, P0)
- 입력: `.docx` 업로드.
- 기대: 400 `UNSUPPORTED_MIME`.

### TC-035 — MIME 위조 거부 (I, P1)
- 입력: 확장자 `.pdf` 지만 실제 ZIP 내용인 파일 업로드.
- 기대: magic bytes 검증으로 400. (구현: 파일 헤더 4바이트 검사 — `%PDF`, `\xff\xd8\xff` (JPG), `\x89PNG`)

### TC-036 — ent 격리 다운로드 거부 (I, P0)
- 전제: 다른 ent 의 운영자 토큰 발급.
- 입력: 다른 ent 운영자가 첨부 다운로드 URL 호출.
- 기대: 403.

### TC-040 — 계정 잠금 토글 (E, P0)
- 입력: Drawer → 계정 영역 [잠금] 클릭 → 확인 다이얼로그 → 진행.
- 기대: 200. UI 에 ● 잠김 + [해제] 버튼. DB `usr_locked_at` 갱신.

### TC-041 — 잠긴 계정 로그인 차단 (I, P0)
- 입력: 잠긴 사용자 자격으로 `/api/acm/auth/login` 호출.
- 기대: 401 `code=ACCOUNT_LOCKED`.

### TC-042 — 본인 계정 잠금 보호 (E, P1)
- 입력: 운영자 본인이 자신과 연계된 교사 row 의 [잠금] 버튼 hover.
- 기대: 버튼 disabled + tooltip "본인 계정은 잠글 수 없습니다".

### TC-050 — 마이그레이션: INACTIVE → RESIGNED (M, P0)
- 전제: staging DB 에 `tch_status='INACTIVE'` row 존재.
- 입력: `psql -f sql/acm/830-acm-tch-extend.sql` 실행.
- 기대: `SELECT tch_status, COUNT(*) ...` — 모든 INACTIVE 가 RESIGNED 로 전환. CHECK 제약 = `(ACTIVE, LEAVE, RESIGNED)`.

### TC-060 — 첨부 업로드 권한 (I, P0)
- 입력: 일반 사용자(비ADMIN) 토큰으로 POST `/.../attachments`.
- 기대: 403.

### TC-061 — 잠금 토글 권한 (I, P0)
- 입력: 비ADMIN 토큰으로 PATCH `/.../account/lock`.
- 기대: 403.

### TC-070 — 교사 soft-delete 시 첨부 파일 보존 (M, P2)
- 입력: 첨부 1개 보유 교사 DELETE → 디스크에서 파일 확인.
- 기대: 디스크 파일 잔존 (FK ON DELETE CASCADE 가 있더라도 본 작업은 row 삭제 X — 교사 soft-delete 만). 별도 정리 잡 미구현 명시.

### TC-080 — list 응답에 account 필드 포함 (U, P1)
- 입력: TeacherService.list() 호출 (mock repository, JOIN 결과 stub).
- 기대: 응답 객체에 `accountUsername, accountLastLoginAt, accountLockedAt` 키 존재. 미연계 교사는 모두 null.

### TC-081 — Username = email local-part 변환 (U, P1)
- 입력: email = `kteacher@tpi.co.kr` 의 local-part 변환 함수.
- 기대: 결과 `kteacher`. email = `a.b+c@x.y` 의 경우 `a.b+c`.

### TC-082 — Attachment Service 검증 (U, P0)
- Cases:
  - size > 10MB → throws BadRequestException.
  - mime not in whitelist → throws.
  - 정상 → fs.writeFile 호출 + repo.insert 호출 + 반환 객체에 attId, originalName.

### TC-083 — login locked check (U, P0)
- 입력: AcmAuthService.login(email, pwd) — 사용자 조회 결과 lockedAt != null.
- 기대: UnauthorizedException with code=ACCOUNT_LOCKED.

## 3. Regression Suite

기존 회귀 (변경되지 않아야 함):
- 기존 교사 CRUD (생성/수정/삭제/계정 생성/비번 리셋) — 동일하게 동작.
- 기존 ACM 다른 모듈(stf, sch, cls, csl) 의 POST/PUT — 영향 없음 (FIX-260510 회귀 확인).

## 4. Test Data

- TPI ent (`00000000-0000-0000-0000-000000000001`):
  - 강사 1: 강사여부=Y, 고용=정규, 계정O, locked=N
  - 강사 2: 강사여부=Y, 고용=시간제, 계정O, locked=Y (잠금 테스트)
  - 비강사: 강사여부=N, 고용=정규, 계정X
  - 휴직 교사: status=LEAVE
  - 퇴사 교사: status=RESIGNED (마이그레이션 결과 포함)
- 첨부용 샘플 파일:
  - `이력서.pdf` (1MB)
  - `자격증.jpg` (200KB)
  - `큰파일.pdf` (11MB) — 크기 거부용
  - `계약서.docx` (50KB) — 형식 거부용

## 5. Pass/Fail Criteria

- 모든 P0 통과 + P1 ≥80% 통과 시 운영 배포 진행.

## 6. Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-10 | Copilot | Initial draft |
