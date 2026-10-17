---
document_id: APP-ACADEMY-SERVER-INVENTORY-1.0.0
version: 1.0.0
status: Active
created: 2026-10-17
audience: Ops / Maintainer
related: RUNBOOK-CURRENT, RUNBOOK-261017-fresh-environment, DEPLOY-SECRETS-SETUP
change_log:
  - 1.0.0 (2026-10-17): 최초 작성 — 스테이징·프로덕션 서버 현황(프로덕션은 호스트 읽기 전용 점검, 스테이징은 저장소·외부 응답 기준)
---

# Staging & Production Server Inventory (스테이징·프로덕션 서버 정보)

> 비밀값(비밀번호·키·토큰)은 이 문서에 적지 않는다. 위치만 적는다.
> 확인 방법: 프로덕션 = 2026-10-17 호스트 읽기 전용 점검, 스테이징 = 저장소 설정 + 외부 HTTP 응답(호스트 접속 키 없음).

## 1. Summary (요약)

| 항목 | Staging | Production |
| --- | --- | --- |
| URL | https://acm-stg.amoeba.site | https://acm.amoeba.site |
| IP | 125.133.49.165 | 211.110.140.172 (hostname `qm391-0860`) |
| 호스트 | 스테이징 전용(추정) | **공유 호스트** — 메일서버(amb-stalwart), sharptalk·btbz·ksr 스택과 함께 |
| SSH 사용자 | `appacademy` | `appacademy` (root 작업은 별도 경로, 3.2) |
| 배포 | `main` push → 자동 (`cd-staging.yml`) | 수동 `gh workflow run cd-production.yml -f sha=<short-sha>` |
| 현재 배포 커밋 (10-17) | `516523d` | `516523d` |
| 배포 스크립트 | `scripts/deploy-staging.sh` | `scripts/deploy-production.sh` |
| Compose | `docker/staging/docker-compose.staging.yml` | `docker/production/docker-compose.production.yml` |
| env 파일 (호스트) | `~/app-academy/docker/staging/.env.staging` | `~/app-academy/docker/production/.env.production` |
| NODE_ENV | production | production |
| TLS 인증서 | `*.amoeba.site` 와일드카드 (Let's Encrypt, 만료 2026-11-18) | `acm.amoeba.site` 단일 (Let's Encrypt, 만료 2026-11-26, 자동 갱신) |

## 2. Runtime Stack (구성)

두 환경 모두 호스트 nginx(443 TLS 종단) → 127.0.0.1 로만 열린 Docker 컨테이너.

| 서비스 | Staging 컨테이너 | Production 컨테이너 | 내부 포트(127.0.0.1) | 이미지 |
| --- | --- | --- | --- | --- |
| Frontend (Vite SPA, nginx) | `acm-frontend` | `acm-prod-frontend` | 5174 → 80 | `ghcr.io/amoeba-devops/appacademy2/acm-frontend:<sha>` |
| Backend (NestJS) | `tac-backend` | `tac-prod-backend` | 4000 | `ghcr.io/amoeba-devops/appacademy2/tac-backend:<sha>` |
| PostgreSQL 16 + pg_bigm | `tac-postgres-acm` | `tac-prod-postgres-acm` | 5434 → 5432 | `tac-postgres-acm:pg16-bigm` (호스트에서 빌드) |
| Redis 7 | `tac-redis` | `tac-prod-redis` | 6379 | `redis:7-alpine` |
| MinIO (첨부 저장소) | `tac-minio` | `tac-prod-minio` | 9000 / 9001 | `minio/minio:RELEASE.2025-04-22T22-12-26Z` |

- DB: `db_acm`, 사용자 `acm`. 마이그레이션은 배포 때 `sql/acm/*.sql` 자동 적용(`scripts/acm-migration-order.sh` 순서, 적용 기록 `sql/_applied/acm/*.sha256`). 현재 136개.
- 컨테이너 포트는 호스트 외부에 열려 있지 않다(전부 `127.0.0.1` 바인드).
- 호스트 nginx vhost: 저장소 `docker/production/nginx-acm.conf` → 호스트 `/etc/nginx/sites-available/acm.amoeba.site` (배포 스크립트가 동기화·reload).
- 공개 경로: `/` SPA, `/admin/*`, `/portal/*`, `/web/manual/` 매뉴얼, `/api/*` 백엔드. Swagger(`/api/docs`)는 운영·스테이징 모두 비활성(404).

### 2.1 Production host (2026-10-17 점검)

| 항목 | 값 |
| --- | --- |
| OS | Ubuntu 22.04.5 LTS, kernel 5.15 |
| CPU / RAM | 4 vCPU / 31 GiB (사용 약 4 GiB) |
| Disk `/` | 229 GB 중 135 GB 사용(62%) — 다른 스택과 공유 |
| Docker / Compose | 29.5.2 / v5.1.4 |
| 저장소 | `~/app-academy` (`amoeba-devops/appAcademy2`) |
| 업로드·MinIO 데이터 | `DATA_DIR=/home/appacademy/app-academy/data` (약 740 MB) |
| sudo | 비밀번호 필요 |

### 2.2 주요 비밀 아닌 설정값 (production)

| 키 | 값 |
| --- | --- |
| `FRONTEND_URL` | `https://acm.amoeba.site` |
| `AMA_TOKEN_VERIFY_MODE` | `local_config` |
| `BODA_MODE` | `http` (보다스쿨 실연동) |
| `ACM_PUBLIC_URL` | 미설정 → 메일 링크는 `FRONTEND_URL` 사용 |
| `ACM_INITIAL_ADMIN_PASSWORD` | 미설정(정상 — 새 환경 첫 기동 때만 사용) |

