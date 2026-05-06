---
document_id: ACM-REQ-MPQ-001
version: 2.0.0
status: Draft
created: 2026-05-06
product_code: ACM
module: MAP / MPQ (MAP Past Questions / 기출문제관리)
related_screen: /admin/map (목록)
data_source: docs/reference/MAP_RC_G2-4_기출문제.xlsx
stack: frontend-acm (Vite/React) + backend NestJS acm-map module + Postgres db_acm
---

# ACM MAP — 기출문제관리 요구사항 분석서 (Requirements)

> **스택 확정 (2026-05-06)**: 본 기능은 **`frontend-acm/` (Vite/React ACM 콘솔)** 에서 구현한다. 기존 `frontend/` (Next.js TAC) 의 `/admin/map/*` 화면들은 모두 ACM 으로 통합 이전되며, 더 이상 `frontend/` 에서 신규 작업하지 않는다. 백엔드도 기존 `tac_map_*` (MySQL) 대신 ACM 컨벤션의 신규 `amb_acm_map_*` (Postgres `db_acm`) 스키마를 사용한다.

## 1. 배경 및 목표

### 1.1 배경
- 트리니티 학원이 보유한 MAP RC 기출문제(G2~G4) 121문항(`MAP_RC_G2-4_기출문제.xlsx`)을 ACM 콘솔에서 강사·운영자가 검색·열람·수정.
- 현재 `frontend-acm` 에는 MAP 관련 메뉴가 없음. 본 기능이 MAP 도메인의 첫 모듈.

### 1.2 목표
1. ACM 사이드바에 **"MAP 기출문제"** 진입점 추가 (라우트 `/admin/map`).
2. xlsx 121건 **초기 일괄 적재** + **재업로드 upsert**.
3. 단일 화면에서 **추가 / 수정 / 삭제 / 검색 / 인라인 정답 입력**.
4. 4개 언어(ko/en/vi/zh-CN) i18n 라벨 제공.

### 1.3 비목표
- 학생 응시·자동 채점·AI 해설 (TestSet / Assignment / Grading 은 향후 별도 모듈)
- 이미지(`[이미지]` 토큰) 실제 이미지 변환·OCR — v1 텍스트 placeholder 유지

---

## 2. 데이터 명세 (Source xlsx)

`docs/reference/MAP_RC_G2-4_기출문제.xlsx` (시트 1장, 헤더 1행 + 121행, 10컬럼)

| 컬럼 | 타입 | Null | 비고 |
|------|------|------|------|
| `question_no` | INT | N | 1~121, unique |
| `passage_1` | TEXT | N | `[이미지]` 토큰 포함 가능 |
| `passage_2` | TEXT | Y | paired 6건만 채워짐 |
| `glossary` | TEXT | Y | 7건만 채워짐 |
| `question` | TEXT | N | |
| `choice_1`~`choice_4` | TEXT | N | |
| `answer` | INT | **Y** | 1~4. **현재 121건 모두 NULL** → 운영자 수동 입력 필요 |

집계: total=121, paired=6, glossary=7, answer 미입력=121.

---

## 3. 기능 요구사항 (Functional)

| ID | 요구사항 |
|----|----------|
| FR-MPQ-01 | ACM 사이드바에 "MAP 기출문제" 메뉴 표시. 라우트 `/admin/map`. 권한: 인증 필수 |
| FR-MPQ-02 | 목록: 페이지네이션(20/page), 검색(question + passage 부분일치), 필터(학년 G2/G3/G4/ALL · 정답입력여부 · Paired only) |
| FR-MPQ-03 | 추가 모달: passage1*, passage2?, glossary?, question*, choice1~4*, answer 1~4 or unset, grade*, source default `MAP_RC_G2-4_PAST` |
| FR-MPQ-04 | 수정: 같은 폼 edit 모드, 모든 필드 변경 가능, version 1 증가 |
| FR-MPQ-05 | 삭제: soft-delete (`mpq_status='ARCHIVED'`) — 단일 행 삭제 확인 다이얼로그 |
| FR-MPQ-06 | 엑셀 업로드: multipart .xlsx → 미리보기(처음 25행) → Import 실행 → `{ inserted, updated, errors[] }` 결과 표시. Upsert key=`(ent_id, grade, question_no, source)` |
| FR-MPQ-07 | 템플릿 다운로드: 헤더 1행만 포함된 빈 .xlsx |
| FR-MPQ-08 | 인라인 정답 라디오: 목록 행에서 1~4 클릭 → 즉시 `PATCH /:id/answer` → 토스트 |

---

## 4. 비기능 요구사항 (Non-Functional)

| ID | 항목 | 요구 |
|----|------|------|
| NFR-01 | 성능 | 121행 조회 < 300ms, 121행 import < 5s |
| NFR-02 | 트랜잭션 | passage(+pair) + question 생성/수정 단일 트랜잭션 |
| NFR-03 | 권한 | `RequireAuth` 가드 통과 사용자만 접근 |
| NFR-04 | i18n | ko/en/vi/zh-CN 4개 언어 — 신규 namespace `mpq` |
| NFR-05 | 멀티테넌시 | `ent_id` 자동 주입. seed 는 트리니티 ent_id (`00000000-0000-0000-0000-000000000001`) |
| NFR-06 | XSS | React 기본 escape, `dangerouslySetInnerHTML` 금지 |

---

## 5. 데이터 모델 (Postgres `db_acm`, 신규)

### 5.1 `amb_acm_map_passage` (col prefix `mpg_`)

