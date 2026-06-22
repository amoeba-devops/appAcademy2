---
document_id: PLN-260622-acm-std-data-correction
version: 1.0.0
status: Draft
created: 2026-06-22
product_code: ACM
title: ACM 학생정보 데이터 정비 작업계획서 (화면 구성안 포함)
modules:
  - STD (Student·Parent Management)
related:
  - docs/analysis/REQ-260622-acm-std-data-correction.md   # 본 계획의 요구사항 (선행)
  - docs/analysis/REQ-260621-acm-std-student-fields-extension.md
  - sql/acm/940-acm-std-student-extension.sql
  - sql/acm/941-seed-tpi-std-students-202606.sql
change_log:
  - { version: 1.0.0, date: 2026-06-22, author: Claude, notes: "초안 — 4단계(P0~P3) 작업계획 + 942 정비 SQL 설계 + 정비 큐 UI 목업 + 적용 순서/검증" }
---

# PLN-260622 — ACM 학생정보 데이터 정비 작업계획서
## (Student Data Correction — Work Plan)

> 본 계획은 **REQ-260622** 의 데이터 품질 이슈(DQ-1~10)를 해소하기 위한 단계별 작업·화면안이다.
> CLAUDE.md §9.2 에 따라 **구현 전 사용자 확인**을 받는다.

---

## 1. 접근 전략 (Strategy)

**하이브리드** — 기계적 교정은 멱등 SQL, 판단 교정은 운영자 UI.

```
Phase 0  백업 + 스캔 베이스라인        (안전망 — 무조건 선행)
Phase 1  942 기계적 정비 SQL          DQ-1(전화) · DQ-2(garbage) · DQ-9(텍스트)
Phase 2  정비 큐 UI (P0 코어)          DQ-3(종료사유) · DQ-5(학부모) + 스캔 대시보드
Phase 3  정비 큐 UI (확장)            DQ-4(강사) · DQ-6(동명이인) · DQ-7(legacy) · DQ-8(종료일)
```

- **분리 원칙**: 데이터를 덮어쓰기 전 항상 **원문 보존**(note prepend) / 삭제는 **soft-delete**.
- **검증 경로**: 로컬 → staging 검증 → 백업 → production (배포 워크플로 준수).

---

## 2. 작업 분해 (Work Breakdown)

### Phase 0 — 백업 & 스캔 베이스라인 (P0)
| Task | 내용 | 산출물 |
|------|------|--------|
| T0-1 | `amb_acm_std_student` 스냅샷 백업 (`CREATE TABLE … _bak_260622 AS SELECT *`) | 백업 테이블 |
| T0-2 | DQ-1~10 스캔 SQL 작성 (읽기전용, ent_id 별 카운트) | `sql/acm/diag/scan-std-dq.sql` |
| T0-3 | 정비 전 베이스라인 카운트 기록 | 리포트 (PLN 부록) |

### Phase 1 — 942 기계적 정비 (P0/P1)
| Task | DQ | 내용 |
|------|----|------|
| T1-1 | DQ-1 | 비전화 `std_phone` → `std_special_note` 보존 후 NULL (정규식 가드) |
| T1-2 | DQ-2 | garbage row 화이트리스트 soft-delete (`Santa Croce` 등) |
| T1-3 | DQ-9 | 멀티라인 텍스트 TRIM·빈줄 축약 (보수적) |
| T1-4 | — | 멱등·RAISE NOTICE 영향행수·헤더 의존성 명시 → `sql/acm/942-fix-tpi-std-data.sql` |

### Phase 2 — 정비 큐 UI 코어 (P0)
| Task | DQ | 내용 |
|------|----|------|
| T2-1 | SCAN | 백엔드 `GET /acm/std/cleanup/summary` — DQ별 카운트 |
| T2-2 | SCAN | 어드민 대시보드 위젯 "정비 필요 N건" |
| T2-3 | DQ-3 | `GET/PATCH /acm/std/cleanup/end-reason` + 종료사유 분류 UI |
| T2-4 | DQ-5 | 학부모 미연결 목록 + 학생 상세 학부모 추가(§D7 매칭 재사용) |
| T2-5 | — | `/admin/std/cleanup` 페이지 셸 + 탭 + 감사로그 |

