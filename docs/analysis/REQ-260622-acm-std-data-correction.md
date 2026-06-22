---
document_id: REQ-260622-acm-std-data-correction
version: 1.0.0
status: Draft
created: 2026-06-22
product_code: ACM
title: ACM 학생정보 데이터 정비(마이그레이션 후속) 요구사항 분석서
modules:
  - STD (Student·Parent Management / 학생·학부모관리)
related:
  - docs/analysis/REQ-260621-acm-std-student-fields-extension.md   # 940 스키마 확장 (선행)
  - docs/analysis/REQ-260511-student-parent-link.md                # 학부모 N:M + §D7 매칭
  - docs/analysis/REQ-260506-acm-tch-stf-cal.md                    # 강사 마스터 (FK 대상)
  - sql/acm/940-acm-std-student-extension.sql                      # 종료 라이프사이클 + std_teacher_id 컬럼
  - sql/acm/941-seed-tpi-std-students-202606.sql                   # TPI/Santa Croce 5시트 시드 (정비 대상)
  - reference/BODA_API_TPI/                                        # 원본 출처 보관
change_log:
  - { version: 1.0.0, date: 2026-06-22, author: Claude, notes: "초안 — 941 시드 후 잔존 데이터 품질 이슈 10종(DQ-1~10) 인벤토리 + 정비 기능요구(FR-DC) + 인수기준 + 미결사항" }
---

# REQ-260622 — ACM 학생정보 데이터 정비 요구사항 분석서
## (Student Data Correction — Post-Migration Cleanup)

---

## 1. 개요 (Overview)

`941-seed-tpi-std-students-202606.sql` 가 **TPI 학생 정보-202606.xlsx 5개 시트**(현재 등록 ·
수업 종료 · 구 학생 정보 · 학부모/학생 상담 · Santa Croce)를 `940` 확장 스키마로 머지·시드했다.
시드는 정상 적재됐으나, 원본 엑셀의 구조적 한계로 **운영 사용 전 정비가 필요한 데이터 품질
이슈가 다수 잔존**한다. 본 문서는 그 이슈를 **실 시드 데이터 기준으로 인벤토리화**하고, 정비
작업의 요구사항·인수기준·미결사항을 정의한다.

> **핵심 결론**: 잔존 이슈는 (a) **기계적·무판단 교정**(전화번호 필드 오염, 비학생 garbage row)과
> (b) **사람의 판단이 필요한 교정**(종료사유 enum 분류, 강사 FK 매핑, 학부모 백필, 동명이인
> 검증)으로 갈린다. → (a)는 멱등 SQL 스크립트, (b)는 **운영자용 정비(triage) UI**로 처리하는
> **하이브리드**를 권고한다 (작업계획서 PLN-260622 참조).

### 1.1 시드 결과 요약 (941 적재 기준)

| 구분 | 수치 | 비고 |
|------|------|------|
| 학생 INSERT (총) | 131건 | TPI 119 + Santa Croce 12 |
| TPI 테넌트 | `…-001` | 현재 24 + 종료 16 + 구학생 97 → 이름 중복 머지 후 119 |
| Santa Croce 테넌트 | `…-002` | 신규 등록 12 |
| 상담 메모 머지 | 23건 중 14 UPDATE | 9건은 상담 필드 전부 공란 → skip |
| 적재 상태 분포 | ACTIVE 36 · WITHDRAWN 95 | INACTIVE 0 |
| 학부모 row | **0건** | 시트에 학부모 정보 부재 (DQ-5) |

---

## 2. 배경 (Background)

- 941 의 머지 우선순위: **현재 등록(30) > 수업 종료(20) > 구 학생 정보(10)**. 이름 충돌 시
  상위 우선순위가 덮고, NULL 은 하위에서 `COALESCE` 보충.
- `ON CONFLICT (ent_id, std_name)` UPSERT → **이름이 자연키**다. 따라서 **동명이인**이 한 row 로
  병합될 구조적 위험이 있다 (DQ-6).
- 종료 사유는 **모두 `std_end_reason='OTHER'`** 로 통일하고 원문을 `std_end_note` 에 보존했다
  (사용자 합의 — 후속 운영자 분류).
- 강사는 `std_teacher` free-text 유지, `std_teacher_id` 는 **전건 NULL** (강사 마스터 매핑 미수행).
- 본 작업의 선행 스키마(940)·필드 매핑·학부모 필수 enforcement 설계는 **REQ-260621** 에 있다.
  본 문서는 그 **데이터(행) 측면의 정합성**만 다룬다.

