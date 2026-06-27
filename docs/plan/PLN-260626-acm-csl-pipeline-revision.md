---
document_id: PLN-260626-acm-csl-pipeline-revision
version: 1.0.1
status: draft
created: 2026-06-26
product_code: ACM
authors:
  - gray.kim@amoeba.group
modules:
  - CSL (Consultation Management / 상담관리)
related:
  - docs/analysis/REQ-260626-acm-csl-pipeline-revision.md   # 요구사항 (FR-CSL-1xx)
  - docs/design/DSN-260626-acm-csl-pipeline-revision.md     # 설계 (FN/SCR/§5.6 점수/§5.7 PDF) v1.2.0
  - sql/acm/985-acm-csl-pipeline-revision.sql               # 마이그레이션 DDL (980 prefix 가 sql/acm/980-acm-subscription-event.sql 와 충돌하여 985 로 재번호)
decisions:
  - Q-CSL-102 MAP 점수 CSL 보관 → 수강시작 시 STD 승계
  - Q-CSL-104 시험별 점수항목 확정 (DSN §5.6)
  - Q-CSL-108 카카오 전달 = 수동 복사
  - Q-CSL-109 강좌코스 = 마스터 + 자유입력
  - Q-CSL-110 단계 enum 불변, 라벨만 변경
  - Q-CSL-111 결과 입력 운영자 전용
  - 결과 PDF = 시험 종류별 전체 지표 표기 (DSN §5.7)
