---
document_id: ACM-PLN-MPQ-001
version: 2.0.0
status: Draft
created: 2026-05-06
product_code: ACM
module: MAP / MPQ (MAP Past Questions / 기출문제관리)
req_ref: ACM-REQ-MPQ-001
stack: frontend-acm (Vite/React) + backend NestJS acm-map module + Postgres db_acm
---

# ACM MAP — 기출문제관리 작업 계획서 (Work Plan)

> **스택 확정 (2026-05-06)**: 본 모듈은 전적으로 **`frontend-acm/` + 백엔드 `acm-map` 모듈 + Postgres `db_acm`** 에서 구현한다. 기존 `frontend/` (Next.js TAC), `tac_map_*` (MySQL) 자산은 사용·수정하지 않는다.

## 1. 목표

ACM 사이드바에 "MAP 기출문제" 메뉴를 신설하고, xlsx 121건을 일괄 적재한 뒤 추가/수정/삭제/재업로드/인라인 정답입력을 단일 화면에서 운영한다.

---

## 2. 화면 구성안 (UI Mockup)

### 2-1. 사이드바 진입점

```
ACM 사이드바 (frontend-acm/src/components/layout/app-shell.tsx)
┌──────────────────────────┐
│ Dashboard                │
│ Counseling (CSL)         │
│ Students (STD)           │
│ Classes (CLS)            │
│ Teachers (TCH)           │
│ Staff (STF)              │
│ Calendar (CAL)           │
│ Schools (SCH)            │
│ References (REF)         │
│ Q&A                      │
│ ★ MAP 기출문제 (NEW)     │  ← /admin/map  (lucide icon: BookOpenCheck)
└──────────────────────────┘
```

### 2-2. 목록 페이지 `/admin/map`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAP 기출문제 (Past Questions)                                                │
│                              [⬇ 템플릿] [⬆ 엑셀 업로드] [+ 문항 추가]          │
├─────────────────────────────────────────────────────────────────────────────┤
│  [문제/본문 검색__________________]  학년[ALL▼] 정답[전체▼] [🔗 Paired만]      │
├──┬───┬─────────────────────────────────┬──────┬──────┬─────────┬──────────┤
│☐ │번호│           문제 요약              │ 학년 │ 보기 │  정답   │   작업    │
├──┼───┼─────────────────────────────────┼──────┼──────┼─────────┼──────────┤
│☐ │ 1 │ Why did the Pony Express end?   │  G3  │  4   │ ●1○2○3○4│ ✏  🗑   │
│☐ │ 2 │ What is the topic of both pa…🔗 │  G3  │  4   │ ○1○2○3●4│ ✏  🗑   │
│☐ │ 3 │ The main idea of the paragra…   │  G2  │  4   │  미입력  │ ✏  🗑   │
│… │   │                                 │      │      │         │          │
├──┴───┴─────────────────────────────────┴──────┴──────┴─────────┴──────────┤
│  총 121건 (입력완료 0 · 미입력 121)            ← 1 2 3 4 5 6 7 →            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **인라인 정답 라디오**: 클릭 시 `PATCH /api/acm/map/questions/:id/answer`, 성공 토스트.
- **🔗 아이콘**: `pair_group_id` 가 NULL 이 아닌 행에 표시.
- **체크박스**: 일괄 작업 확장용 자리만 마련 (v1 미동작).

### 2-3. 추가/수정 모달

```
┌─────────────────── MAP 기출문제 [추가 / 수정] ──────────────────┐
│  번호 [auto/____]   학년 [G2▼]   상태 [PUBLISHED▼]              │
│  ─────────────────────────────────────────────────────────── │
│  본문 1 (passage_1) *                                           │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ The Pony Express began in 1860. ...                    │   │
│  └────────────────────────────────────────────────────────┘   │
│  ☐ Paired (본문 2 사용)                                         │
│  ┌── 본문 2 (passage_2) — Paired 체크 시 표시 ───────────┐   │
│  │ ...                                                     │   │
│  └────────────────────────────────────────────────────────┘   │
│  용어 풀이 (glossary, optional)                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ scrape — cut                                           │   │
│  └────────────────────────────────────────────────────────┘   │
│  ─────────────────────────────────────────────────────────── │
│  문제 (question) *                                              │
│  [_____________________________________________________________] │
│  보기 1 * [_______________]    보기 2 * [_______________]      │
│  보기 3 * [_______________]    보기 4 * [_______________]      │
│  정답  ○ 1   ○ 2   ○ 3   ○ 4   ○ 미정                          │
│  ─────────────────────────────────────────────────────────── │
│                                       [취소]  [저장]            │
└────────────────────────────────────────────────────────────────┘
```

### 2-4. 엑셀 업로드 모달