---

## 3. 목표 / 비목표 (Goals / Non-Goals)

### 3.1 Goals
1. 941 시드 잔존 데이터 품질 이슈를 **빠짐없이 식별**하고 룰(DQ-1~10)로 정의한다.
2. 각 이슈를 **기계적 교정(SQL)** vs **판단 교정(운영자 UI)** 으로 분류한다.
3. 정비 과정이 **멱등·테넌트 격리·감사로그·롤백 가능**을 만족하도록 요구한다.
4. 운영자가 "무엇이 얼마나 남았는지" 볼 수 있는 **데이터 품질 가시성**(스캔/리포트)을 제공한다.
5. 마이그레이션 데이터를 신규 등록 워크플로(REQ-260621 FR-STD-PAR)와 **정합**시킨다(학부모 백필 등).

### 3.2 Non-Goals
- 신규 학생 등록/수정 기능 자체(REQ-260621 구현 범위) — 본 문서는 **기존 적재 데이터 교정**만.
- 학생 PII 평문 → 암호화 전환 (별도 PII 정비, REQ-260525 §9 Q10).
- 원본 엑셀 재추출/재매핑 로직 변경 (941 은 적재 완료 전제. 재시드는 옵션 §11 R-2).
- MAP 점수 이력화, 첨부/사진 (REQ-260621 Non-Goal 동일).

---

## 4. 사용자 / 역할 (Users)

| Role | 권한 |
|------|------|
| ADMIN | 전체 정비 — garbage row 격리, 종료사유 분류, 강사 매핑, 학부모 백필, 동명이인 분리 |
| STAFF | 위임된 정비(연락처·학부모 입력 등 비파괴 작업) |
| TEACHER | 본인 담당 학생 한정 조회·메모 보강 (정비 권한 없음) |
| (운영 담당 / 학원) | 종료사유·동명이인 등 **판단 기준 제공**(미결 §13) |

---

## 5. 데이터 품질 이슈 인벤토리 (Data Quality Inventory)

> 범례 — 분류: 🔧 기계적(SQL) · 🧑‍⚖️ 판단(UI) · ⚙️ 혼합 / 심각도: 🔴 높음 · 🟡 중간 · ⚪ 낮음

| ID | 이슈 | 실데이터 근거 | 분류 | 심각도 |
|----|------|---------------|:----:|:----:|
| **DQ-1** | `std_phone` 오염 — 전화번호가 아닌 **SNS 핸들·QR 안내문** 적재 | `aprilchoi99`, `milano112900`, `petitemamang`, `카카오톡 QR code` | 🔧 | 🔴 |
| **DQ-2** | **비(非)학생 garbage row** — 시트 섹션/테넌트 라벨이 학생으로 적재 | `std_name='Santa Croce'` 가 TPI(`…-001`) 에 WITHDRAWN 으로 존재 | 🔧 | 🔴 |
| **DQ-3** | **종료사유 미분류** — 종료 행 전건 `std_end_reason='OTHER'`, 원문만 보존 | `…='OTHER'` 패턴 ~90건, `std_end_note` 에 '시험 종료'·'국제학교 합격' 등 | 🧑‍⚖️ | 🟡 |
| **DQ-4** | **담당 강사 미정규화** — `std_teacher` free-text 만, `std_teacher_id` 전건 NULL | `김태윤`·`김혜린`·`김경진`(5건) 등 다수 distinct | ⚙️ | 🟡 |
| **DQ-5** | **학부모 미연결** — 시드된 학생 전원 학부모 0건 | `amb_acm_std_parent` INSERT 0 | 🧑‍⚖️ | 🔴 |
| **DQ-6** | **동명이인 머지 위험** — `(ent_id, std_name)` 자연키 UPSERT 로 병합 | 시트 1·4 합쳐 ~18명 이름 중복 머지, 생년월일 sparse | 🧑‍⚖️ | 🔴 |
| **DQ-7** | **희소 legacy archive** — 구학생 97건 대부분 인적/MAP NULL | `std_end_note='구 학생 정보 (legacy archive…)'` 81건 | 🧑‍⚖️ | ⚪ |
| **DQ-8** | **종료일 결손** — WITHDRAWN 인데 `std_end_date` NULL (940 불변식 위반) | legacy 종료행 다수 end_date NULL | ⚙️ | 🟡 |
| **DQ-9** | **텍스트 정규화** — 커리큘럼/교재 멀티라인 공백·빈 줄·trailing space | `std_curriculum`/`std_materials` raw 멀티라인 | 🔧 | ⚪ |
| **DQ-10** | **테넌트 배정 검증** — Santa Croce 학생의 테넌트 정합성 | `…-002` 12건 vs `…-001` 의 'Santa Croce' 라벨행(DQ-2) | 🧑‍⚖️ | 🟡 |

