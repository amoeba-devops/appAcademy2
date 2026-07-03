---
document_id: RPT-260704-mysql-legacy-runtime-removal
version: 1.0.0
status: Completed
created: 2026-07-04
audience: Ops / Maintainer / Dev
---

# MySQL Legacy Runtime Removal Report

## 1. Summary

2026-07-04 기준 app-academy ACM staging/production 환경에서 legacy MySQL runtime 을 제거했다. 현재 ACM 운영 스택은 PostgreSQL `db_acm` 단일 데이터소스로 동작한다.

## 2. Scope

- Production host
  - removed container: `tac-prod-mysql`
  - removed host data directory: `~/app-academy/data/mysql`
  - removed leftover init file: `~/app-academy/docker/production/mysql-init.sql`
- Staging host
  - removed container: `tac-mysql`
  - removed host data directory: `~/app-academy/data/mysql`
  - removed leftover init file: `~/app-academy/docker/staging/mysql-init.sql`

## 3. Verification

### Production

- `https://acm.amoeba.site/api/health` → `success: true`
- `https://acm.amoeba.site/api/portal/programs` → `success: true`
- running services: `tac-prod-backend`, `acm-prod-frontend`, `tac-prod-postgres-acm`, `tac-prod-redis`, `tac-prod-minio`
- absent service: `tac-prod-mysql`

### Staging

- `https://acm-stg.amoeba.site/api/health` → `success: true`
- `https://acm-stg.amoeba.site/api/portal/programs` → `success: true`
- running services: `tac-backend`, `acm-frontend`, `tac-postgres-acm`, `tac-redis`, `tac-minio`
- absent service: `tac-mysql`

## 4. Backup Retention

Legacy MySQL runtime 은 제거했지만 rollback/reference 용 dump archive 는 유지한다.

- production backup path confirmed: `/var/backups/app-academy/production/db_tac-*.sql.gz`
- staging local dump path was not populated at verification time; runtime cleanup only was confirmed on host

즉, 현재 상태는 "runtime 제거 완료 + backup archive 유지" 이다.

## 5. Notes

- 저장소 기준 compose/runtime/env example 은 이미 PostgreSQL-only 상태였다.
- `backend/.env` 에 남아 있는 MySQL 값은 tracked config 가 아닌 로컬 개발용 파일이므로 본 정리 범위에 포함하지 않았다.
- staging legacy `tac-frontend` 정리는 동일 일자 후속 작업으로 완료되었고, 별도 정리 기록으로 남긴다.