### Phase 3 — 정비 큐 UI 확장 (P1/P2)
| Task | DQ | 내용 |
|------|----|------|
| T3-1 | DQ-4 | 강사 free-text ↔ 마스터 매핑(검색·선택·추가) |
| T3-2 | DQ-6 | 동명이인 그룹 비교 + 분리(신규 std_id) |
| T3-3 | DQ-8 | WITHDRAWN end_date 결손 입력 유도 |
| T3-4 | DQ-7 | legacy archive 보관/숨김 토글 |

---

## 3. 화면 구성안 (UI Mockups)

### 3.1 정비 대시보드 위젯 (`/admin/dashboard`)
```
┌──────────────────────────────────────────────┐
│  데이터 정비 필요            [ 정비 큐 열기 → ] │
│  ───────────────────────────────────────────  │
│  🔴 연락처 오염        4건                      │
│  🔴 비학생 행          1건                      │
│  🟡 종료사유 미분류    90건                     │
│  🔴 학부모 미연결      131건                    │
│  🟡 강사 미매핑        118건                    │
│  🔴 동명이인 후보      18건                     │
└──────────────────────────────────────────────┘
```

### 3.2 정비 큐 메인 (`/admin/std/cleanup`)
```
┌──────────────────────────── 학생 데이터 정비 ───────────────────────────────┐
│ [연락처 4] [비학생 1] [종료사유 90] [학부모 131] [강사 118] [동명이인 18] [legacy 81] │
│ ─────────────────────────────────────────────────────────────────────────── │
│ ▣ 종료사유 미분류 (90)                              테넌트: [TPI ▾]  [전체해결 안내] │
│ ┌─────────┬──────────┬────────────────────────────┬──────────────────┬───────┐ │
│ │ 이름     │ 종료일    │ 원문(std_end_note)          │ 종료사유 지정      │ 작업   │ │
│ ├─────────┼──────────┼────────────────────────────┼──────────────────┼───────┤ │
│ │ 김OO    │ 2025-02  │ 시험 종료                    │ [정상수료 ▾]      │ [저장] │ │
│ │ 이OO    │ 2025-01  │ 국제학교 합격                │ [타원이전 ▾]      │ [저장] │ │
│ │ 박OO    │ (없음)   │ 구 학생 정보 (legacy archive)│ [기타 ▾]          │ [저장] │ │
│ └─────────┴──────────┴────────────────────────────┴──────────────────┴───────┘ │
│                                              ◀ 1 / 5 ▶    [선택행 일괄 지정 ▾]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 학부모 백필 탭 (DQ-5)
```
┌──────────── 학부모 미연결 (131) ────────────────────────────┐
│ 이름     학교    상태       학부모            작업            │
│ 강병찬   SSIS   ACTIVE    — 없음 —          [+ 학부모 추가]  │
│ Erica    —      WITHDRAWN — 없음 —          [+ 학부모 추가]  │
│                                                              │
│  [+ 학부모 추가] 클릭 →  REQ-260511 §D7 매칭 다이얼로그        │
│  ┌────────────────────────────────────────────┐            │
│  │ 이름* [        ] 관계* [어머니 ▾]            │            │
│  │ 전화* [        ] 이메일 [            ]        │            │
│  │ ⚠ 동일 (이름+전화) 학부모 존재 → [기존 사용] │            │
│  └────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 동명이인 검증 탭 (DQ-6)
```
┌──────────── 동명이인 후보: "김민준" (2 rows 머지됨?) ──────────┐
│            row A             row B(병합 전 추정)               │
│ 생년월일   2013-05-xx        2015-xx-xx                        │
│ 학교       SIS              YISS                               │
│ 강사       김태윤            김혜린                            │
│ MAP(R/M/L) 250/—/—          —/—/—                             │
│                                                               │
│   [ 동일인으로 확정(머지 유지) ]   [ 분리 — 신규 학생 생성 ]    │
└───────────────────────────────────────────────────────────────┘
```