## 3. Access (접속)

### 3.1 SSH (appacademy)

| 환경 | 명령 | 키 |
| --- | --- | --- |
| Production | `ssh acm-prod` (`~/.ssh/config` alias → `appacademy@acm.amoeba.site`) | `~/.ssh/id_ed25519_acm_prod` |
| Staging | `ssh appacademy@acm-stg.amoeba.site` | 개발 PC 에 등록된 키 없음 — GitHub `staging` Environment 의 deploy 키만 등록됨 |

### 3.2 Production root 작업

인증서·nginx 등 root 작업은 같은 IP 의 메일서버 관리 경로(`amb-mail` alias, root)로 한다. appacademy 의 sudo 는 비밀번호가 필요하다.

### 3.3 GitHub Environments (배포 비밀)

| Environment | Secrets |
| --- | --- |
| `staging` | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_SSH_PORT` |
| `production` | `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_SSH_PORT` |

`production` Environment 에 승인자(required reviewer)가 **없다** — dispatch 하면 바로 배포된다.

### 3.4 DB 조회(읽기 전용, production)

```bash
ssh acm-prod "docker exec -i tac-prod-postgres-acm sh -c 'psql -U \"\$POSTGRES_USER\" -d db_acm'" <<'SQL'
SELECT count(*) FROM amb_acm_user;
SQL
```

SQL 은 stdin(heredoc)으로 넘긴다 — `sh -c "…"` 안에 넣으면 `$` 가 확장된다.

## 4. Deploy Flow (배포 흐름)

```
PR 머지 → main push
  └ cd-staging.yml: 이미지 2개 빌드·GHCR push(:<sha>, :staging) → SSH → deploy-staging.sh
      (git reset → 마이그레이션 → 컨테이너 교체 → nginx reload → smoke)
수동: gh workflow run cd-production.yml -f sha=<short-sha>
  └ preflight(GHCR 이미지 확인) → SSH → deploy-production.sh (같은 단계) → smoke https://acm.amoeba.site/
```

- 프로덕션 배포는 **그 커밋의 main 전체**를 내보낸다(마이그레이션 포함).
- backend 만 다시 띄울 때 `DEPLOY_SHA` 를 꼭 붙인다. 없으면 옛 `:production` 이미지가 떠서 502.
- 검증은 무자격 방식: 있는 API 401 / 없는 경로 404, CD 로그 `[apply]`·`[skip]`, 번들 grep.

## 5. Backup (백업) — ⚠️ 조치 필요

| 항목 | 상태 |
| --- | --- |
| 자동 백업 cron (production) | `30 2 * * * scripts/backup-db.sh` — **스크립트가 7월 MySQL 제거(3189e78) 때 삭제돼 매일 실패 중**(로그 `/var/log/app-academy/backup.log` "No such file" 105회) |
| 마지막 자동 백업 | `/var/backups/app-academy/production/db_tac-*.sql.gz` (2026-07-04, MySQL 시절) — **현재 PostgreSQL `db_acm` 자동 백업 없음** |
| 수동 백업 | `~/app-academy-backups/db_acm-before-*.dump` — 큰 마이그레이션 전 수동 덤프(최신 2026-10-13, 합계 118 MB) |
| MinIO 첨부·업로드 | 백업 없음(`DATA_DIR` 약 740 MB) |
| 오프사이트(외부) 사본 | 없음 — 같은 디스크에만 있음 |
| Staging | 미확인(호스트 접속 불가) |

권장: PostgreSQL 일일 `pg_dump -Fc` + 보존 기간(예: 30일) 스크립트 복구, MinIO 데이터 포함, 외부 저장소(S3 등) 사본.

## 6. Known Issues & Cautions (주의 사항)

1. **DB 자동 백업 중단**(5장) — 가장 시급.
2. **프로덕션 배포 승인 게이트 없음**, **`main` 필수 체크 미설정** — 둘 다 저장소 소유자(`amoeba-devops`) 권한 필요.
3. 서버 계정 비밀번호가 과거 작업 메모에 평문으로 기록돼 있었다 — `appacademy` 비밀번호 **회전 권장**(staging·production 공통이었음).
4. 프로덕션은 **공유 호스트** — 디스크·메모리를 다른 스택(메일서버 포함)과 나눠 쓴다. 대용량 작업 전 `df -h` 확인.
5. 스테이징 공개 시드 계정: 운영 모드에서 공개 시드 비밀번호 로그인은 거부된다(REQ-261017B). 스테이징에 남아 있으면 `ACM_INITIAL_ADMIN_PASSWORD` 로 해제([RUNBOOK-261017](RUNBOOK-261017-fresh-environment.md) 4장).
6. 옛 호스트명 정리: `app-academy-stg.amoeba.site` 는 DNS 없음, `tpi.amoeba.site` 는 다른 IP(18.138.206.18)로 바뀌어 응답 없음 — `staging.md`(Archived)의 호스트 표는 더 이상 유효하지 않다.
7. TLS: production 은 certbot webroot + `systemctl reload nginx` 훅으로 자동 갱신(2026-08-28 만료 사고 후 전환). staging 와일드카드(만료 2026-11-18)는 DNS 인증이 필요한 형식이라 자동 갱신 여부를 스테이징 호스트에서 확인해야 한다.