```
┌─────────────── 엑셀 업로드 (기출문제 일괄 적재) ───────────────┐
│ [📎 .xlsx 파일 선택]  또는 끌어다 놓기                           │
│ ───────────────────────────────────────────────────────────── │
│ ▼ 미리보기 (처음 25행)                                          │
│ ┌──┬────────────┬────┬────┬────┬────┬────┬─────┐             │
│ │번│  문제 요약  │ G  │ Ch │ Pr │ Gl │ An │상태 │             │
│ ├──┼────────────┼────┼────┼────┼────┼────┼─────┤             │
│ │ 1│ Why did ...│ G3 │  4 │ -  │ -  │ -  │ NEW │             │
│ │ 2│ What is ...│ G3 │  4 │ ✓  │ -  │ -  │ NEW │             │
│ │..│            │    │    │    │    │    │     │             │
│ └──┴────────────┴────┴────┴────┴────┴────┴─────┘             │
│ 총 121행 · 신규 121 · 갱신 0 · 오류 0                            │
│ ☑ 동일 (학년+번호+source) 존재 시 갱신 (Upsert)                  │
│                                       [취소] [Import 실행]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 작업 분해 (Task Breakdown)

### Phase 1 — DB Migration & Seed

| Task | 파일 | 내용 |
|------|------|------|
| T-01 | `sql/acm/720-acm-map-past-questions.sql` | `amb_acm_map_passage`, `amb_acm_map_question` DDL + 인덱스 + UNIQUE |
| T-02 | `scripts/build-map-past-questions-seed.py` | xlsx → SQL 생성 (Python openpyxl) |
| T-03 | `sql/acm/721-seed-map-past-questions-rc-g2-4.sql` | T-02 산출물 (passage primary 121 + secondary 6 + question 121, ent_id=트리니티) |

### Phase 2 — Backend (NestJS, 신규 모듈 `acm-map`)

| Task | 파일 | 내용 |
|------|------|------|
| T-04 | `backend/src/modules/acm-map/infrastructure/typeorm/passage.entity.ts` | TypeORM Entity |
| T-05 | `backend/src/modules/acm-map/infrastructure/typeorm/question.entity.ts` | TypeORM Entity |
| T-06 | `backend/src/modules/acm-map/application/dto/question.dto.ts` | CreateDto, UpdateDto, ListQueryDto, AnswerPatchDto, ImportResultDto |
| T-07 | `backend/src/modules/acm-map/application/question.service.ts` | CRUD + soft delete |
| T-08 | `backend/src/modules/acm-map/application/question-import.service.ts` | xlsx 파싱 (`xlsx` npm 패키지) + upsert |
| T-09 | `backend/src/modules/acm-map/application/question-template.service.ts` | 빈 템플릿 생성·반환 |
| T-10 | `backend/src/modules/acm-map/presentation/question.controller.ts` | 8개 엔드포인트 (REQ §6) |
| T-11 | `backend/src/modules/acm-map/acm-map.module.ts` | 모듈 정의 |
| T-12 | `backend/src/modules/acm.module.ts` | `AcmMapModule` 등록 |
| T-13 | `backend/package.json` | `xlsx` 추가 (없을 시) |
| T-14 | `backend/test/integration/acm-map-questions.spec.ts` | upsert + answer patch 통합 테스트 |

### Phase 3 — Frontend (`frontend-acm/`)

| Task | 파일 | 내용 |
|------|------|------|
| T-15 | `frontend-acm/src/modules/map/types.ts` | `MpqListItem`, `MpqDetail`, `MpqImportResult` |
| T-16 | `frontend-acm/src/modules/map/hooks/use-mpq.ts` | React Query hooks (list/detail/create/update/delete/patchAnswer/import) |
| T-17 | `frontend-acm/src/modules/map/components/mpq-filters.tsx` | 검색 + 학년/정답/Paired 필터 |
| T-18 | `frontend-acm/src/modules/map/components/mpq-answer-radio.tsx` | 인라인 정답 라디오 (1~4 + 미정) |
| T-19 | `frontend-acm/src/modules/map/components/mpq-table.tsx` | 행 + 인라인 라디오 + 액션 버튼 |
| T-20 | `frontend-acm/src/modules/map/components/mpq-form-modal.tsx` | 추가/수정 모달 폼 (RHF + Zod) |
| T-21 | `frontend-acm/src/modules/map/components/mpq-import-modal.tsx` | 엑셀 업로드 + 미리보기 + 결과 표시 |
| T-22 | `frontend-acm/src/modules/map/pages/mpq-list-page.tsx` | 메인 페이지 (T-17~21 조합) |
| T-23 | `frontend-acm/src/i18n/locales/ko/mpq.json` | i18n (ko) |
| T-24 | `frontend-acm/src/i18n/locales/en/mpq.json` | i18n (en) |
| T-25 | `frontend-acm/src/i18n/locales/vi/mpq.json` | i18n (vi) |
| T-26 | `frontend-acm/src/i18n/locales/zh-CN/mpq.json` | i18n (zh-CN) |
| T-27 | `frontend-acm/src/i18n/index.ts` | `mpq` namespace 등록 |
| T-28 | `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/common.json` | `nav.map` 키 추가 (4개 언어) |
| T-29 | `frontend-acm/src/components/layout/app-shell.tsx` | NAV 배열에 `{ to:'/admin/map', icon: BookOpenCheck, key:'map' }` 추가 |
| T-30 | `frontend-acm/src/routes/router.tsx` | `{ path:'admin/map', element:<MpqListPage/> }` 라우트 등록 |

### Phase 4 — 배포 및 검증

| Task | 내용 |
|------|------|
| T-31 | local: `cd backend && npm run build` / `cd frontend-acm && npm run build` 통과 |
| T-32 | local seed: `psql db_acm -f sql/acm/720-...sql -f sql/acm/721-...sql` |
| T-33 | smoke (local): `GET /api/acm/map/questions` → 121건, 재 import → updated=121 |
| T-34 | staging 배포: `scripts/deploy-staging.sh` (sql/_applied marker 자동 인식) |
| T-35 | staging smoke + UI 확인 (사이드바 진입 / 인라인 라디오 / import) |

---

## 4. 의존성

```
T-01 ──► T-02 ──► T-03 (DDL → 변환 스크립트 → seed)
T-01 ──► T-04, T-05
T-04, T-05, T-06 ──► T-07, T-08, T-09 ──► T-10 ──► T-11 ──► T-12

