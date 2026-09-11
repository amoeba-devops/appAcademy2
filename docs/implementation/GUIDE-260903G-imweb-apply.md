---
document_id: CSL-GUIDE-260903G
version: 1.1.0
status: CONFIRMED
date: 2026-09-11
depends_on: docs/plan/PLN-260903G-external-intake-api.md
change_log:
  - 2026-09-11 v1.1.0 TPI /contact2 게시 완료 기록, 운영 401 원인(빈 env) · TRINITY 실도메인(trinityacademy.kr) · 사이트별 admin 로그인 반영 — FIX-260911 (Claude Code)
  - 2026-09-03 v1.0.0 최초 작성 — 3사이트 확정 상담희망 항목 반영 (Claude Code)
---

# GUIDE-260903G — 아임웹 3사이트 접수폼 적용 순서 / imweb Form Apply Guide

## 1. Intake Compatibility (상담테이블 접수 가능 여부 — 확정 항목 기준)

3사이트 전 항목 **접수 가능**. 표준 코드에 매핑되는 항목은 `inq_apply_purpose`(콘솔 필터/통계 가능), 매핑 없는 항목은 `inq_apply_purpose_other`에 **원문 그대로 보존**되어 상세 화면에서 확인된다 (유실 없음).

| 사이트 | 폼 항목 | 저장 방식 |
|---|---|---|
| TPI | MAP TEST 튜터링 | 코드 `MAP_TEST_TUTORING` |
| TPI | ISEE 튜터링 | 코드 `ISEE_TUTORING` |
| TPI | 국제학교/외국인학교 입학 준비 | 코드 `INTL_SCHOOL_PREP` |
| TPI | 맞춤형 GPA 관리 | 코드 `GPA_MGMT` |
| TPI | 심화 수업(SSAT / Duolingo / TOEFL / PSAT / AP / IB / ACT / SAT) | 코드 `ADVANCED_COURSES` |
| TRINITY | 인가/비인가 국제학교·외국인학교 입학 준비 (3항목) | 코드 `INTL_SCHOOL_PREP` (복수 선택 시 1코드로 합쳐짐 — 상세 구분은 other/메모 아님, 코드 단위) |
| TRINITY | 해외 주니어 보딩스쿨 / 하이 보딩스쿨 입학 준비 | other 원문 보존 |
| TRINITY | All in One 입학 준비 컨설팅(수업+포트폴리오+원서 지원+GPA관리) | other 원문 보존 |
| SANTACROCE | 외국인·국제학교 컨설팅 | 코드 `INTL_SCHOOL_PREP` |
| SANTACROCE | 교육 대리인 서비스 / 미국·영국 대학 입시 컨설팅 / 탑 보딩스쿨 / 탑 주니어 보딩스쿨 / 프리미엄 가디언 (5항목) | other 원문 보존 |

- 매핑 정의: [external-intake.config.ts](../../backend/src/modules/acm-csl/presentation/external-intake.config.ts) — 라벨 문자열 완전 일치 기준이므로 **사이트 항목 문구를 바꾸면 이 파일과 스니펫을 함께 갱신**해야 한다.
- 출처 구분: 모든 접수는 `inq_inflow_type=WEB_EXTERNAL` + `inq_source_site`(TPI/TRINITY/SANTACROCE)로 저장되어 콘솔 목록·칸반·상세에 "외부 웹 (사이트명)"으로 표시된다.

## 2. Prerequisites (선행 조건 — 개발/운영측)

1. PR #193 배포 완료 (backend + frontend-acm). `sql/acm/1010`은 CD가 자동 적용.
2. 사이트 키: [FIX-260911](../bug-fix/FIX-260911-external-intake-site-key-empty-env.md) 배포 후에는 스니펫 키 3종이 **코드 기본값**이라 env 없이 동작한다. 키 회전 시에만
   `ACM_INTAKE_SITE_KEYS=TPI:<key>,TRINITY:<key>,SANTACROCE:<key>` 를 운영 `.env.production` 에 설정하고 스니펫도 동시 교체.
   ⚠ FIX-260911 배포 전 상태에서는 env 를 설정해도 compose 의 `${ACM_INTAKE_SITE_KEYS:-}` 가 빈 값을 넘길 때 전건 401 이 난다 — 반드시 배포 후 진행.
3. 스니펫 3식 준비: `docs/implementation/snippets/external-intake-form-{tpi,trinity,santacroce}.html`
4. Origin allowlist 가 **실제 서비스 도메인**을 포함하는지 확인 — TRINITY 는 `trinityacademy.kr` 로 서비스 중 (`trinityacademy.imweb.me` 아님). `ACM_INTAKE_ORIGINS` env 는 CORS 헤더만 넓히고 컨트롤러의 사이트별 origin 검사는 `external-intake.config.ts` 상수이므로 도메인 추가는 코드 수정이 필요하다.

## 3. imweb Work Order (아임웹에서 해야 할 작업 순서 — 사이트 관리자)

