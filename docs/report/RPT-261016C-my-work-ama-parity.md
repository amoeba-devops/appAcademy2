---
document_id: ACM-MY-WORK-AMA-PARITY-RPT-1.0.0
version: 1.1.0
status: Deployed
created: 2026-10-16
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Staging/production deployed, migration verified / 양환경 배포·이전 확인
  - version: 1.0.0
    date: 2026-10-16
    description: My Work / issue form AMA parity + AMA TPI01 issue migration report / 내 업무·이슈 작성 AMA 동일화 및 이슈 이전 구현 보고
---
# My Work AMA Parity & Issue Migration Report (내 업무 AMA 동일화 · 이슈 이전 구현 보고)

요구사항 [REQ-261016C](../analysis/REQ-261016C-my-work-ama-parity.md) · 계획 [PLN-261016C](../plan/PLN-261016C-my-work-ama-parity.md)

## 1. Status (상태)
| 항목 | 상태 |
|------|------|
| 구현·테스트 | 완료 — PR #337 머지 `16f4bca` |
| 배포 | **staging·production 완료**(2026-10-16). CD 로그 `1040`·`1041` apply OK, smoke 200 |
| 이슈 3건 운영 반영 | **완료** — acm.amoeba.site 테넌트 …0001 ‘학원운영’에 ISS-3·4·5 |
| 결정 사항 | Q1 AMA 전용 기능 1차 제외 · Q2 같은 이름 프로젝트 · Q3 멘션·AI 번역 2차 · Q4 AMA 운영 DB SELECT 1회 |

## 2. Changes (구현)
### 2.1 내 업무 `/admin/my-work` — AMA MyWorkPage 구성·색상
- **헤더:** 제목 + "내 담당 n건 · 그중 지연 n건", 보기 탭(오늘 / 내 프로젝트 / 칸반, 선택 indigo-600), `+ 새 업무`.
- **KPI 6칸:** 내 담당 이슈(indigo, 강조) · 오늘 배정(violet) · 담당 지연(red) · 오늘 마감(orange) · 7일 내 마감(sky) · 오늘 완료(green). 색 점 + 모노 숫자, 클릭하면 필터.
  - AMA의 ‘검토 요청’은 ACM에 TEST 상태가 없어 ‘7일 내 마감’으로 대체.
- **관계 칩:** 내 담당 / 내가 생성 / 참여 (건수). AMA ‘알림 받음’은 ACM에 Watcher가 없어 제외.
- **목록:** 오늘 처리(지연·오늘 마감 사유 배지) → 출처별 섹션(배정받은 이슈 indigo · 내가 작성한 내 이슈 sky · 내가 만든 응답 대기 gray · 오늘 완료 green, 접기).
- **행:** 담당 indigo 띠, 선택 체크, 원형 완료(green), 유형 칩(rose ‘이’), P1/P2, `ISS-n`, 담당·사유 배지, 프로젝트·상태, 배정일/경과일, D-day(지연 red · 오늘 orange · 7일 내 indigo), 시작 버튼, 상위 이슈 링크.
- **우측 패널(340px):** 업무 상세 [상세 | 이력].
- **완료:** 확인 모달에서 완료/반려 선택, 다건 선택 시 하단 바로 일괄 완료(최대 50건, 항목별 결과 안내).
- 칸반(대기·진행중·완료 3열), 내 프로젝트(프로젝트 표 + 선택 프로젝트 업무).
- 날짜는 테넌트 타임존 기준. 보기·관계 선택은 브라우저에 기억.

### 2.2 이슈 등록/수정 — AMA IssueFormModal 구성
- 순서: 프로젝트·상위 이슈(검색) → 유형 → 제목 → 설명(리치 텍스트 툴바) → 우선순위·담당자(검색, 기본=나) → 관련자(다중) → 파일 첨부 [파일 업로드 | URL 등록] → 해결 방법(수정 시) → 시작일·마감일·진행률(10% 단위).
- 임시 저장: 3초마다 브라우저 저장, 다시 열면 복원/삭제 배너(amber).
- 첨부 업로드는 기존 프로젝트 파일 업로드(회사 Google Drive 또는 ACM 저장소)를 재사용.
- 이슈 상세: `ISS-n` 번호, 리치 텍스트 설명, 진행률, 상위 이슈, 관련자, 첨부, 해결 방법, 이전 출처(“AMA ISN-23에서 이전”).
- 이슈 목록·칸반: 번호 표시, `ISS-n`/숫자 검색.

### 2.3 Backend · DB
- **1040** `amb_acm_prj_item` 확장: `pit_ref_no`(테넌트별 채번 테이블 + INSERT 트리거, 기존 이슈 백필), `pit_parent_id`, `pit_done_ratio`, `pit_resolution`, `assigned_at`, `pit_source`/`pit_source_ref`. 신규 `amb_acm_prj_issue_participant`, `amb_acm_prj_issue_attachment`.
- 저장 검사: 상위 이슈는 같은 프로젝트·자기 자신/하위 지정 금지(순환 차단), 관련자는 프로젝트 참여자(담당자 제외), 첨부 파일은 같은 프로젝트 파일, URL은 http(s). 생략한 항목은 기존 값 유지, 담당 변경 시 배정 시각 갱신.
- 내 업무 API: 참여 이슈 포함, 번호·상위·참여자·배정 시각 반환.

### 2.4 i18n
- `myWork.*` 전면 교체, `issues.form.*`·`issues.fields.*` 확장. ko·en·vi는 AMA 문구, zh-CN 번역. 4개 언어 키 일치 확인.