### 5.1 분류별 처리 방향 요약
- **🔧 기계적(DQ-1·2·9)** → 멱등 SQL 정비 스크립트(`942`)로 **즉시** 교정.
- **⚙️ 혼합(DQ-4·8)** → 자동 후보 매칭 + 운영자 확정(UI).
- **🧑‍⚖️ 판단(DQ-3·5·6·7·10)** → 운영자 정비 큐(UI)에서 행별 검토.

---

## 6. 기능 요구사항 (Functional Requirements)

### 6.1 DC-SCAN — 데이터 품질 가시성

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DC-SCAN-1 | DQ-1~10 룰별로 **플래그된 행 수·목록**을 산출하는 스캔(읽기전용 쿼리/엔드포인트) 제공 | P0 |
| FR-DC-SCAN-2 | 어드민 대시보드에 "정비 필요 N건" 요약 + 이슈유형별 카운트 노출 | P1 |
| FR-DC-SCAN-3 | 스캔은 멱등·부수효과 없음. 테넌트(`ent_id`)별 격리 집계 | P0 |

### 6.2 DC-FIX — 기계적 교정 (SQL `942`)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DC-FIX-1 | (DQ-1) `std_phone` 값이 전화 패턴(`^[+0-9][0-9\-\s]{6,}$`)에 불일치하면 → 값을 `std_special_note` 에 `[연락처원문: …]` 으로 prepend 보존 후 `std_phone=NULL` | P0 |
| FR-DC-FIX-2 | (DQ-2) garbage row 격리 — 화이트리스트 기반(`Santa Croce` 등 테넌트/섹션 라벨)으로 `deleted_at=NOW()` soft-delete (물리 삭제 금지) | P0 |
| FR-DC-FIX-3 | (DQ-9) 멀티라인 텍스트 `TRIM` + 연속 빈 줄 1줄 축약. 의미 보존, 파괴 금지 | P1 |
| FR-DC-FIX-4 | 모든 942 작업은 **멱등**(재실행 무해) + 변경 전 영향 행수를 주석/RAISE NOTICE 로 기록 | P0 |
| FR-DC-FIX-5 | 942 실행 전 **대상 테이블 백업**(`amb_acm_std_student` → `_bak_260622`) 절차를 문서화 | P0 |

### 6.3 DC-TRIAGE — 운영자 정비 큐 (UI)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DC-TRI-1 | `/admin/std/cleanup` — 이슈유형(DQ) 탭 + 플래그 행 목록 + 인라인 교정 + "해결됨" 마킹 | P0 |
| FR-DC-TRI-2 | (DQ-3) 종료사유 분류 — `std_end_note` 원문 표시 + enum 셀렉터(COMPLETED/MID_TERM_DROP/TRANSFERRED/ACADEMIC_BREAK/RELOCATION/OTHER) 1클릭 지정 | P0 |
| FR-DC-TRI-3 | (DQ-4) 강사 매핑 — free-text `std_teacher` ↔ 활성 강사 마스터 검색·선택 → `std_teacher_id` 저장. 미존재 강사는 "강사 추가" 유도 | P1 |
| FR-DC-TRI-4 | (DQ-6) 동명이인 검증 — 같은 이름 그룹을 생년월일·학교·강사로 비교, "동일인 확정" 또는 "분리(신규 std_id 발급)" | P1 |
| FR-DC-TRI-5 | (DQ-8) WITHDRAWN 인데 end_date NULL 인 행에 입력 유도(또는 "불명" 일괄 처리 정책) | P1 |
| FR-DC-TRI-6 | (DQ-7) legacy archive 행 일괄 필터·보관/숨김 토글(운영 목록 노이즈 제거) | P2 |
| FR-DC-TRI-7 | 모든 교정은 **단건 트랜잭션 + 감사로그**(누가/언제/무엇을 어떤 값으로) | P0 |