> 로그인: https://imweb.me/mysite — `trinityprep103@gmail.com` (3사이트 공통 관리자)
> ⚠ 계정은 공통이지만 **admin 세션은 사이트(서브도메인)별로 따로 로그인**해야 한다. "사이트 관리" 버튼도 SSO 되지 않고 해당 사이트 로그인 화면으로 간다.
> 아래 절차를 **사이트마다 1회씩, 총 3회** 반복한다.
>
> 진행 현황 (2026-09-11): **TPI 완료** — 페이지 "상담 신청" `/contact2` 게시, 코드 위젯(위젯 ID `w20260912d54fe06e20578`) 삽입, 라이브 반영 확인. **TRINITY 완료** — 페이지 "상담 신청" `/contact2` 게시, 코드 위젯(위젯 ID `w202609124eeb037ab4ece`), `trinityacademy.kr/contact2` · `trinityacademy.imweb.me/contact2` 양쪽 라이브 확인. **SANTACROCE 완료** — 페이지 "컨설팅 신청" `/consult` 게시, 코드 위젯(위젯 ID `w202609125037d2515723d`), `santacroce.co.kr/consult` 라이브 확인. **FIX-260911 배포 완료(PR #205, 2b698f6, cd-production 2026-09-11 16:33Z)** 후 3사이트 시크릿 창 제출 테스트 성공("접수되었습니다"). 콘솔에서 상담종료 처리할 테스트 행 4건: TPI 2건(학생명 `테스트_ACM연동_TPI`, `테스트_ACM연동_TRINITY` — 후자는 이동 실패로 TPI 폼에 잘못 제출됨), TRINITY 1건(`테스트_ACM연동_TRINITY`), SANTACROCE 1건(`테스트_ACM연동_SANTACROCE`). 연락처는 모두 `010-0000-0000`.

### 3.1 페이지 생성
1. imweb.me/mysite → 대상 사이트 선택 → **사이트 편집** 진입
2. 상단 메뉴/페이지 관리 → **새 페이지 추가**
   - TPI: 주소 `/contact2` (기존 `/contact`는 그대로 유지)
   - TRINITY: 주소 `/contact2`
   - SANTACROCE: 새 메뉴 페이지 (기존 `/18` 유지, 예: "컨설팅 신청")
3. 페이지 레이아웃은 빈 섹션 1개면 충분

### 3.2 코드 위젯 삽입
4. 페이지 편집 → 위젯 추가 → **코드 위젯(HTML)** 선택
5. 해당 사이트의 스니펫 파일 **전체 내용**을 붙여넣기
   - TPI → `external-intake-form-tpi.html`
   - TRINITY → `external-intake-form-trinity.html`
   - SANTACROCE → `external-intake-form-santacroce.html`
   - ⚠ 사이트별 파일이 다르다 (SITE_KEY·상담희망 항목 상이). 교차 삽입 금지
6. 저장 → **게시(publish)**

### 3.3 제출 테스트 (사이트당 1건)
7. 게시된 페이지를 시크릿 창으로 열어 실제 제출 1건:
   - 이름 미입력/연락처 형식 오류/동의 미체크 시 인라인 에러 표시 확인
   - 정상 제출 시 "접수되었습니다" 확인
8. ACM 콘솔(/admin/csl) 접속 → 상담 목록에 **[외부 웹 (사이트명)]** 신규 행 + 실시간 알림 토스트 확인
9. 상세 화면에서 상담희망 항목 확인: 표준 코드 항목 + '기타'(미매핑 원문) 정상 표시 확인
10. 테스트 행은 콘솔에서 상담종료(단순문의종료) 처리

### 3.4 오픈 후 정리 (선택)
11. 검증 완료 후 기존 아임웹 입력폼 페이지(기존 `/contact`, `/18`)를 새 페이지로 메뉴 교체 또는 리다이렉트
12. 기존 아임웹 입력폼의 알림(이메일/카카오) 설정은 당분간 병행 유지 → 새 폼 안정화 확인 후 정리

## 4. Troubleshooting (문제 시 확인)

| 증상 | 원인/조치 |
|---|---|
| 제출 시 "오류가 발생했습니다" + 콘솔 401 | SITE_KEY ↔ `ACM_INTAKE_SITE_KEYS` 불일치 — env/스니펫 대조. **dev 키(`dev-intake-tpi`)까지 401이면 env 가 빈 문자열로 주입된 상태** ([FIX-260911](../bug-fix/FIX-260911-external-intake-site-key-empty-env.md)) |
| 제출 시 "오류가 발생했습니다" + 콘솔 403 | 페이지 Origin 이 사이트 allowlist 에 없음 — 커스텀 도메인(예: trinityacademy.kr) 또는 `http://` 진입. `external-intake.config.ts` origins 수정 + 배포, 아임웹 도메인/SSL 에서 HTTPS 강제 ON 권장 |
| 브라우저 콘솔 CORS 에러 | 사이트 도메인이 CORS 허용 목록에 없음 — `ACM_INTAKE_ORIGINS` env 추가 (단, 403 은 위 행 참조) |
| 행 생성 없이 키/오리진 단계만 진단 | 유효 키 + `Origin: https://not-allowed.example` 로 POST → 403 이면 키 정상, 401 이면 키 문제 (검사 순서: DTO → honeypot → key → origin → 저장) |
| 접수는 되는데 상담희망이 전부 '기타'로 감 | 폼 라벨 문구 변경됨 — config 매핑·스니펫 라벨 동기화 |
| 연속 제출 차단 | 분당 10건 스로틀 정상 동작 — 1분 후 재시도 |
