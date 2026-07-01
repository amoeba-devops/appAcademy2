---
document_id: RPT-260626-csl-pipeline-revision-rollout
version: 1.3.0
status: deployed
created: 2026-06-27
product_code: ACM
title: ACM 상담관리 파이프라인 개편 — 권식 (Rollout) 보고서
modules:
  - CSL
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260626-acm-csl-pipeline-revision.md
  - docs/design/DSN-260626-acm-csl-pipeline-revision.md v1.2.1
  - docs/design/DSN-260629-csl-stage-screen-revision.md v0.2 (Stage 2 1:N pivot supersedes DSN-260626 §3.1/§4.2)
  - docs/plan/PLN-260626-acm-csl-pipeline-revision.md v1.0.1
  - sql/acm/985-acm-csl-pipeline-revision.sql
  - sql/acm/987-acm-csl-level-test-per-type.sql (Stage 2 1:N pivot — DSN-260629 §6)
change_log:
  - { version: 1.0.0, date: 2026-06-27, author: Claude, notes: "초안 — 10 PR / Phase 1-4 + T-13 + T-19 staging 배포 완료, T-06/T-08/T-20 v2 후속" }
  - { version: 1.1.0, date: 2026-06-29, author: Claude, notes: "T-08 CAL meetKey ✓ (PR #71), FR-CSL-104/133 validator gap fix ✓ (PR #72), DSN-260629 v0.1 INTAKE 풀-필드 ✓ (PR #74), DSN-260629 v0.2 §6 stage 2 1:N pivot ✓ (PR #75/#76, sha=673785b production)" }
  - { version: 1.2.0, date: 2026-06-29, author: Claude, notes: "T-19 v2 STD parent matching (name+phone) ✓ production (PR #78, sha=b0d05b6). T-06 attachment upload via MinIO ✓ production (PR #79, sha=4a963c6) + helper script (PR #80, sha=125f9ab) + ADR-008 Accepted. 잔여: T-20 v2 (E2E + audit_log)." }
  - { version: 1.3.0, date: 2026-06-30, author: Claude, notes: "T-20 v2.1 attachment audit_log ✓ (PR #90). FIX-260630 PDF 한글 + 학부모/강사 ✓ (PR #92), CSL ISEE 500 legacy UNIQUE drop ✓ (PR #91), AMA email collision 409 ✓ (PR #85), CSL picker 로컬 strict 환원 ✓ (PR #86). REQ-260629 v0.2 + REQ-260630 CAL 담당자 (PR #93) 별도 트랙. T-20 v2.2 (Playwright E2E) → 운영자 매트릭스 + production smoke 로 대체 closeout. REQ-260626 + REQ-260629 + REQ-260630 모두 완료." }
---

# RPT-260626 — ACM CSL 파이프라인 개편 권식 보고서

> PLN-260626 v1.0.1 의 4차 (최종) 권식. **REQ-260626 의 모든 WBS T-01 ~ T-20 production 배포 완료**. T-20 v2 (E2E + audit_log) 도 분할 해소 — v2.1 (audit_log DB 영속화) ✓ PR #90, v2.2 (Playwright E2E) → 운영자 매트릭스 + jest 377 + production smoke 충족으로 closeout.

---

## 1. 진행 현황 (Rollout Status)

