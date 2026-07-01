---
document_id: PLN-260629-acm-ama-directory-teacher-picker
version: 0.1.0
status: Draft
created: 2026-06-29
product_code: ACM
title: REQ-260629 작업계획서 — AMA 디렉토리 검색 + CSL picker 교체
modules:
  - TCH
  - CSL
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260629-acm-ama-directory-teacher-picker.md
change_log:
  - { version: 0.1.0, date: 2026-06-29, author: Claude, notes: "초안 — 4 phase / WBS T-01~T-10 / 약 2-3 영업일 추정" }
---

# PLN-260629 — REQ-260629 작업계획서

## 1. Phasing

| Phase | 작업 | 의존 |
|-------|------|------|
| P1 | DB layer — `tch_ama_user_id` 컬럼 + UNIQUE 인덱스 | — |
| P2 | Backend — TeacherService.upsertFromAma + `POST /teachers/ama-import` + CSL lazy upsert hook | P1 |
| P3 | Frontend — TCH list AMA section + CSL stage 2/3 picker 교체 + i18n | P2 |
| P4 | 검증 — unit + 운영자 매트릭스 | P3 |

## 2. WBS

| ID | Task | 영역 | 의존 | 효(d) | FR |
|----|------|------|------|------|----|
| T-01 | `sql/acm/989-acm-tch-ama-user-id.sql` — 컬럼 + UNIQUE INDEX 추가, 멱등 (`IF NOT EXISTS`) | DB | — | 0.25 | FR-304 |
| T-02 | TypeORM `TeacherTypeormEntity` 에 `amaUserId` 매핑 + DTO `tchAmaUserId` 영속화 | BE | T-01 | 0.25 | FR-304 |
| T-03 | `TeacherService.upsertFromAma(entId, amaUserId, name?, email?, actorId)` — UPSERT + ON CONFLICT, AMA 디렉토리 호출 fallback | BE | T-02 | 0.5 | FR-303 / FR-305 |
| T-04 | `POST /acm/tch/teachers/ama-import` 컨트롤러 + DTO + STAFF↑ 가드 | BE | T-03 | 0.25 | FR-305 |
| T-05 | CSL `inquiry.service.ts` — schedule 저장 시 `teacherAmaUserId` 받으면 upsertFromAma 호출 후 `teacherId` 치환 | BE | T-03 | 0.5 | FR-302 / FR-303 |
| T-06 | unit spec — TeacherService.upsertFromAma (idempotent, AMA fetch fallback, UNIQUE conflict) | BE | T-03 | 0.25 | NFR-303 |
| T-07 | Frontend — `/admin/tch` 페이지에 `AmaDirectorySection` 컴포넌트 추가 (검색 + 결과 리스트 + "강사 등록"/"이미 등록됨" 분기) | FE | T-04 | 0.5 | FR-301 |
| T-08 | Frontend — `LevelTestScheduleDialog` 의 teacher select → AmaUserPicker 교체, 저장 시 `teacherAmaUserId` 전송 | FE | T-05 | 0.25 | FR-302 |
| T-09 | Frontend — `DemoClassRow` 의 teacher select → AmaUserPicker 교체 | FE | T-05 | 0.25 | FR-302 |
| T-10 | i18n 4 locale — `tch.amaDirectory.*` + `csl.detail.{levelTest,trial}.teacherPicker.*` | FE | T-07/8/9 | 0.25 | NFR-304 |

**총**: ~3 man-day. 1 PR 단일 트랙.

## 3. UI 목업

[docs/analysis/REQ-260629 §5 참조] — 본 계획서로 갈음.

## 4. 데이터 모델 변경

### sql/acm/989-acm-tch-ama-user-id.sql

```sql
-- REQ-260629 FR-304: tch_ama_user_id 영속화 + UNIQUE per tenant
ALTER TABLE amb_acm_tch_teacher
  ADD COLUMN IF NOT EXISTS tch_ama_user_id VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acm_tch_ama_user_id
  ON amb_acm_tch_teacher (ent_id, tch_ama_user_id)
  WHERE tch_ama_user_id IS NOT NULL AND deleted_at IS NULL;
```

## 5. API 변경 / 신규

| Method | Path | 권한 | 응답 |
|---|---|---|---|
| POST | `/acm/tch/teachers/ama-import` | STAFF↑ | `{ teacherId, created }` |
| PUT  | `/acm/csl/inquiries/:inqId/level-tests/:testType` | (기존) | DTO 에 `teacherAmaUserId?` 추가, 받으면 upsertFromAma → teacherId 치환 |
| PATCH| `/acm/csl/inquiries/:inqId/trial-classes/:tclId` | (기존) | 동일 |

## 6. 마일스톤

| M | 기준 | 포함 |
|---|------|------|
| M1 데이터 + 백엔드 | 989 SQL apply + upsertFromAma + ama-import endpoint + unit spec green | T-01~T-06 |
| M2 프론트 + i18n | /admin/tch AMA section + CSL stage 2/3 picker + 4 locale 라벨 | T-07~T-10 |
| M3 검증 | 운영자 staging 매트릭스 통과 | — |

## 7. 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| AMA 디렉토리 응답 형식 변경 | 중 | `AmaUserDirectoryService` 가 이미 5xx/timeout fallback. 본 변경은 그 위에 layer 만 추가 |
| lazy upsert 동시성 (같은 amaUserId 두 곳에서 동시) | 저 | UNIQUE INDEX + `ON CONFLICT DO UPDATE` |
| 기존 amb_acm_tch_teacher 데이터에 amaUserId 비어 있음 | 저 | backfill 워커는 별도 (본 PR 외). 점진적 마이그 |
| AMA OWNER 사용자 노출 | 고 | 클라+서버 양쪽 화이트리스트 (REQ-260604 FR-5) |

## 8. 검증

- T-06 unit spec: upsertFromAma 3 케이스 (신규 / 기존 / 동시성 sim)
- 운영자 매트릭스:
  - `/admin/tch` AMA 섹션 검색 → 결과 → "강사 등록" → 모달 prefill → 저장 → 리스트에 신규 행 출현
  - 동일 사용자 다시 검색 → "이미 등록됨" 배지
  - `/admin/csl/<inq>` 2단계 schedule → AMA 검색 → 로컬에 없는 사용자 선택 → 저장 → 다음 새로고침 시 강사 마스터에 자동 추가됨, CAL 이벤트도 정상
  - 3단계 데모수업 동일
  - 4 locale 토글 검증
