---
document_id: RPT-260729-session-summary
version: 1.1.0
status: complete
created: 2026-07-29
updated: 2026-07-29
scope: 세션 작업 정리 — BODA 화상강의 · 캘린더 감사 · 공지/메뉴 · 포털 UX
author: Claude (Opus 4.8)
---

# 작업 정리 보고서 (Session Summary)

> BODA(보다스쿨) 화상강의, 캘린더(수업일정) 감사, 공지(posts)·시스템 메뉴, 포털 UX 관련 작업을
> **요구사항 → (원인분석) → 분석·계획 → 구현 → CI → 머지 → staging → production** 전 과정으로 수행했다.
> **8건 전부 프로덕션 배포 완료**. (#162 BODA SPEC_823 개선은 재검토 후 clean 확인 → main 업데이트 → CI 재통과 → 2026-07-29 병합·배포 완료)

---

## 1. 배포 현황 요약 (Status board)

| # | 작업 | PR | 상태 |
|---|------|----|------|
| A | BODA APP API SPEC_823 대응 개선(roomTitle·에러커버리지·Mac/Mobile·appOpt) | [#162](https://github.com/amoeba-devops/appAcademy2/pull/162) | ✅ prod (2026-07-29 병합) |
| B | BODA 1:N(그룹) roomCode `881` + 운영자 1:1/1:N 선택 | [#167](https://github.com/amoeba-devops/appAcademy2/pull/167) | ✅ prod |
| C | 수업일정 삭제 사유·삭제목록 + 수정 히스토리 | [#168](https://github.com/amoeba-devops/appAcademy2/pull/168) | ✅ prod |
| D | 강의실 등록자→운영자(13) 참관 + 뒤로가기 링크 | [#170](https://github.com/amoeba-devops/appAcademy2/pull/170) | ✅ prod |
| D' | ↳ 등록자 운영자(13) **원복**(즉시개설 복원) | [#171](https://github.com/amoeba-devops/appAcademy2/pull/171) | ✅ prod |
| E | 공지작성 slug 400 해결 + admin i18n 네임스페이스 | [#173](https://github.com/amoeba-devops/appAcademy2/pull/173) | ✅ prod |
| F | 테넌트 메뉴 순서변경 + nav i18n + 공지 레이아웃 + 포털 배경 | [#174](https://github.com/amoeba-devops/appAcademy2/pull/174) | ✅ prod |

---

## 2. 작업별 상세

### A. BODA SPEC_823 v823.002 대응 개선 — ✅ prod(#162, 2026-07-29 병합)
벤더 원문 SPEC_823 을 현재 구현과 대조([conformance F1–F7](../reference/BODA-spec823-conformance-and-improvements-260721.md), [REQ-260722](../analysis/REQ-260722-boda-cls-spec823-improvements.md)) 후 개선.
- **F1(핵심)**: `bodaJoin` 의 `meetKey` 가 `meetIdx` 보다 우선 → 데스크톱 학생 입장이 webhook 없이 가능할 수 있음(→ **staging 실측 T0 필요**).
- 구현: `roomTitle`(수업명) 전달, 에러코드 커버리지 확대·`reason` 로깅, Mac/Mobile 설치 감지 불가 대응, `appOpt` 파라미터 개방.
- **상태**: **2026-07-29 병합·프로덕션 배포 완료**(재검토 → merge-tree clean 확인 → 브랜치 최신화 → CI 6/6 재통과 → squash 머지 `c7ff048`). 관련 문서(BODA 고정강의실 [DSN](../design/DSN-260721-boda-fixed-classroom-code.md)/[PLN-260721](../plan/PLN-260721-boda-fixed-classroom-code.md), [roomCode 추가발급 요청서](../reference/BODA-vendor-roomcode-request-260721.md), [상담 가이드](../manual/GUIDE-260721-consultation-process.md)·[수강→강의실 가이드](../manual/GUIDE-260721-enrollment-to-classroom.md))도 함께 main 반영.

### B. BODA 1:N 그룹 roomCode(881) — ✅ #167
- **문제**([FIX-260724](../bug-fix/FIX-260724-boda-group-third-participant-inactive.md)): `roomCode 699` 는 벤더 1:1 전용 룸 → 그룹 수업 3번째 참가자(2번째 학생) 화면 비활성.
- **해결**: 벤더 1:N roomCode `881` 도입. `evt_boda_room_type`(1:1/1:N) + config `groupRoomCode` + 운영자가 **수업일정 등록 시 1:1/1:N 선택**. 미설정 시 422(1:1 조용한 대체 금지).

### C. 수업일정 삭제·수정 감사 — ✅ #168
- 삭제 **사유 필수**(soft-delete + 삭제자·시각), **‘삭제한 수업일정 보기’** 토글·목록, 수정 **사유 필수** + **수정 히스토리**(변경요약). append-only revision 테이블.

### D/D'. 강의실 입장 권한 + 뒤로가기 — ✅ #170 → #171
- 뒤로가기 링크 `/` → `/portal/login`(유지).
- 등록자→운영자(13) 참관 전환(#170) 했으나 **즉시개설 미동작으로 원복(#171)** — 등록자 = 강사(11) 즉시개설 복원.
- 공지 메뉴는 코드 아닌 **테넌트 메뉴 가시성 토글**(운영 안내).

### E. 공지작성 slug 400 + admin i18n — ✅ #173
- **원인**([FIX-260728D](../bug-fix/FIX-260728D-admin-post-create-400.md)): `slug` 서버 정규식(`^[a-z0-9-]+`) 위반(한글/대문자/공백) → 400.
- **해결**: 제목 기반 **slug 자동생성**(한글이면 `post-<ts>` fallback) + 검증·오류 노출.
- **부수**: `admin` i18n 네임스페이스(admin.json)가 4 locale 부재 → 신설·등록(posts·notifications 번역 활성화).

### F. 메뉴 순서변경 + nav i18n + 공지 레이아웃 + 포털 배경 — ✅ #174
- 시스템 테넌트 메뉴 **↑/↓ 순서변경**(`tnm_order`) → admin 사이드바 반영.
- `nav.posts/notifications/enrollments` i18n 보강(raw 키 해소).
- 공지작성 레이아웃 재배치(슬러그·표지 숨김, 분류·상태·게시일 행, 삭제·저장 하단, 신규작성 상태·게시일 저장).
- 강사/학생 포털 컨텐츠 영역 흰 배경.

---

## 3. 후속·미결 (Follow-ups)

| 항목 | 내용 |
|---|---|
| ~~PR #162 병합~~ | ✅ **완료(2026-07-29)** — 병합·배포됨 |
| **T0 실측(F1)** | staging 에서 데스크톱 `bodaJoin` meetKey 단독 입장 검증 → 학생 입장 blocker 범위 확정 |
| **BODA webhook 컷오버** | A1·A2(webhook URL·IP) 벤더 회신 대기(학생 입장 정석 경로) |
| **1:N 실측** | 프로덕션 1:N 수업 개설 → 학생 2명+ 동시 활성 확인(벤더 881 정원) |
| **공지 메뉴 활성화** | `/system/tenants/<TPI>` → 메뉴 가시성 `posts` 표시 토글(운영 액션) |

---

## 4. 산출 문서 (Docs)
- 분석/계획: REQ-260722, PLN-260723·260721·260728E, DSN-260721
- 버그/원인: FIX-260724, FIX-260728D, 체크리스트-보다스쿨-설정
- 완료보고: RPT-260610B(재사용)·260723·260728(계열)·260728C·260728E
- 가이드: GUIDE-260721 상담진행 / 수강등록→강의실
- 벤더: BODA-vendor-roomcode-request-260721, BODA-spec823-conformance-260721

> (2026-07-29: A(#162) 병합으로 위 문서 전부 main 반영 완료)

---

## 5. 검증·품질
- 전 PR **CI 6/6 통과**(Lint·Unit·Integration·Docker×2·Trivy). 마이그레이션(`999h~999k`)은 CD step4 멱등 자동 적용.
- BODA 관련 백엔드 스펙·`tenant.service.spec` 등 관련 테스트 통과. FE `tsc`+`vite build` clean, i18n 4 locale 유효.
</content>