| Column | Type | Null | 설명 |
|--------|------|------|------|
| `mpg_id` | UUID PK | N | gen_random_uuid() |
| `ent_id` | UUID | N | 테넌트 |
| `mpg_grade` | VARCHAR(8) | N | G2/G3/G4 |
| `mpg_domain` | VARCHAR(20) | N | 'RC' default |
| `mpg_body` | TEXT | N | passage_1 또는 passage_2 본문 |
| `mpg_glossary` | TEXT | Y | passage_1 row 에만 저장 |
| `mpg_pair_group_id` | UUID | Y | paired 시 동일 값 공유 |
| `mpg_ordinal` | SMALLINT | N | 1=primary, 2=secondary |
| `mpg_source` | VARCHAR(40) | N | 'MAP_RC_G2-4_PAST' |
| `mpg_version` | INT | N | 1 |
| `mpg_status` | VARCHAR(16) | N | PUBLISHED / ARCHIVED |
| `mpg_created_at` / `mpg_updated_at` | TIMESTAMPTZ | N | now() |

INDEX: `(ent_id, mpg_grade, mpg_status)`, `(mpg_pair_group_id)`

### 5.2 `amb_acm_map_question` (col prefix `mpq_`)

| Column | Type | Null | 설명 |
|--------|------|------|------|
| `mpq_id` | UUID PK | N | |
| `ent_id` | UUID | N | |
| `mpg_id` | UUID FK | N | passage_1 row 참조 |
| `mpq_grade` | VARCHAR(8) | N | denormalized |
| `mpq_domain` | VARCHAR(20) | N | 'RC' |
| `mpq_external_no` | INT | N | xlsx `question_no` |
| `mpq_question` | TEXT | N | |
| `mpq_choices` | JSONB | N | `["c1","c2","c3","c4"]` |
| `mpq_answer_index` | SMALLINT | Y | 0~3 또는 NULL |
| `mpq_explanation` | TEXT | Y | |
| `mpq_difficulty` | VARCHAR(16) | N | INTERMEDIATE default |
| `mpq_source` | VARCHAR(40) | N | 'MAP_RC_G2-4_PAST' |
| `mpq_version` | INT | N | 1 |
| `mpq_status` | VARCHAR(16) | N | PUBLISHED / DRAFT (정답 없음) / ARCHIVED |
| `mpq_created_at` / `mpq_updated_at` | TIMESTAMPTZ | N | |

UNIQUE: `(ent_id, mpq_grade, mpq_external_no, mpq_source)` — upsert key
INDEX: `(ent_id, mpq_grade, mpq_status)`

### 5.3 SQL 파일 배치
- `sql/acm/720-acm-map-past-questions.sql` (DDL)
- `sql/acm/721-seed-map-past-questions-rc-g2-4.sql` (xlsx 변환 INSERT, ent_id=트리니티, 121 questions + 121 primary passage + 6 secondary passage)

---

## 6. API 명세 (`/api/acm/map` prefix)

| Method | Path | 설명 |
|--------|------|------|
| GET    | `/api/acm/map/questions` | 목록 (query: `grade`, `hasAnswer`, `paired`, `search`, `page`, `limit`) |
| GET    | `/api/acm/map/questions/:id` | 상세 (passage primary + secondary + question 합본) |
| POST   | `/api/acm/map/questions` | 신규 (passage[+pair] + question 트랜잭션) |
| PUT    | `/api/acm/map/questions/:id` | 수정 |
| PATCH  | `/api/acm/map/questions/:id/answer` | `{ answerIndex: 0..3 \| null }` |
| DELETE | `/api/acm/map/questions/:id` | soft delete |
| POST   | `/api/acm/map/questions/import` | multipart .xlsx upsert |
| GET    | `/api/acm/map/questions/template` | 빈 템플릿 .xlsx |

응답 포맷: `{ data, meta }` / `{ error: { code, message } }`

---

## 7. 인수 기준 (Acceptance Criteria)

| AC | 기준 |
|----|------|
| AC-01 | ACM 사이드바에 "MAP 기출문제" 메뉴 표시, `/admin/map` 진입 시 목록 정상 |
| AC-02 | 빈 DB 에 xlsx 업로드 → `inserted=121, updated=0` |
| AC-03 | 동일 xlsx 재업로드 → `inserted=0, updated=121` |
| AC-04 | 행 정답 라디오 1 클릭 → DB `mpq_answer_index=0` 저장 + 토스트 |
| AC-05 | "미입력" 필터 → answer NULL 행만 노출 |
| AC-06 | Paired (passage_2 존재) 행 🔗 아이콘 표시 |
| AC-07 | DELETE 후 목록 재조회 시 해당 행 미표시 (status=ARCHIVED) |
| AC-08 | 비인증 사용자 `/admin/map` 접근 → `/login` 리다이렉트 |
| AC-09 | 4개 언어 라벨 모두 표시 (누락 키 없음) |

---

## 8. 가정 / 미결사항

| ID | 내용 | 처리 |
|----|------|------|
| A-01 | seed `ent_id` = 트리니티 (`00000000-0000-0000-0000-000000000001`) | 가정, 사용자 확인 |
| Q-01 | `[이미지]` 토큰 v1 placeholder 유지 | 확정 |
| Q-02 | 정답 121건 정답표 별도 제공 가능 여부 | 사용자 확인 |
| Q-03 | 메뉴 라벨 한글 표기 ("MAP 기출문제") | 가정 |

---

## 9. 변경 이력

| Date | Version | Changes |
|------|---------|---------|
| 2026-05-06 | 2.0.0 | 스택을 frontend-acm + acm-map 백엔드 + Postgres `amb_acm_map_*` 로 확정 |