T-15 ──► T-16 ──► T-17, T-18, T-19, T-20, T-21
T-17~21 ──► T-22
T-23~27 ──► T-22 (라벨)
T-28, T-29, T-30 ──► 진입점·라우팅
```

---

## 5. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| `[이미지]` 토큰 — 운영자가 실제 이미지로 교체하고 싶음 | v1 placeholder 유지, v2 에서 별도 image-asset 업로드 UI (별도 요건) |
| Paired passage 6건의 그룹화 모호성 | seed 스크립트에서 동일 `question_no` row 의 passage_1+passage_2 → 두 row(`mpg_pair_group_id` 공유, `mpg_ordinal` 1/2). question 의 `mpg_id` 는 ordinal=1 row 참조 |
| 정답 121건 미입력 | (1) 정답표 받아 일괄 SQL UPDATE, (2) UI 인라인 라디오로 입력 — 두 경로 제공 |
| 엑셀 업로드 동시성 | 단일 운영자 가정, v1 미적용 (필요 시 service mutex) |
| 타 모듈 (TestSet 등) 도입 시 question 삭제 → FK 위반 | 본 v1 에서는 TestSet 없음. 향후 모듈 추가 시 service 에 사전 검사 추가 |
| `acm.module.ts` 라우팅 prefix 확인 | 백엔드 main.ts global prefix `/api`, AcmMapModule 컨트롤러 path `acm/map/questions` → 결과 `/api/acm/map/questions` |
| 메뉴 라벨 i18n 키 충돌 | `nav.map` 사용 — 기존 키와 미충돌 확인 필요 (T-28 작업 시 점검) |

---

## 6. 완료 기준 (Definition of Done)

- [ ] DB: `amb_acm_map_passage`, `amb_acm_map_question` 테이블 + UNIQUE / 인덱스 적용
- [ ] DB: 121건 seed 적재 (`SELECT COUNT(*) FROM amb_acm_map_question WHERE mpq_source='MAP_RC_G2-4_PAST'` = 121)
- [ ] DB: 127 passages (121 primary + 6 secondary)
- [ ] API: `GET /api/acm/map/questions` → 200, 페이지네이션 정상
- [ ] API: `POST` → 201 (passage+question 트랜잭션), `PUT` → 200
- [ ] API: `PATCH /:id/answer` → 200 + DB 반영
- [ ] API: `DELETE /:id` → 204, status=ARCHIVED
- [ ] API: `POST /import` → `{ inserted, updated, errors[] }`, 재 import 시 updated=121
- [ ] API: `GET /template` → .xlsx 파일 (헤더 10컬럼)
- [ ] FE: 사이드바 "MAP 기출문제" 진입점 표시 (active 하이라이트)
- [ ] FE: `/admin/map` 목록 + 검색 + 필터 정상
- [ ] FE: 추가/수정 모달 저장 → 목록 즉시 반영 (React Query invalidate)
- [ ] FE: 인라인 정답 라디오 즉시 PATCH + 토스트
- [ ] FE: 엑셀 업로드 → 미리보기 → Import → 결과 표시
- [ ] FE: 템플릿 다운로드 정상
- [ ] i18n: ko/en/vi/zh-CN 4개 언어 라벨 누락 없음
- [ ] 통합 테스트 1건 이상 (upsert + answer patch) 통과
- [ ] staging 배포 후 smoke 통과 (사이드바 진입, 121건 조회)

---

## 7. 변경 이력

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-06 | 2.0.0 | 스택을 frontend-acm + acm-map 백엔드 + Postgres `amb_acm_map_*` 로 확정 (frontend/ 작업 폐기 방침 반영) |