### 3.5 강사 매핑 탭 (DQ-4)
```
┌──────────── 강사 미매핑 (118) ──────────────────────────────┐
│ 이름     std_teacher(원문)   강사 마스터 매핑        작업      │
│ 강병찬   김태윤             [김태윤 (ACTIVE) ▾]    [저장]     │
│ Emilia   김경진             [검색…          ▾]    [저장]     │
│                              └ 미존재 시 [+ 강사 추가]        │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 942 정비 SQL 설계 (발췌)

```sql
-- 942-fix-tpi-std-data.sql  (멱등. 940/941 적용 후 실행. 942 전 백업 필수)

-- DQ-1: 비전화 std_phone → std_special_note 보존 후 NULL
UPDATE amb_acm_std_student
SET std_special_note = CONCAT('[연락처원문: ', std_phone, ']',
       CASE WHEN std_special_note IS NULL THEN '' ELSE E'\n' || std_special_note END),
    std_phone = NULL, updated_at = NOW()
WHERE std_phone IS NOT NULL
  AND std_phone !~ '^[+0-9][0-9\-\s]{6,}$'
  AND deleted_at IS NULL;

-- DQ-2: garbage row soft-delete (화이트리스트)
UPDATE amb_acm_std_student
SET deleted_at = NOW(), updated_at = NOW()
WHERE deleted_at IS NULL
  AND std_name IN ('Santa Croce');   -- §13 Q6 확정 후 확장
```
> 전체 스크립트는 구현 시 작성. 각 UPDATE 후 `GET DIAGNOSTICS`/`RAISE NOTICE` 로 영향행수 출력.

---

## 5. 적용 순서 (Rollout)

```
1) 백업      psql -f (T0-1)            → _bak_260622 확인
2) 스캔      psql -f scan-std-dq.sql   → 베이스라인 카운트
3) 942       psql -f sql/acm/942-...   → 기계적 정비 (멱등)
4) 재스캔    DQ-1·2·9 → 0/감소 확인
5) UI 정비   /admin/std/cleanup 에서 DQ-3·5(→4·6·7·8) 운영자 처리
6) 최종스캔  잔여 카운트 리포트
```
- **순서 의존**: 940 → 941 → (백업) → 942 → UI. 942 전 백업 누락 금지.
- **환경**: 로컬 검증 → staging 적용·검증 → production (PR + cd 파이프라인).

---

## 6. 검증 (Verification)

| 항목 | 방법 |
|------|------|
| 멱등 | 942 2회 실행 → 2회차 영향행수 0 (AC-7) |
| 무손실 | 교정 행의 원문이 note/`_bak_260622` 에 존재 (AC-1·8) |
| 테넌트 격리 | 스캔/정비를 ent별 실행, 교차 영향 0 (NFR-1) |
| 종료사유 | 분류 후 OTHER 잔여 카운트 감소 추적 (AC-3) |
| 학부모 | §D7 매칭 — 동일 학부모 재사용, primary 1명 (AC-5) |
| UI | Playwright 렌더 스냅샷 (이전 작업과 동일 절차) |

---

## 7. 추정 (Estimate, 개략)

| Phase | 범위 | 규모 |
|-------|------|------|
| P0 | 백업·스캔·942 | 0.5d |
| P2 | 스캔 API + 종료사유 + 학부모 UI | 2~3d |
| P3 | 강사·동명이인·legacy·종료일 UI | 2~3d |

> 미결 §13 Q7(풀 UI vs P0 코어)에 따라 P3 분리/후속화 가능.

---

## 8. 마일스톤 / 산출물

- [ ] `sql/acm/diag/scan-std-dq.sql` — DQ 스캔
- [ ] `sql/acm/942-fix-tpi-std-data.sql` — 기계적 정비
- [ ] `backend` — `/acm/std/cleanup/*` 엔드포인트
- [ ] `frontend-acm` — `/admin/std/cleanup` 정비 큐 + 대시보드 위젯
- [ ] i18n 4 로케일 키 (정비 UI 라벨, 종료사유 표시명)
- [ ] 정비 전/후 카운트 리포트

---

## 9. 변경 이력 (Change Log)

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-06-22 | Claude | 초안 — 하이브리드 4단계 계획 + 942 SQL 설계 + 정비 큐 UI 목업 5종 + 적용순서·검증 |
