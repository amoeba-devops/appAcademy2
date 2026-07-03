---
document_id: APP-ACADEMY-RUNBOOK-CURRENT
version: 1.0.0
status: Active
created: 2026-07-04
audience: Ops / Maintainer
---

# app-academy — Current Deployment Runbook

현재 운영 기준은 PostgreSQL-only ACM 스택이다. MySQL runtime, cutover script, legacy migration runner는 제거되었으며 이 문서는 현재 저장소 기준의 배포 절차만 다룬다.

## 0. Current State Snapshot (2026-07-04)

- Production runtime: `tac-prod-mysql` removed
- Staging runtime: `tac-mysql` removed
- Staging legacy frontend: `tac-frontend` retired
- Active datastore: PostgreSQL `db_acm` only
- Retained legacy artifacts: `db_tac-*.sql.gz` backup archives may remain under `/var/backups/app-academy/*/`

## 1. 현재 런타임

| 영역 | 현재 기준 |
| --- | --- |
| Frontend | `frontend-acm` Vite SPA |
| Backend | `backend` NestJS API |
| Database | PostgreSQL `db_acm` |
| Cache | Redis |
| Object Storage | MinIO |
| Migration source | `sql/acm/*.sql` |

## 2. 주요 경로

| 항목 | 경로 |
| --- | --- |
| Staging compose | `docker/staging/docker-compose.staging.yml` |
| Production compose | `docker/production/docker-compose.production.yml` |
| Staging deploy | `scripts/deploy-staging.sh` |
| Production deploy | `scripts/deploy-production.sh` |
| Backend env example | `backend/.env.example` |
| Current standard | `docs/standard/SPEC.md` |

## 3. Canonical host

| 환경 | 호스트 |
| --- | --- |
| Staging | `https://acm-stg.amoeba.site/` |
| Production ACM SPA | `https://acm.amoeba.site/` |

## 4. Staging 배포

스테이징 호스트에서 저장소가 최신 상태라는 가정 하에 다음 명령을 사용한다.

```bash
cd ~/app-academy
scripts/deploy-staging.sh
```

스크립트가 수행하는 일:

1. `origin/main` 동기화
2. GHCR pull 또는 로컬 build
3. `redis`, `postgres-acm`, `minio`, `minio-init` 기동
4. `sql/acm/*.sql` 순차 적용
5. 업로드 디렉토리 권한 보정
6. `backend`, `frontend-acm` 재기동
7. nginx vhost 동기화 및 reload
8. smoke test 후 `.last-deploy` 기록

## 5. Production 배포

프로덕션 호스트에서 다음 명령을 사용한다.

```bash
cd ~/app-academy
scripts/deploy-production.sh
```

스크립트가 수행하는 일:

1. `origin/main` 동기화
2. GHCR pull 또는 로컬 build
3. `redis`, `postgres-acm`, `minio`, `minio-init` 기동
4. `sql/acm/*.sql` 순차 적용
5. 업로드 디렉토리 권한 보정
6. `backend`, `frontend-acm` 재기동
7. `acm.amoeba.site` nginx vhost 동기화 및 reload
8. smoke test 후 `.last-deploy` 기록

## 6. 배포 전 확인

- `docker/staging/.env.staging` 또는 `docker/production/.env.production` 존재
- `ACM_PG_*`, `ACM_PII_KEY`, `ACM_JWT_SECRET` 값 확인
- `ACM_S3_ROOT_USER`, `ACM_S3_ROOT_PASSWORD`, `ACM_S3_BUCKET` 값 확인
- `AMA_*`, `BODA_*` 운영 값 확인
- 서버에 `docker`, `docker compose`, `nginx` 설치 확인

## 7. 검증 포인트

- API health: `http://127.0.0.1:4000/api/health`
- Production app: `https://acm.amoeba.site/`
- Staging app: `https://acm-stg.amoeba.site/`
- migration marker: `sql/_applied/acm/*.sha256`

## 8. 주의 사항

- 신규 스키마 변경은 `sql/acm/*.sql` 로만 반영한다.
- TypeORM `synchronize` 는 사용하지 않는다.
- 과거 `RUNBOOK.md`, `CUTOVER.md`, `RUNBOOK-260622-cutover.md`, `UAT-CHECKLIST.md` 는 참고용 아카이브다.
- MySQL 관련 명령, `db_tac`, `tac_*`, `scripts/migrate-mysql-to-pg/*` 기준 절차는 현재 운영 문서로 사용하지 않는다.
- legacy MySQL rollback 자산은 런타임이 아니라 백업 아카이브로만 유지한다.