### 6.4 DC-PAR — 학부모 백필 (DQ-5)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DC-PAR-1 | 학부모 미연결 학생 목록을 정비 큐에 노출, 학생 상세에서 학부모 추가(REQ-260511 §D7 매칭 재사용 — `ent_id+name+phone` 동일 시 재사용) | P0 |
| FR-DC-PAR-2 | 마이그레이션 학생은 REQ-260621 FR-STD-PAR 의 **신규 등록 필수 enforcement 대상에서 제외**(NULL 허용)하되, 정비 큐에서 "학부모 없음" 으로 상시 추적 | P0 |
| FR-DC-PAR-3 | (선택) CSL inquiry / `수업 확인표` 등 보조 출처에서 학부모 연락처 자동 prefill 후보 제안 | P2 |

### 6.5 DC-AUDIT — 감사·되돌리기

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-DC-AUDIT-1 | 정비로 인한 모든 행 변경은 추적 가능(감사 테이블 또는 `updated_at`+변경로그). 최소 SQL 백업본 보존 | P0 |
| FR-DC-AUDIT-2 | 942/UI 정비는 단계적 적용 — 한 DQ 룰 완료 후 다음 룰. 룰별 진행률 가시화 | P1 |

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

| ID | 항목 | 기준 |
|----|------|------|
| NFR-1 | 멀티테넌시 | 모든 스캔·교정은 `ent_id` 격리. 한 테넌트 정비가 타 테넌트에 영향 없음 |
| NFR-2 | 멱등성 | 942 및 UI 교정은 재실행/중복 클릭에 안전 |
| NFR-3 | 무손실 | 값 교체 전 원문 보존(note prepend) · 삭제는 soft-delete. 물리 삭제·덮어쓰기 금지 |
| NFR-4 | 백업 | 942 실행 전 `amb_acm_std_student` 스냅샷 백업 필수 |
| NFR-5 | 감사 | 정비 주체·시각·이전/이후 값 추적 |
| NFR-6 | 성능 | 스캔 쿼리 < 500ms (10K rows), 정비 큐 페이지네이션 |
| NFR-7 | PII | 정비 중 노출되는 연락처는 기존 평문 정책 유지(암호화는 Non-Goal) |

---

## 8. 인수 기준 (Acceptance Criteria)

- **AC-1 (DQ-1)**: 942 적용 후 `std_phone` 에 비전화 문자열이 0건. 원문은 `std_special_note` 에 `[연락처원문:]` 으로 남아 있다.
- **AC-2 (DQ-2)**: `std_name='Santa Croce'` (TPI ent) 행은 `deleted_at IS NOT NULL` (목록 비노출), 물리 삭제 아님.
- **AC-3 (DQ-3)**: 정비 큐에서 종료사유 분류 후 `std_end_reason='OTHER'` 잔여 건이 추적 가능하게 감소하고, 분류된 행은 원문(`std_end_note`)이 보존된다.
- **AC-4 (DQ-4)**: 강사 매핑 완료 행은 `std_teacher_id` 가 채워지고 FK 무결성 위반 0. 미매핑 행은 "매핑 필요" 로 카운트된다.
- **AC-5 (DQ-5)**: 학부모 백필 시 `(ent_id,name,phone)` 동일 학부모는 신규 `par_id` 생성 없이 재사용되고, 학생당 primary 1명 불변식 유지.
- **AC-6 (DQ-6)**: 동명이인 "분리" 실행 시 신규 `std_id` 가 발급되고, 두 행의 데이터가 섞이지 않는다.
- **AC-7 (멱등)**: 942 를 2회 연속 실행해도 결과 동일(추가 변경 0).
- **AC-8 (백업)**: 942 실행 전 백업 테이블/덤프 존재가 확인된다.
- **AC-9 (스캔)**: DQ-1~10 스캔 결과 카운트가 어드민에서 조회되고 테넌트별로 분리된다.

---

## 9. 정비 대상 컬럼 매핑 (Correction Targets)

| DQ | 대상 컬럼 | 교정 동작 |
|----|-----------|-----------|
| DQ-1 | `std_phone` → `std_special_note` | 비전화값 이전 후 NULL |
| DQ-2 | `deleted_at` | garbage row soft-delete |
| DQ-3 | `std_end_reason` (+ `std_end_note` 보존) | OTHER → 분류 enum |
| DQ-4 | `std_teacher_id` (+ `std_teacher` 보존) | free-text → FK |
| DQ-5 | `amb_acm_std_parent` / `amb_acm_std_student_parent` | 신규 매핑 |
| DQ-6 | `std_id` (분리 시 신규) | 머지 해제 |
| DQ-7 | (필터/뷰) | 보관·숨김 정책 |
| DQ-8 | `std_end_date` | 입력/불명 처리 |
| DQ-9 | `std_curriculum`·`std_materials` | TRIM·빈줄 축약 |
| DQ-10 | `ent_id` | 테넌트 재배정(검증 후) |

