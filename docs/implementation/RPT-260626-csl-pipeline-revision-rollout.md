---
document_id: RPT-260626-csl-pipeline-revision-rollout
version: 1.0.0
status: draft
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
  - docs/plan/PLN-260626-acm-csl-pipeline-revision.md v1.0.1
  - sql/acm/985-acm-csl-pipeline-revision.sql
change_log:
  - { version: 1.0.0, date: 2026-06-27, author: Claude, notes: "초안 — 10 PR / Phase 1-4 + T-13 + T-19 staging 배포 완료, T-06/T-08/T-20 v2 후속" }
---

# RPT-260626 — ACM CSL 파이프라인 개편 권식 보고서

> PLN-260626 v1.0.1 의 1차 권식. **Phase 1-4 (M1 데이터 + M2 백엔드 + M3 프론트) + T-13 (PDF) + T-19 (MAP→STD 승계) staging 배포 완료**. T-06 (S3) / T-08 (CAL) / T-20 v2 (전체 통합 테스트) 후속.

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

**누적 합계** (REQ-260626 만):
- 10 PR 머지 (모두 `--merge` 방식, main fast-forward)
- Backend: 25+ endpoint · 8 service · 8 신규 entity · 6 SQL 변경 (3 ALTER + 3 신규 테이블)
- Frontend: 5/5 패널 SCR-CSL-01~05 모두 라이브, 2 신규 component (TeacherAssignmentsBlock / PaymentApprovalBlock)
- i18n: 4 locale × 50+ 신규 키 (csl + common)
- Tests: jest 116 → **174 pass** (58 신규 spec)
- 인프라: `pdfkit` 추가 (backend)

---

## 2. Acceptance Criteria (FR-CSL-1xx 매핑)

### 2.1 단계 1 — 접수 (INTAKE) — ✅ 완료
| FR | 요구 | 구현 |
|---|---|---|
| FR-CSL-101 | 신청 목적 다중선택 + 기본정보 박스 표기 | csl-create-dialog (기 존재) |
| FR-CSL-102 | MAP 이전 점수 (R/M/L) 입력, **영문 라벨 고정**, 범위 100~350 | ✅ MapTestPanel@INTAKE (P4 #65) |
| FR-CSL-103 | ISEE 영역별 입력란 | ⏸ JSON textarea 로 v1 처리 (T-15 v2 — per-type 구조화 폼) |
| FR-CSL-104 | 기본정보 + 학년 초1~고3 | ✅ csl-create-dialog (기 존재) |
| FR-CSL-105 | 성적표 멀티 파일 업로드 | ⏸ TranscriptUploadStub disabled (T-06 의존) |
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
| FR-CSL-114 | CAL 스케줄에 이벤트 등록 | ⏸ `mpt_cal_event_id` 컬럼 + DTO 만 (T-08 의존 — CAL 모듈 통합) |
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
| FR-CSL-126 | 수업자료 업로드/다운로드 | ⏸ T-06 의존 (attachment 테이블 + S3) |
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
| NFR-CSL-103 | 파일 권한 분리 | ⏸ attachment 테이블 + visibility 컬럼은 P1 #59, S3 endpoint 는 T-06 의존 |
| NFR-CSL-104 | 첨부/PDF 다운로드 감사 | ⏸ PDF 다운로드는 로깅 (server log) 만, formal audit row 는 T-20 v2 |

---

## 3. Q-CSL 결정 사항 매핑

| Q | 결정 | 구현 위치 |
|---|---|---|
| Q-CSL-102 | MAP 점수 CSL 보관 → STD 승계 | ✅ T-19 #66 `StdInheritanceService` (CLASS_STARTED hook, idempotent, 정확히 1건 일치 시만 자동) |
| Q-CSL-104 | 시험별 점수항목 확정 (DSN §5.6) | ✅ T-04 #60 `level-test-score.validator.ts` (6 type schema) |
| Q-CSL-105 | 학년 초1~고3 | ✅ csl-create-dialog (기 존재) |
| Q-CSL-106 | 성적표 PDF/JPEG/PNG, ≤10MB × 최대 10개 | ✅ P1 #59 attachment CHECK 제약 |
| Q-CSL-107 | CAL 결합키 (meetKey) | ⏸ T-08 — `mpt_cal_event_id` / `tcl_cal_event_id` 컬럼만 |
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

### 4.6 T-19 MAP→STD 승계
- [ ] STD 학생 사전 생성 (동일 ent_id, 동일 이름, MAP 필드 null)
- [ ] Inquiry CLASS_STARTED 전이 (PAYMENT 승인 후)
- [ ] 동일 이름 학생의 `std_map_reading/math/language` 자동 채워짐
- [ ] 동일 이름 2명 시 변경 없음 + structured log

### 4.7 i18n
- [ ] ko/en/vi/zh-CN 4 locale 토글 시 모든 신규 라벨 번역
- [ ] R/M/L (Reading/Math/Language Usage) 라벨은 모든 locale 에서 영문 고정

---

## 5. 미해결 / 후속 작업

| Task | 비고 | 차단 사유 |
|---|---|---|
| T-06 | S3 transcript/material upload | AWS credentials 운영자 설정 필요 (env: `ACM_S3_*`) |
| T-08 | CAL meetKey 등록 | REQ-260526 모듈 통합 — 별도 PR |
| T-15 v2 | 비-MAP 타입 per-type 구조화 입력 폼 (현 v1 = JSON textarea) | UX 정교화 (현 텍스트에어리어로 기능 충족) |
| T-19 v2 | REQ-260511 §D7 전체 parent matching (name + phone) | 현 v1 = name-only conservative 매칭 |
| T-20 v2 | E2E 통합 테스트 + 정식 audit_log 통합 | 본 RPT v1 = unit spec + 운영자 매트릭스로 충족 |

---

## 6. 인프라 변동

| Item | 변경 |
|---|---|
| Backend deps | `pdfkit ^0.19.1` + `@types/pdfkit` 추가 (T-13) |
| Frontend deps | 변경 없음 |
| SQL 적용 | `sql/acm/985-acm-csl-pipeline-revision.sql` staging 자동 적용 ([apply] OK PR #59) |
| Env vars | 변경 없음 (T-06 의 `ACM_S3_*` 도입 시 영향) |

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
