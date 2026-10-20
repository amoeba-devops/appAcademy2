---
document_id: APP-ACADEMY-SERVER-INVENTORY-1.0.0
version: 1.2.0
status: Active
created: 2026-10-17
audience: Ops / Maintainer
related: RUNBOOK-CURRENT, RUNBOOK-261017-fresh-environment, DEPLOY-SECRETS-SETUP
change_log:
  - 1.2.0 (2026-10-20): 구 서버 ACM 정리 완료(백업 후)
  - 1.1.0 (2026-10-20): 프로덕션 새 서버(175.126.232.175) 전환 반영, 백업 복구, 구 서버 보존 정보
  - 1.0.0 (2026-10-17): 최초 작성 — 스테이징·프로덕션 서버 현황(프로덕션은 호스트 읽기 전용 점검, 스테이징은 저장소·외부 응답 기준)
---

# Staging & Production Server Inventory (스테이징·프로덕션 서버 정보)

> 비밀값(비밀번호·키·토큰)은 이 문서에 적지 않는다. 위치만 적는다.
> 확인 방법: 프로덕션 = 2026-10-17 호스트 읽기 전용 점검, 스테이징 = 저장소 설정 + 외부 HTTP 응답(호스트 접속 키 없음).

## 1. Summary (요약)

| 항목 | Staging | Production |
| --- | --- | --- |
| URL | https://acm-stg.amoeba.site | https://acm-tpi.amoeba.site (메인) · https://acm.amoeba.site |
| IP | 125.133.49.165 | **175.126.232.175** (cafe24 `qm381-0103`) — 2026-10-17 전환. 구 서버 211.110.140.172 의 ACM 은 2026-10-20 정리 완료 |
| 호스트 | 스테이징 전용(추정) | ACM 전용 |
| SSH 사용자 | `appacademy` | `appacademy`(키 전용, 제한 sudo) · root(키 전용) |
| 배포 | `main` push → 자동 (`cd-staging.yml`) | 수동 `gh workflow run cd-production.yml -f sha=<short-sha>` |
| 현재 배포 커밋 (10-20) | `332992f` | `332992f` |
| 배포 스크립트 | `scripts/deploy-staging.sh` | `scripts/deploy-production.sh` |
| Compose | `docker/staging/docker-compose.staging.yml` | `docker/production/docker-compose.production.yml` |
| env 파일 (호스트) | `~/app-academy/docker/staging/.env.staging` | `~/app-academy/docker/production/.env.production` |
| NODE_ENV | production | production |
| TLS 인증서 | `*.amoeba.site` 와일드카드 (Let's Encrypt, 만료 2026-11-18) | `acm-tpi.amoeba.site`(만료 2027-01-15)·`acm.amoeba.site`(만료 2026-11-26) 각각, webroot 자동 갱신(dry-run 성공) |

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

### 2.1 Production host (175.126.232.175, 2026-10-20 점검)

| 항목 | 값 |
| --- | --- |
| OS | Ubuntu 22.04.5 LTS, kernel 5.15 (자동 보안 업데이트) |
| CPU / RAM | 4 vCPU / 15 GiB (+스왑 8 GiB) |
| Disk | `/` 224 GB (7% 사용), `/backup` 916 GB (백업 전용) |
| Docker / Compose | 29.9.1 / v5.6.0 (컨테이너 로그 20 MB × 5 회전) |
| 보안 | SSH 비밀번호 로그인 차단·root 키 전용, ufw 22·80·443, fail2ban |
| 저장소 | `~/app-academy` (`amoeba-devops/appAcademy2`) |
| 업로드·MinIO 데이터 | `DATA_DIR=/home/appacademy/app-academy/data` |
| sudo | appacademy 는 배포에 필요한 명령만 무비밀번호(`/etc/sudoers.d/appacademy-deploy`) — env `SUDO_PASS` 불필요 |

### 2.2 주요 비밀 아닌 설정값 (production)

| 키 | 값 |
| --- | --- |
| `FRONTEND_URL` | `https://acm.amoeba.site` — 수업 런처·광고 OAuth 리디렉트가 사용, 보다스쿨·Google 등록 변경 전까지 유지 |
| `AMA_TOKEN_VERIFY_MODE` | `local_config` |
| `BODA_MODE` | `http` (보다스쿨 실연동) |
| `ACM_PUBLIC_URL` | `https://acm-tpi.amoeba.site` (메일·알림 링크) |
| `ACM_INITIAL_ADMIN_PASSWORD` | 미설정(정상 — 새 환경 첫 기동 때만 사용) |

## 3. Access (접속)

### 3.1 SSH (appacademy)

| 환경 | 명령 | 키 |
| --- | --- | --- |
| Production | `ssh acm-new` (appacademy) · `ssh acm-new-root` (root) | `~/.ssh/id_ed25519_acm_new` |
| 구 서버(ACM 정리됨, 다른 서비스 호스트) | `ssh acm-prod` / `acm-old` → 211.110.140.172 | `~/.ssh/id_ed25519_acm_prod` |
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
ssh acm-new "docker exec -i tac-prod-postgres-acm sh -c 'psql -U \"\$POSTGRES_USER\" -d db_acm'" <<'SQL'
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

## 5. Backup (백업)

| 항목 | 상태 |
| --- | --- |
| 자동 백업 | `scripts/backup-acm.sh` 매일 02:30 KST — `pg_dump -Fc db_acm` + MinIO·업로드 tar.gz, 검증 후 확정 |
| 위치·보관 | 새 서버 `/backup/app-academy/production`, 30일 |
| 구 서버 최종 백업 | 새 서버 `/backup/app-academy/old-server-211.110.140.172/` (2026-10-20, README·SHA256SUMS 포함, 권한 600 — env 비밀값 포함) |
| 최근 결과 | 2026-10-20 02:30 DB 7.7 MB · MinIO 674 MB · 업로드 7.2 MB, 약 30초 |
| 복원 검증 | 2026-10-17 리허설·전환 때 이 백업 형식으로 복원, 167 테이블 행 수 일치 |
| 오프사이트 사본 | 없음 — 같은 서버의 별도 디스크(`/backup`)에만 있음. 외부 저장소 사본 권장 |
| Staging | 미확인(호스트 접속 불가) |

> 7월 MySQL 제거 때 이전 백업 스크립트가 삭제돼 2026-10-17 까지 자동 백업이 없었다(PR #350 으로 복구).

## 6. Known Issues & Cautions (주의 사항)

1. ~~DB 자동 백업 중단~~ — 2026-10-17 복구(5장). 남은 것: 외부 저장소 사본.
2. **프로덕션 배포 승인 게이트 없음**, **`main` 필수 체크 미설정** — 저장소 소유자(`amoeba-devops`) 권한 필요.
3. 서버 계정 비밀번호가 과거 작업 메모에 평문으로 기록돼 있었다 — 스테이징·구 서버 `appacademy` 비밀번호 **회전 권장**(새 서버는 비밀번호 로그인 차단).
4. 구 서버(211.110.140.172) ACM 정리 완료(2026-10-20): 최종 백업 → 컨테이너 6·이미지 451·network·nginx vhost 3·인증서·cron·서버 간 직결 키 삭제, 새 서버 `acm-cutover-realip.conf` 삭제. 데이터 파일(`~/app-academy` 등 약 4.5 GB)은 백업 후 남겨 둠 — 삭제는 소유자가 직접.
4a. MinIO 이미지(`minio/minio`)는 Docker Hub 에서 더 이상 받을 수 없다 — 새 환경은 기존 서버에서 `docker save/load` 로 옮긴다(대체 레지스트리 마련 필요).
5. 스테이징 공개 시드 계정: 운영 모드에서 공개 시드 비밀번호 로그인은 거부된다(REQ-261017B). 스테이징에 남아 있으면 `ACM_INITIAL_ADMIN_PASSWORD` 로 해제([RUNBOOK-261017](RUNBOOK-261017-fresh-environment.md) 4장).
6. 옛 호스트명 정리: `app-academy-stg.amoeba.site` 는 DNS 없음, `tpi.amoeba.site` 는 다른 IP(18.138.206.18)로 바뀌어 응답 없음 — `staging.md`(Archived)의 호스트 표는 더 이상 유효하지 않다.
7. TLS: production 은 certbot webroot + `systemctl reload nginx` 훅으로 자동 갱신(2026-08-28 만료 사고 후 전환). staging 와일드카드(만료 2026-11-18)는 DNS 인증이 필요한 형식이라 자동 갱신 여부를 스테이징 호스트에서 확인해야 한다.