---

## 10. 의존성 (Dependencies)

### 10.1 선행
- `940-acm-std-student-extension.sql` 적용 — `std_end_*`·`std_teacher_id` 컬럼 존재.
- `941-seed-tpi-std-students-202606.sql` 적용 — 정비 대상 데이터 적재.
- `800/830-acm-tch-teacher` — 강사 매핑(DQ-4) FK 대상.
- `840-acm-cal-invitee-and-std-contact` — 학부모 엔티티(DQ-5) 대상.

### 10.2 후속 / 연계
- REQ-260621 FR-STD-PAR 구현 — 학부모 백필 UI(DQ-5)와 매칭 로직(§D7) 공유.
- `std_teacher` (VARCHAR) deprecated DROP — DQ-4 매핑 완료가 전제.
- 운영 적용은 **942 → UI 정비** 순. 941 의 운영 반영 시점과 동기화 필요(미결 Q3).

---

## 11. 리스크 / 가정 (Risks & Assumptions)

| # | 항목 | 완화 |
|---|------|------|
| R-1 | 정비 중 데이터 손실 | 백업(NFR-4) + 무손실 교정(NFR-3) + soft-delete |
| R-2 | 941 자체 매핑 오류는 SQL 정비로 못 잡음 | 심각 시 941 재생성·재시드(원본 엑셀 보존됨). 본 작업은 행 교정 범위 |
| R-3 | 동명이인 오판(DQ-6) | 자동 분리 금지 — 운영자 확정 필수. 생년월일·학교 보조표시 |
| R-4 | 종료사유 분류 기준 불일치(DQ-3) | enum 5종+OTHER 로 시작, 운영 피드백 후 조정(REQ-260621 R-2) |
| R-5 | 강사 매핑 시 강사 마스터 부재 | "강사 추가" 유도, 미매핑은 추적 카운트로 잔존 허용 |
| R-6 | 운영 DB 직접 정비의 위험 | staging 선검증 → 백업 → production. 배포 워크플로 준수 |

---

## 12. 측정 지표 (Metrics)

- 정비 전/후 DQ-1~10 플래그 카운트 (0 수렴 목표는 DQ-1·2, 나머지는 추적 감소).
- 학부모 미연결 학생 비율(DQ-5) — 백필 진행률.
- `std_teacher_id` 매핑률(DQ-4).
- `std_end_reason='OTHER'` 잔여율(DQ-3).

---

## 13. 미결사항 (Open Questions)

| Q | 주제 | 확인 대상 |
|---|------|-----------|
| Q1 | 구학생 97건(legacy archive, DQ-7) — **운영 목록에서 영구 숨김** 인가, 별도 아카이브 뷰로 유지인가, 일부 purge 인가 | 학원 운영 |
| Q2 | 종료사유(DQ-3) 분류 기준표 — '시험 종료'·'국제학교 합격'·'졸업' 등을 어느 enum 에 매핑할지 | 학원 운영 |
| Q3 | 941 시드의 **운영(production) 반영 시점** — 본 정비를 staging 에서 먼저 끝낸 뒤 한 번에 올릴지, 운영 적재 후 운영에서 정비할지 | 자사 운영 |
| Q4 | 동명이인(DQ-6) 후보 — 실제 분리 대상이 있는지(학원이 명단으로 확인) | 학원 운영 |
| Q5 | 학부모 백필(DQ-5) 데이터 출처 — 별도 명단/엑셀 제공 가능 여부(없으면 신규 입력만) | 학원 운영 |
| Q6 | garbage row(DQ-2) 화이트리스트 — 'Santa Croce' 외 추가 비학생 라벨 행 존재 여부 | 데이터 점검 |
| Q7 | 정비 UI 범위 — 본 스프린트에 **풀 UI** 인지, **P0(SQL+종료사유+학부모)만** 인지 | 사용자 |

---

## 14. 변경 이력 (Change Log)

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-06-22 | Claude | 초안 — 941 시드 후 잔존 데이터 품질 이슈 DQ-1~10 인벤토리(실데이터 근거) + FR-DC-SCAN/FIX/TRIAGE/PAR/AUDIT + AC 9종 + 미결 7건 |