## 3. Issue Migration (이슈 이전)
AMA 운영 DB에서 TPI01(`928f5fe4-…`) 이슈를 **SELECT로만** 추출했다. AMA 원본은 변경하지 않았다.

| AMA | 제목 | 상태 | ACM 프로젝트 | 등록 → 담당 | 관련자 | 마감 | 진행률 | 댓글 |
|-----|------|------|-------------|-------------|--------|------|--------|------|
| ISN-8 | 김준연 학생 컨설팅 프로세스 완료 시기 체크 | 진행(P2) | 학원운영 | tpimorgan → tpijung | — | 10-05 | 0% | 5 |
| ISN-18 | 데일리 학생 팔로업 컨택트 | 진행 | 학원운영¹ | tpimorgan → tpiyeri | tpijung | — | 0% | 0 |
| ISN-23 | 학생 불참 시 TPI 연락 책임 없도록 가이드 변경 | 진행 | 학원운영 | tpimorgan → tpiyeri | tpijung, tpimorgan | 10-14 | 100% | 3 |

¹ AMA에서 프로젝트가 없어 ‘학원운영’에 배치. ACM 운영 프로젝트명은 공백 없는 ‘학원운영’이라 이름 비교 시 공백을 무시한다.

- **방식:** `sql/acm/1041-prj-issue-import-ama-tpi01.sql` — CD가 배포 시 자동 적용. `(테넌트, 'AMA', 'TPI01#ISN-n')` 기준 멱등.
- **사람:** 이메일로 ACM 사용자와 매칭. 없으면 테넌트 마스터(admin@tpi.co.kr)로 대체하고, 원래 이메일을 본문·댓글 끝에 기록. 매칭된 사람은 프로젝트 참여자로 추가.
- **프로젝트:** 같은 이름(공백 무시)의 ACM 프로젝트를 쓰고, 없으면 만든다. 운영에는 ‘학원운영’이 있어 새 프로젝트는 만들지 않는다.
- **상태 이력:** AMA 단계(APPROVED·RESOLVED·REOPEN 등)를 ACM 4단계로 변환하고, 같은 상태로의 전이는 생략.
- **댓글:** HTML을 텍스트로 변환(ACM 댓글은 텍스트). 작성 시각 유지.
- **안전장치:** 테넌트 마스터 계정이 없는 환경(스테이징 등)에서는 아무 것도 하지 않음.

## 4. Verification (검증)
- Backend: `tsc` 0 error, eslint 0, 단위 8/8.
- 통합 `it-prj-issues` **9/9**: 1040 두 번 적용 시 번호 불변, 번호 검색, 상위 순환·자기 지정 거부, 비참여자 관련자 거부, 담당자의 관련자 제외, 관련자의 내 업무 노출, URL 첨부 저장·교체, 담당 변경 시 배정 시각 갱신, 생략 항목 유지.
- Frontend: `tsc`·`vite build` 통과.
- 로컬 DB **사본**(`db_acm_issue_test`)에 1040·1041 적용 → 3건 생성, 재실행 시 중복 없음.
- 로컬 앱(헤드리스 브라우저)에서 확인: 내 업무 KPI·관계 칩·목록·우측 상세, 이슈 등록 모달, 칸반, 이슈 상세(설명·댓글 3건·진행률 100%·출처 표시).

## 5. Open Items (남은 일)
| # | 내용 | 담당 |
|---|------|------|
| 1 | ~~ACM 계정 확인~~ — **확인 완료(2026-10-16):** tpimorgan·tpijung·tpiyeri 모두 테넌트 …0001 에 ACTIVE·AMA 연동 계정이 있어 생성 불필요. 운영과 같은 조건(계정 3개·‘학원운영’ 프로젝트)으로 로컬 리허설 → 담당·등록·관련자 모두 매칭, 대체 없음 | 완료 |
| 2 | ~~배포~~ 완료 — 아래 §6 | 완료 |
| 3 | 오늘의 미션·개인 할 일·내 성과·멘션·AI 번역은 **진행하지 않기로 결정**(2026-10-16) | — |
| 4 | 참고: `1035`가 사전순으로 `999x`보다 먼저 실행되어 빈 DB에서 실패(기존 문제, 운영 영향 없음) | 별도 FIX |
| 5 | 로컬 정리: `acm-postgres`의 `db_acm_issue_test` 삭제 가능 | 사용자 |

## 6. Deployment (배포 결과)
- PR #337 → main `16f4bca` → CD Staging 성공(1040·1041 apply OK) → CD Production(run 38902169475) 성공, smoke 200.
- `/admin/my-work` 200, `/api/acm/prj/my-work` 무인증 401(라우트 배포 확인).
- 운영 DB 확인(읽기 전용):

| ACM | AMA | 프로젝트 | 상태 | 등록 → 담당 | 관련자 | 마감 | 진행률 | 댓글 | 대체 |
|-----|-----|----------|------|-------------|--------|------|--------|------|------|
| ISS-3 | ISN-8 | 학원운영 | 진행 | tpimorgan → tpijung | — | 10-05 | 0% | 5 | 없음 |
| ISS-4 | ISN-18 | 학원운영 | 진행 | tpimorgan → tpiyeri | tpijung | — | 0% | 0 | 없음 |
| ISS-5 | ISN-23 | 학원운영 | 진행 | tpimorgan → tpiyeri | tpijung, tpimorgan | 10-14 | 100% | 3 | 없음 |

- 새 프로젝트는 만들어지지 않았다(기존 ‘학원운영’ 사용). ISS-1·2 는 기존 ACM 이슈(번호 백필).
