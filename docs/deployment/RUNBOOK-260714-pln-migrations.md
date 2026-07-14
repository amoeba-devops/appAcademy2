---
document_id: RUNBOOK-260714-pln-migrations
version: 1.0.0
status: ACTIVE
created: 2026-07-14
related: PLN-260714-csl-std-enrollment-portal, PR#127
---

# RUNBOOK-260714 — PLN-260714 마이그레이션 적용 (staging/prod)

## 1. Overview (개요)

PR #127 (PLN-260714) 은 `sql/acm/1000~1003` 4개 마이그레이션을 포함한다. TAC 는 SQL 자동 실행 메커니즘이 없으므로 **코드 배포 전/후 각 환경 `db_acm` 에 수동 적용**해야 한다. 전부 idempotent (재실행 안전).

| 파일 | 내용 | 미적용 시 증상 |
|------|------|----------------|
| `940-acm-std-student-extension.sql` | `std_teacher_id` 컬럼/FK (선행 — `1004` 로 대체 보장 가능) | 학생 생성/수정 500 (`column std_teacher_id does not exist`) |
| `989-acm-tch-ama-user-id.sql` | `tch_ama_user_id` 컬럼 (선행) | 강사 목록 500 (`column tch_ama_user_id does not exist`) |
| `995-acm-portal-account.sql` | 포털계정 테이블 (선행 조건) | `1003` 실패 (relation 없음) — 이미 있으면 skip |
| `1000-acm-csl-attending-stage.sql` | `inq_current_stage` CHECK 에 `ATTENDING` | 6→7(수강중) 전환이 CHECK 위반 500 |
| `1001-acm-csl-cancel-reason-simple.sql` | `cnc_reason_code` CHECK 에 `SIMPLE_INQUIRY_END` | 상담종료 기본사유 저장 실패 |
| `1002-acm-std-email-unique.sql` | `uq_acm_std_ent_email` 부분 유니크 인덱스 | 이메일 중복 검사 DB 레벨 미보장 |
| `1003-acm-portal-student-email-login.sql` | `pac_login_id` 200 확장 + STUDENT 로그인ID=이메일 백필 | 이메일 로그인ID 저장/백필 불가 |
| `1004-acm-std-teacher-fk-ensure.sql` | `std_teacher_id` 컬럼/FK 보장(940 미적용 환경 대비) | 학생 생성/수정 500 |

**적용 순서**: (`940`/`989`/`995` 미적용 환경이면 먼저) → `1000` → `1001` → `1002` → `1003` → `1004`
> `1004` 는 `940` 의 `std_teacher_id` 부분을 idempotent 하게 재보장하므로, `940` 이 이미 적용됐으면 no-op. `989`(강사목록)·`995`(포털계정)·`940`(강사FK)은 이번 PR 이전 마이그레이션이지만 환경에 따라 미적용일 수 있어 함께 확인한다. (로컬 db_acm 은 940/989/995 가 미적용이라 이번에 함께 적용함)

## 2. Pre-flight — 이메일 중복 점검 (1002 전 필수)

`1002` 는 기존 데이터에 테넌트 내 중복 이메일(대소문자 무시)이 있으면 인덱스 생성이 **실패**한다. 먼저 조회:

```sql
SELECT ent_id, LOWER(std_email) AS email, COUNT(*)
FROM amb_acm_std_student
WHERE std_email IS NOT NULL AND deleted_at IS NULL
GROUP BY ent_id, LOWER(std_email)
HAVING COUNT(*) > 1;
```

결과가 있으면 운영자가 중복 이메일을 정리(수정/소프트삭제)한 뒤 `1002` 를 재실행한다. 0건이면 그대로 진행.

## 3. Apply (적용)

### 3.1 로컬/개발 (docker container 직접)
```bash
cd ~/app-academy   # repo 루트
for f in 1000-acm-csl-attending-stage 1001-acm-csl-cancel-reason-simple \
         1002-acm-std-email-unique 1003-acm-portal-student-email-login \
         1004-acm-std-teacher-fk-ensure; do
  docker exec -i acm-postgres psql -U acm -d db_acm < sql/acm/$f.sql
done
# 995 가 없던 환경이면 위 루프 앞에 995-acm-portal-account.sql 먼저 적용
```
> 로컬 db_acm(port 5434) 에는 2026-07-14 적용·검증 완료 (995 포함).

### 3.2 staging / production (SSH)
`appacademy@acm-stg.amoeba.site` / `appacademy@acm.amoeba.site`, `~/app-academy` 체크아웃 + docker compose 기준.

```bash
ssh appacademy@acm-stg.amoeba.site        # prod: acm.amoeba.site
cd ~/app-academy && git pull               # PR 머지 후 최신 sql/acm 반영
# db_acm Postgres 컨테이너명 확인 (예: acm-postgres) — compose ps 로 확인
docker compose ps | grep -i postgres
# 컨테이너/자격증명은 각 환경 compose 기준으로 대체
for f in 1000-acm-csl-attending-stage 1001-acm-csl-cancel-reason-simple \
         1002-acm-std-email-unique 1003-acm-portal-student-email-login \
         1004-acm-std-teacher-fk-ensure; do
  docker exec -i <acm_pg_container> psql -U <acm_user> -d db_acm < sql/acm/$f.sql
done
```
> ⚠️ 컨테이너명·DB user 는 환경별 compose/.env 로 확인해 대체할 것. 배포 순서는 **마이그레이션 먼저 → 코드(컨테이너) 재시작** 권장(신규 엔티티가 신규 컬럼/CHECK 를 참조).

## 4. Verify (검증)

```sql
-- CHECK 두 개
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN ('chk_acm_csl_inq_current_stage','chk_acm_csl_cnc_reason_code');
-- 인덱스
SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_acm_std_ent_email';
-- 컬럼 폭
SELECT character_maximum_length FROM information_schema.columns
WHERE table_name='amb_acm_portal_account' AND column_name='pac_login_id';  -- 200
```
기대: 두 CHECK 에 각각 `ATTENDING` / `SIMPLE_INQUIRY_END` 포함, 부분 유니크 인덱스 존재, pac_login_id=200.

## 5. Rollback (롤백)
데이터 파괴 없음. 코드 롤백 시 CHECK 의 신규 허용값/인덱스는 남겨도 무해(구 코드가 새 값을 쓰지 않음). 굳이 되돌릴 필요 없음. `1003` 백필로 바뀐 로그인ID 는 사용자에게 이미 고지되었을 수 있으므로 임의 원복 금지.