change_log:
  - 2026-06-26 v1.0.0 draft — 6 phase / WBS T-01~T-20 / 약 15-18 영업일 추정
  - 2026-06-27 v1.0.1 — sql/acm/980 prefix 충돌로 985 로 재번호 (PR #46 의 980-acm-subscription-event.sql 와 동시 존재 불가)
---

# 작업 계획서 — CSL 상담관리 파이프라인 개편 (REQ-260626)

> **One-liner**: DSN-260626 구현. 단계 enum 불변·라벨/항목/보조데이터 개편. 6 phase, WBS 20 태스크,
> 약 15~18 영업일. backend `acm-csl` + `frontend-acm/src/modules/csl` 범위. 단계 게이트마다 사용자 확인.

---

## 0. 범위·가정·게이트 (Scope · Assumptions · Gates)

| 항목 | 내용 |
|------|------|
| In-scope | FR-CSL-101~143, §5.6 점수 스키마, §5.7 결과 PDF, 신규 4테이블 + ALTER 3테이블 |
| Out-of-scope | 이슈/고객사 프로젝트 자동생성, 카카오 자동발송, 온라인 PG, enum 코드 개명 |
| 프론트 | **frontend-acm 만** (Next.js `frontend/` 금지, 규칙 9.1) |
| 권한 | 결과입력=STAFF↑, 결제승인=ADMIN/APP_ADMIN (BR-CSL-012) |
| 파일 | S3 presigned, mime∈{pdf,jpeg,png}, ≤10MB, 성적표 ≤10개 |
| CAL | REQ-260526 meetKey 패턴 재사용 (레벨테스트·데모수업 일정) |
| 마이그레이션 | ALTER 는 additive only, deprecate 컬럼 drop 없음 (Phase 후속) |

각 Phase 종료 시 **로컬/스테이징 검증 + 사용자 확인** 후 다음 Phase. 포트는 backend 4009 / frontend 3009(→5173 proxy).

---

## 1. Phase 구성 (Phases)

```
P1 DB/마이그레이션 ─▶ P2 도메인·엔티티 ─▶ P3 API(단계별) ─▶ P4 프론트(단계별 UI)
      └────────────────────────▶ P5 PDF·파일·CAL 연동 ─▶ P6 테스트·정합
```

| Phase | 목표 | 산출 | 의존 |
|-------|------|------|------|
| P1 | 스키마 적용 | 980 SQL 반영 + 엔티티 동기화 | — |
| P2 | 도메인 모델 | 엔티티·리포지토리·DTO | P1 |
| P3 | API | 단계별 use-case·controller | P2 |
| P4 | 프론트 | 5단계 패널 UI | P3 |
| P5 | 연동 | PDF 생성·S3 첨부·CAL 등록 | P3 |
| P6 | 검증 | 단위/통합 테스트·문서 정합 | P4,P5 |

---

## 2. WBS (Work Breakdown Structure)

> 브랜치: `feature/{#}-csl-{slug}` (규칙 9.5 / DSN). 효 = 영업일 추정. 모든 백엔드 변경은 swagger 갱신 포함.

| ID | Task | 영역 | 의존 | 효(d) | FR/FN |
|----|------|------|------|------|-------|
| T-01 | 985 SQL 검토·로컬 적용, deprecate 주석 확인 (980 prefix 충돌로 985 로 변경) | DB | - | 0.5 | §3 |
| T-02 | TypeORM 엔티티 동기화 (map_test/trial_class/enrollment 컬럼 추가) | BE | T-01 | 1 | §3.2 |
| T-03 | 신규 엔티티 — attachment / teacher_assignment / course | BE | T-01 | 1 | §3.2 |
| T-04 | 레벨테스트 도메인: test_type + 점수 스키마 검증기(type별) | BE | T-02 | 1.5 | FN-211/213, §5.6 |
| T-05 | 접수 API — 이전점수(MAP/JSONB) upsert + 동적 검증 | BE | T-04 | 1 | FR-101~103 |
| T-06 | 성적표 업로드 API — presigned S3 + attachment(TRANSCRIPT) | BE | T-03 | 1 | FR-105, FN-202 |
| T-07 | 레벨테스트 API — 일정 지정(30분)·결과 입력(운영자 전용) | BE | T-04 | 1 | FR-112~115 |
| T-08 | CAL 등록 연동 (레벨테스트·데모수업, meetKey) | BE | T-07 | 1 | FR-114, §6.1 |
| T-09 | 데모수업 API — 세션·강사배정·완료·자료 업로드 | BE | T-03 | 1.5 | FR-122~126 |
| T-10 | 피드백 API — 강사 작성·운영자 확인·전달기록 | BE | T-09 | 1 | FR-127/128, §6.2 |
| T-11 | 등록상담 API — 상담내용·강좌·시간·회수·기간·복수강사 | BE | T-03 | 1.5 | FR-131~136 |
| T-12 | 결제 승인 API — tuition_paid (ADMIN 전용, actor/at) | BE | T-02 | 0.5 | FR-141/142 |
| T-13 | 결과 PDF 생성 — 시험종류별 전체지표 (§5.7) + 다운로드 감사 | BE | T-07 | 1.5 | FR-116, §5.7 |
| T-14 | 접수 화면(SCR-01) — 동적 점수칸·영문라벨·멀티업로드·저장/다음버튼 | FE | T-05,T-06 | 1.5 | FR-101~109 |
| T-15 | 레벨테스트 화면(SCR-02) — 종류선택·일정·결과(동적)·PDF | FE | T-07,T-13 | 1.5 | FR-111~116 |
| T-16 | 데모수업 화면(SCR-03) — 일정·강사·자료·피드백·복사전달 | FE | T-09,T-10 | 1.5 | FR-121~128 |
| T-17 | 등록상담 화면(SCR-04) — 강좌·시간·회수·복수강사 | FE | T-11 | 1 | FR-131~136 |
| T-18 | 결제 화면(SCR-05) + 단계 라벨/스테퍼(상태표시 전용) i18n | FE | T-12 | 1 | FR-109/141, BR-CSL-101 |
| T-19 | MAP 점수 STD 승계 (수강시작 전이, 멱등) | BE | T-05 | 0.5 | §6.3 |
| T-20 | 테스트(단위·통합) + 권한/감사 검증 + 문서 정합 | QA | P4,P5 | 2 | §8 |

**합계 추정**: ~22.5 man-day → 1인 약 18 영업일 / 2인 병렬 약 10~12 영업일.

---

## 3. 마일스톤 (Milestones)

| 마일스톤 | 완료 기준 | 포함 |
|----------|-----------|------|
| M1 데이터 레이어 | 스키마+엔티티 적용, 빌드 통과 | T-01~T-03 |
| M2 백엔드 API | 5단계 API + PDF + CAL, swagger | T-04~T-13, T-19 |
| M3 프론트 UI | 5단계 패널 동작 | T-14~T-18 |
| M4 릴리즈 | 테스트 통과·문서 정합·검수 | T-20 |

---

## 4. 화면 구성안 (UI 목업)
- 단계별 레이아웃 목업은 **DSN-260626 §4 (SCR-CSL-01~05)** 참조 — 본 계획의 화면 구성안으로 갈음(규칙 9.2).

---

## 5. 리스크 (Risks)

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 시험별 점수 JSONB 검증 복잡 | 중 | type별 Zod/class-validator 스키마 분리, §5.6 단일 출처 |
| CAL 연동 키 충돌 | 중 | meetKey 멱등 생성, 실패 시 일정만 저장+재시도 |
| deprecate 컬럼 잔존 혼선 | 저 | 엔티티/주석에 DEPRECATED 명시, 신규 쓰기 차단 |
| 권한 경계(결과입력/결제) 누락 | 고 | Guard 테스트 필수(T-20), 403 케이스 포함 |
| 파일 권한 분리(성적표/자료) | 중 | att_visibility 기반 다운로드 가드 + 감사 |

---

## 6. 다음 단계 (Next)
- 본 계획 승인 → **P1(T-01)** 착수. 각 Phase 종료 시 확인.
- 산출물 추적: 태스크별 작업리포트(RPT-260626-*) + CHANGELOG, 커밋 컨벤션 `feat(csl): …`.
- 후속(범위 외): 데모수업→고객사 프로젝트 모델 별도 REQ, 학생포털 자료·PDF 노출 화면.