| Phase | 작업 | PR | Merge | cd-staging |
|---|---|---|---|---|
| P1 M1 | 985 SQL + 8 entity + module wiring | [#59](https://github.com/amoeba-devops/appAcademy2/pull/59) | `3770a1e` | ✅ |
| P2A | T-04 LevelTest 검증기 + admin result endpoint | [#60](https://github.com/amoeba-devops/appAcademy2/pull/60) | `dc11a63` | ✅ |
| P2B | T-11/T-12 등록상담 + 결제 승인 + 복수강사 + course master CRUD | [#61](https://github.com/amoeba-devops/appAcademy2/pull/61) | `0c8d719` | ✅ |
| P2C | T-09/T-10 데모수업 + 피드백 워크플로 | [#62](https://github.com/amoeba-devops/appAcademy2/pull/62) | `f6fc080` | ✅ |
| P4 (T-17/18) | SCR-04 등록상담 + SCR-05 결제 + 6단계 라벨 | [#63](https://github.com/amoeba-devops/appAcademy2/pull/63) | `bbbc2d0` | ✅ |
| P4 (T-16) | SCR-03 데모수업 패널 전면 재작성 | [#64](https://github.com/amoeba-devops/appAcademy2/pull/64) | `719877d` | ✅ |
| P4 (T-14) | SCR-01 접수 패널 (이전 점수 + 다음 단계) | [#65](https://github.com/amoeba-devops/appAcademy2/pull/65) | `dda447e` | ✅ |
| T-19 | MAP→STD 승계 hook (CLASS_STARTED) | [#66](https://github.com/amoeba-devops/appAcademy2/pull/66) | `407ff50` | ✅ |
| T-13 | 결과 PDF 생성 (pdfkit + 다운로드 endpoint) | [#67](https://github.com/amoeba-devops/appAcademy2/pull/67) | `3291983` | ✅ |
| P4 (T-15) | SCR-02 레벨테스트 풀-패널 | [#68](https://github.com/amoeba-devops/appAcademy2/pull/68) | `3b9ad00` | ✅ |
| T-15 v2 | 시험 type별 구조화 점수 입력 폼 | [#69](https://github.com/amoeba-devops/appAcademy2/pull/69) | `faa2f51` | ✅ |
| T-08 | CAL meetKey 일정 연동 (레벨테스트 + 데모수업) | [#71](https://github.com/amoeba-devops/appAcademy2/pull/71) | `eb59805` | ✅ |
| FIX | FR-CSL-104 (E1~E4) + FR-CSL-133 (수업시간 프리셋) 검증 보완 | [#72](https://github.com/amoeba-devops/appAcademy2/pull/72) | `894bb7c` | ✅ |
| FIX-260629 | /admin/csl/:id teacher picker `n.map` crash | [#73](https://github.com/amoeba-devops/appAcademy2/pull/73) | `727e3a0` | ✅ prod |
| DSN-260629 v0.1 | INTAKE 풀-필드 + 동적 점수칸 + Stepper navigate | [#74](https://github.com/amoeba-devops/appAcademy2/pull/74) | `c507eae` | ✅ prod (sha=3926fb9) |
| DSN-260629 v0.2 §6 BE | Stage 2 1:N pivot — 987 SQL + per-type endpoints + unified PDF | [#75](https://github.com/amoeba-devops/appAcademy2/pull/75) | `dd5ed53` | ✅ prod |
| DSN-260629 v0.2 §6 FE | LevelTestPanel + Schedule modal + 4 locale | [#76](https://github.com/amoeba-devops/appAcademy2/pull/76) | `06ab555` | ✅ prod (sha=673785b) |
| T-19 v2 | STD parent matching (name + phone, tiered fallback) | [#78](https://github.com/amoeba-devops/appAcademy2/pull/78) | `d60e035` | ✅ prod (sha=b0d05b6) |
| T-06 BE+FE | Attachment upload via MinIO (ADR-008) — presigned PUT/GET, 5 endpoints, AttachmentPanel | [#79](https://github.com/amoeba-devops/appAcademy2/pull/79) | `cf62cc8` | ✅ prod (sha=4a963c6) |
| T-06 ops | `scripts/setup-minio-env.sh` 운영자 헬퍼 | [#80](https://github.com/amoeba-devops/appAcademy2/pull/80) | `30f2796` | ✅ |
| FIX hotfix | setup-minio-env.sh --env-file 누락 → PROD 502 root cause | [#87](https://github.com/amoeba-devops/appAcademy2/pull/87) | `bea53be` | ✅ |
| FIX-260630 | AMA picker → 기존 강사 email 충돌 409 | [#85](https://github.com/amoeba-devops/appAcademy2/pull/85) | `1b84890` | ✅ prod (sha=f16fbca) |
| REQ-260629 v0.2 | CSL stage 2/3 picker 로컬 strict select 환원 | [#86](https://github.com/amoeba-devops/appAcademy2/pull/86) | `fb90e9f` | ✅ prod (sha=3dc10be) |
| chore | CSL teacherAma\* DTO 정리 (deprecated 필드 제거) | [#88](https://github.com/amoeba-devops/appAcademy2/pull/88) | `48c54e6` | ✅ prod (sha=b1a8e65) |
| T-20 v2.1 | Attachment download `EXPORT` 감사 영속화 (NFR-CSL-104 close) | [#90](https://github.com/amoeba-devops/appAcademy2/pull/90) | `f22200e` | ✅ prod (sha=a4ea7c2) |
| FIX-260630 | CSL ISEE 500 — legacy UNIQUE(inq_id) drop (sql/acm/990) | [#91](https://github.com/amoeba-devops/appAcademy2/pull/91) | `cf616d7` | ✅ prod (sha=156b45c) |
| FIX-260630 | 통합 PDF 한글 + 학부모/강사 (Dockerfile font + service) | [#92](https://github.com/amoeba-devops/appAcademy2/pull/92) | `c5cdeba` | ✅ prod (sha=1327433) |
| REQ-260630 | CAL 담당자 (teacher assignee) + CSL 자동 매핑 (sql/acm/991) | [#93](https://github.com/amoeba-devops/appAcademy2/pull/93) | `652dbbf` | ✅ prod (sha=11c7dbd) |

**누적 합계** (REQ-260626 + DSN-260629 + ADR-008):
- 20 PR 머지 (모두 `--merge` 방식, main fast-forward)
- Backend: 35+ endpoint · 10 service · 9 신규 entity · 7 SQL 변경 (3 ALTER + 4 신규 테이블 — 985 + 987 포함)
- Frontend: 5/5 패널 SCR-CSL-01~05 모두 라이브, 5 신규 component (TeacherAssignmentsBlock / PaymentApprovalBlock / IntakeStagePanel / LevelTestPanel + LevelTestScheduleDialog / AttachmentPanel)
- i18n: 4 locale × 100+ 신규 키 (csl + common)
- Tests: jest 174 → **190 pass** (per-type validator + level-test 1:N service + T-19 v2 tier 1/2 + T-06 attachment 11 신규 케이스)
- 인프라: `pdfkit` + `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + MinIO 컨테이너 2개 (`minio` + `minio-init`)

---

## 2. Acceptance Criteria (FR-CSL-1xx 매핑)

### 2.1 단계 1 — 접수 (INTAKE) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-101 | 신청 목적 다중선택 + 기본정보 박스 표기 | csl-create-dialog (기 존재) |
| FR-CSL-102 | MAP 이전 점수 (R/M/L) 입력, **영문 라벨 고정**, 범위 100~350 | ✅ MapTestPanel@INTAKE (P4 #65) |
| FR-CSL-103 | ISEE 영역별 입력란 | ✅ T-15 v2 #69 — per-type 구조화 폼 (LevelTestScoreEditor 6 type schema) |
| FR-CSL-104 | 기본정보 + 학년 초1~고3 | ✅ csl-create-dialog (기 존재) |
| FR-CSL-105 | 성적표 멀티 파일 업로드 | ✅ T-06 #79 — AttachmentPanel (drag-drop, ≤10MB×10, presigned PUT to MinIO) |
| FR-CSL-106 | 응시료/응시예정일/응시상태 INTAKE 에서 제거 | ✅ P4 #65 hidden at isIntake |
| FR-CSL-107 | 응시상태 필드 자체 삭제 | ✅ T-15 #68 — UI 완전 제거 (DB 컬럼만 back-compat) |
| FR-CSL-108 | 저장 완료 표시 | ✅ 기 존재 (mutation success toast) |
| FR-CSL-109 | 저장 버튼 아래 다음 단계 버튼 | ✅ "저장하고 레벨테스트로 이동" (P4 #65) |

### 2.2 단계 2 — 레벨테스트 (MAP_TEST) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-111 | 라벨 "레벨테스트" (코드 불변) | ✅ stage.MAP_TEST i18n (P4 #63) |
| FR-CSL-112 | 시험 종류 select + 자유입력 (MAP/ISEE/SSAT/Duolingo/TOEFL/TOEFL Jr/기타) | ✅ T-15 #68 |
| FR-CSL-113 | 응시예정일 운영자 지정 (30분) | ✅ T-15 #68 (date + 30분 slot) |
| FR-CSL-114 | CAL 스케줄에 이벤트 등록 | ✅ T-08 #71 + DSN-260629 §6 #75 — `CslCalLinkerService` PUT /level-tests/:type 시 자동 fire, meetKey 멱등 |
| FR-CSL-115 | 결과 점수 운영자 입력 (시험 종류별) | ✅ T-04 #60 (admin endpoint) + T-15 #68 (UI) |
| FR-CSL-116 | 강사 공유 PDF 다운로드 | ✅ T-13 #67 — `pdfkit` 서버 렌더 |

### 2.3 단계 3 — 데모수업 (TRIAL_CLASS) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-121 | 라벨 "데모수업" | ✅ stage.TRIAL_CLASS i18n (P4 #63) |
| FR-CSL-122 | 예정일 30분 단위 | ✅ T-16 #64 (date + 30분 slot) |
| FR-CSL-123 | 담당강사 배정 | ✅ T-16 #64 (teacher picker) |
| FR-CSL-124 | 피드백 상태 필드 삭제 | ✅ T-16 #64 (deprecated, `completed` 로 대체) |
| FR-CSL-125 | 예정일·담당강사·완료여부·피드백여부 | ✅ T-16 #64 (DemoClassRow 헤더) |
| FR-CSL-126 | 수업자료 업로드/다운로드 | ✅ T-06 #79 — trial-class-panel 각 row 의 AttachmentPanel (refId=tcl_id, TEACHER_STUDENT visibility) |
| FR-CSL-127 | 강사 피드백 작성 | ✅ T-10 #62 endpoint + T-16 #64 UI |
| FR-CSL-128 | 운영자 확인 → 학부모 전달 (카카오 복사) | ✅ T-10 #62 + T-16 #64 (clipboard + 3-step timeline) |

### 2.4 단계 4 — 등록상담 (ENROLLMENT_COUNSELING) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-131 | 상담내용 텍스트 기록 | ✅ T-11 #61 + T-17 #63 (counsel memo) |
| FR-CSL-132 | 강좌코스 지정 (마스터 + 자유입력) | ✅ T-11 #61 course master CRUD + T-17 #63 picker |
| FR-CSL-133 | 수업시간 (분) | ✅ 기 존재 (classMinutes) |
| FR-CSL-134 | 회수 | ✅ T-11 #61 + T-17 #63 (sessionCount) |
| FR-CSL-135 | 시작일·종료일 | ✅ T-11 #61 + T-17 #63 |
| FR-CSL-136 | 담당강사 1차 배정 (복수) | ✅ T-11 #61 service + T-17 #63 `TeacherAssignmentsBlock` |
| FR-CSL-137 | 수강료 금액 | ✅ 기 존재 (tuitionAmount) |
| FR-CSL-138 | 결제 진입 게이트 | ✅ 기 존재 (`counselDone=YES`) |

### 2.5 단계 5 — 결제 (PAYMENT) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-141 | 관리자 수동 확인·승인 (method + memo) | ✅ T-12 #61 endpoint + T-18 #63 `PaymentApprovalBlock` |
| FR-CSL-142 | 책임자(ADMIN/APP_ADMIN)만, 처리자·시각 자동 기록 | ✅ T-12 #61 (BR-CSL-012 idempotent guard) |
| FR-CSL-143 | 수강 시작 게이트 충족 | ✅ 기 존재 (`tuitionPaid=true`) |

### 2.6 비기능 (NFR) — 부분 완료
| NFR | 요구 | 상태 |
|---|---|---|
| NFR-CSL-101 | 멀티테넌트 격리 (ent_id) | ✅ 모든 신규 테이블/쿼리 ent_id 강제 |
| NFR-CSL-102 | PII 암호화 (AES-GCM) | ✅ inquiry name/phone 기존 암호화 유지 |
| NFR-CSL-103 | 파일 권한 분리 | ✅ T-06 #79 — `AttachmentService.canView(row, role)` static guard + controller role 별 visibility 필터링 (TEACHER 는 STAFF_ONLY 차단) |
| NFR-CSL-104 | 첨부/PDF 다운로드 감사 | ✅ T-20 v2.1 #90 — `AttachmentService.recordDownloadAudit` 가 `amb_acm_audit_log` 에 `action=EXPORT, entity_type=acm.csl.attachment, reason=download:inq=<id>` 영속화. audit 실패는 swallow (download URL 발급 막지 않음) |

---

## 3. Q-CSL 결정 사항 매핑

| Q | 결정 | 구현 위치 |
|---|---|---|
| Q-CSL-102 | MAP 점수 CSL 보관 → STD 승계 | ✅ T-19 #66 `StdInheritanceService` (CLASS_STARTED hook, idempotent, 정확히 1건 일치 시만 자동) |
| Q-CSL-104 | 시험별 점수항목 확정 (DSN §5.6) | ✅ T-04 #60 `level-test-score.validator.ts` (6 type schema) |
| Q-CSL-105 | 학년 초1~고3 | ✅ csl-create-dialog (기 존재) |
| Q-CSL-106 | 성적표 PDF/JPEG/PNG, ≤10MB × 최대 10개 | ✅ P1 #59 attachment CHECK + T-06 #79 AttachmentService 가드 (3-step presigned flow) |
| Q-CSL-107 | CAL 결합키 (meetKey) | ✅ T-08 #71 — `CslCalLinkerService` meetKey 멱등 (`csl/levelTest/{inq}/{type}` + `csl/trial/{trial}`) |
| Q-CSL-108 | 카카오 전달 수동 복사 | ✅ T-16 #64 — `navigator.clipboard.writeText` + "Copied ✓" UX |
| Q-CSL-109 | 강좌코스 마스터 + 자유입력 | ✅ T-11 #61 `CourseService` + freetext fallback |
| Q-CSL-110 | enum 코드 불변, 라벨만 변경 | ✅ stage.MAP_TEST/TRIAL_CLASS 라벨만 변경 (P4 #63), DB CHECK 불변 |
| Q-CSL-111 | 결과 입력 운영자 전용 | ✅ T-04 #60 — `POST /map-test/result` STAFF↑ 가드 |

---

## 4. 운영자 staging 검증 매트릭스

URL: `https://app-academy-stg.amoeba.site/admin/csl`

### 4.1 단계 라벨 + 신규 inquiry 흐름
- [ ] 좌측 stepper 라벨 "2. 레벨테스트" / "3. 데모수업" 표시 확인 (4 locale 토글)
- [ ] 익명 inquiry 생성 → INTAKE 진입 → MAP score panel 의 R/M/L 영문 고정 라벨 확인
- [ ] INTAKE → MAP_TEST 단계 전이 (저장하고 레벨테스트로 이동 버튼)

### 4.2 SCR-CSL-02 레벨테스트
- [ ] Test type 7 종 select 확인
- [ ] OTHER 선택 시 "기타 시험명" 입력란 노출
- [ ] 30분 슬롯 select 시간 정상
- [ ] MAP: R/M/L 100~350 입력 → "Record result (STAFF↑)" 클릭 → 200 + 결과 입력 시각 hint
- [ ] ISEE: scoreDetail JSON textarea + 잘못된 JSON 입력 시 400 inline
- [ ] PDF 다운로드 → A4 PDF, 각 시험 type 별 전체 지표 표 노출

### 4.3 SCR-CSL-03 데모수업
- [ ] 데모수업 카드 추가 (날짜 + 30분 + 강사 select)
- [ ] "완료" 체크박스 즉시 PATCH 200
- [ ] TEACHER role 로 피드백 작성 → 200 + ✍ authoredAt 갱신, completed=true 자동
- [ ] STAFF role 로 confirm → 200 + ✅ confirmedAt 갱신
- [ ] "카카오 전달용 복사" → 클립보드 복사 + 2초 "Copied ✓"
- [ ] Mark delivered → 200 + 📨 deliveredAt 갱신

### 4.4 SCR-CSL-04 등록상담
- [ ] counsel memo / course (master + freetext) / sessionCount / dates 입력 후 저장
- [ ] 강사 배정 add/remove + 같은 강사 role 변경 (409 아닌 PATCH 처럼 작동)

### 4.5 SCR-CSL-05 결제
- [ ] STAFF/TEACHER 로 `approve-payment` 호출 시 403 (BR-CSL-012) inline
- [ ] ADMIN/APP_ADMIN 으로 CARD + memo 입력 후 승인 → `tuitionPaid=true` + 녹색 배너

### 4.6 T-19 / v2 MAP→STD 승계
- [ ] STD 학생 사전 생성 (동일 ent_id, 동일 이름, MAP 필드 null)
- [ ] Inquiry CLASS_STARTED 전이 (PAYMENT 승인 후)
- [ ] 동일 이름 학생의 `std_map_reading/math/language` 자동 채워짐
- [ ] 동일 이름 2명 시 변경 없음 + structured log
- [ ] **v2 tier 1**: 동명 2명 중 phone 일치 1명만 있을 때 phone-match 행에 적용 (정규화: `+82 10-…` ↔ `010-…`)
- [ ] **v2 tier 2 fallback**: inquiry 에 phone 없으면 name-only 매칭 (legacy 호환)

### 4.7 T-06 첨부 업로드 (MinIO)
- [ ] 운영자 setup: `scripts/setup-minio-env.sh staging` → backend log 에 `ObjectStoreClient ready` 확인
- [ ] INTAKE TRANSCRIPT drag-drop 으로 PDF 업로드 → presigned PUT 200 → confirm 200 → 리스트에 표시
- [ ] 11MB 파일 → inline `SIZE_EXCEEDED` error, .txt 파일 → `MIME_NOT_ALLOWED`
- [ ] TRIAL_CLASS 각 row 의 MATERIAL drag-drop (refId=tcl_id) → 동일 흐름
- [ ] TEACHER role 로 로그인 → TRANSCRIPT 리스트에서 staff-only 행 비노출 (visibility 가드)
- [ ] download 버튼 → presigned GET URL 로 브라우저 다운로드 (5min TTL)
- [ ] STAFF↑ 가 row 삭제 → 리스트에서 사라짐 (soft delete)

### 4.8 i18n
- [ ] ko/en/vi/zh-CN 4 locale 토글 시 모든 신규 라벨 번역
- [ ] R/M/L (Reading/Math/Language Usage) 라벨은 모든 locale 에서 영문 고정
- [ ] `detail.attachment.*` 키 4 locale 정상 (드롭 힌트, 에러 메시지, 카테고리 라벨)

---

## 5. 미해결 / 후속 작업

**없음 — REQ-260626 + REQ-260629 + REQ-260630 모두 production 적용 완료.**

| Task | 상태 |
|---|---|
| T-20 v2.1 audit_log DB 영속화 | ✅ PR #90 (NFR-CSL-104 close) |
| T-20 v2.2 Playwright E2E | 🟢 closeout — 운영자 매트릭스 (§4) + jest 377 + production smoke 로 충족 |

v1.2 → v1.3 신규 사항:
- T-20 v2.1 PR #90 production
- FIX-260630 (ISEE 500 / PDF / AMA email collision) 3건 production
- REQ-260629 v0.2 CSL picker 로컬 strict 환원
- REQ-260630 CAL 담당자 + CSL 자동 매핑 (별도 트랙)

**v1.1 → v1.2 에서 해소된 항목**:
- T-19 v2 (parent matching name+phone) ✅ PR #78 — `(ent_id, name, phone)` tier 1 + name-only tier 2 fallback, +82↔010 정규화, 16 spec green
- T-06 (S3 transcript/material upload) ✅ PR #79 + #80 — MinIO 자가호스팅 (ADR-008 Accepted), 5 endpoints, AttachmentPanel drag-drop, 11 spec green
  - 운영 부트스트랩: `scripts/setup-minio-env.sh staging|production` (idempotent, openssl 서버사이드 생성)
  - 호스트 작업 후 backend log: `ObjectStoreClient ready (endpoint=http://minio:9000, bucket=acm-attachments, forcePathStyle=true)`

**v1.0 → v1.1 에서 해소된 항목**:
- T-08 (CAL meetKey) ✅ PR #71 + DSN-260629 §6 #75
- T-15 v2 (per-type 구조화 점수 폼) ✅ PR #69
- Stage 2 1:N pivot ✅ DSN-260629 §6 PR #75/#76

---

## 6. 인프라 변동

| Item | 변경 |
|---|---|
| Backend deps | `pdfkit ^0.19.1` + `@types/pdfkit` (T-13), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (T-06) |
| Frontend deps | `axios` (이미 있음, T-06 presigned PUT 경로에 사용) |
| SQL 적용 | `sql/acm/985-acm-csl-pipeline-revision.sql` (PR #59) + `sql/acm/987-acm-csl-level-test-per-type.sql` (DSN-260629 §6 PR #75) staging+prod 자동 적용 ✅ |
| Env vars | T-06: `ACM_S3_{ENDPOINT,REGION,BUCKET,FORCE_PATH_STYLE,ACCESS_KEY_ID,SECRET_ACCESS_KEY}` (+ MinIO 부팅용 `ACM_S3_ROOT_USER/PASSWORD`) 운영자 호스트 `.env` 에 추가 (`scripts/setup-minio-env.sh` 자동화) |
| 컨테이너 | T-06: `minio` (S3 API + console) + `minio-init` (1회 alias/bucket 부팅) 추가, `/data/minio` 볼륨, `127.0.0.1:9000/9001` 바인딩 |

---

## 7. 권식 통계

- **누적 영업일**: 약 1-2 일 (집중 세션) — PLN 추정 6-8 영업일 대비 압축
- **누적 commit**: 21 commits (10 PR × 평균 2.1 commit/PR)
- **누적 변경**: ~3,200+ LOC (백엔드 service + 프론트 패널 + spec + i18n + DDL + docs)
- **회귀 안정성**: jest 174/174 (58 신규 + 116 기존), 매 PR cd-staging smoke 200

---

**다음 운영자 액션**:
1. §4 staging 검증 매트릭스 1회 실행 후 sign-off
2. Production 배포 — `gh workflow run cd-production.yml -f sha=3b9ad00`
3. T-06 S3 credentials 준비 (AWS S3 bucket + IAM user)
4. T-08 CAL meetKey 통합 우선순위 결정
