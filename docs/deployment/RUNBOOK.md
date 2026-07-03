---
document_id: APP-ACADEMY-RUNBOOK-1.0.0
version: 1.0.1
status: Archived Reference
created: 2026-04-27
audience: Ops / on-call
---

# app-academy — Deployment & Operations RUNBOOK

운영 환경 절차 — 배포·롤백·DB 백업/복구·도메인 컷오버.

> **2026-07-04 아카이브 안내**: 이 문서는 MySQL legacy 운영 절차를 포함한 과거 runbook이다. 현재 배포 기준은 PostgreSQL-only 이며, 실제 적용 절차는 `scripts/deploy-staging.sh`, `scripts/deploy-production.sh`, `docker/{staging,production}/docker-compose.*.yml`, `docs/standard/SPEC.md` 를 우선 참조한다.

---

## 1. Environments (환경)

| Env | Host (logical) | Public URL | Compose | Backups |
|-----|----------------|------------|---------|---------|
| **Staging** | `staging` (DigitalOcean / 자체) | https://app-academy-stg.amoeba.site | [docker/staging/docker-compose.staging.yml](../../docker/staging/docker-compose.staging.yml) | `/var/backups/app-academy/staging/`, **7d 보관** |
| **Production** | `production` | https://app-academy.amoeba.site | [docker/production/docker-compose.production.yml](../../docker/production/docker-compose.production.yml) | `/var/backups/app-academy/production/`, **30d 보관** |
| Legacy | (staging만) | https://tpi.amoeba.site → 301 | — | — (cut-over 후 6mo 유지) |

> **로컬 개발 포트는 별도 규칙**: Frontend 3009 / Backend 4009 — `CLAUDE.md §4.7` 참고. Staging/Production 컨테이너는 3000/4000을 사용한다.

---

## 2. CI/CD Flow (CI/CD 흐름)

```
PR → CI (lint/typecheck/tests/Trivy)
        │
        └─ merge to main
                │
                ▼
        CD-Staging (auto)
        ├ build & push GHCR images :{sha} :staging
        └ SSH staging → scripts/deploy-staging.sh
                │
                ▼
        🟢 Staging green → manual UAT
                │
                ▼
        CD-Production (workflow_dispatch + Environment approval)
        ├ verify image SHA exists in GHCR
        └ SSH prod → scripts/deploy-production.sh
                ├ pre-deploy DB backup (mandatory)
                ├ pull image :{sha}
                ├ apply pending SQL migrations
                └ smoke test https://app-academy.amoeba.site/
```

### Required GitHub secrets

| Secret | Used by | Notes |
|--------|---------|-------|
| `STAGING_SSH_HOST` / `_USER` / `_KEY` / `_PORT` | cd-staging | passwordless ed25519 |
| `PRODUCTION_SSH_HOST` / `_USER` / `_KEY` / `_PORT` | cd-production | separate keypair, restrict to deploy user |
| `GITHUB_TOKEN` (auto) | both | GHCR push (cd-staging) + read (cd-production) |

### Required GitHub Environments

- `staging` — no approval required, auto-deploys on push to `main`.
- `production` — **required reviewers** (min 1), wait timer optional, restrict to `main`.

---

## 3. Production Deploy (정상 배포)

1. CD-Staging이 `main`을 빌드해 staging에 자동 배포되었는지 확인 (`#deploys` 채널 / Actions UI).
2. UAT 체크리스트 통과 — 최소: 로그인, AMA SSO 콜백, 결제 1건, 주요 어드민 화면.
3. Actions → **CD — Production** → **Run workflow**
   - `sha`: 배포할 커밋 SHA (full or 7-char short — 반드시 staging에서 검증된 것)
   - `skip_smoke`: 비워둠
4. Environment approval — 다른 메인테이너가 Approve.
5. Workflow가 다음을 수행한다:
   - GHCR에서 `tac-backend:{sha}` + `tac-frontend:{sha}` manifest 존재 확인
   - SSH로 prod host 진입 → `scripts/deploy-production.sh` 실행
   - 사전 DB 백업 (실패 시 abort)
   - SQL 마이그레이션 (idempotent)
   - 컨테이너 재시작 + nginx 리로드
   - smoke test
6. 배포 후 5분간 모니터링 — 에러 로그(`docker logs tac-prod-backend --tail 100 -f`), HTTP 5xx율.

---

## 4. Rollback (롤백)

### 4.1 즉시 롤백 (이미지만 되돌리기)
이전 정상 SHA가 있으면:
```bash
# Actions → CD — Production → Run workflow
#   sha: <previous-known-good-sha>
#   skip_smoke: false
```

### 4.2 SQL 마이그레이션이 동반된 롤백
신규 SQL이 비파괴(컬럼 추가 등)면 이미지 롤백만으로 충분 — 신규 컬럼은 무시된다.
파괴적 SQL(컬럼 삭제, 제약 변경)이면:
1. `STACK=production scripts/backup-db.sh` 한 번 더 (현재 상태 보존)
2. `/var/backups/app-academy/production/` 에서 배포 직전 백업 식별:
   ```bash
   ls -lh /var/backups/app-academy/production/db_tac-*.sql.gz | tail -5
   ```
3. 컨테이너 정지:
   ```bash
   cd ~/app-academy && \
   docker compose -f docker/production/docker-compose.production.yml \
                  --env-file docker/production/.env.production \
                  stop backend frontend
   ```
4. DB 복구 (§5.2)
5. `sql/_applied/<문제파일>.sha256` 마커 삭제 (재적용 방지가 필요하면 그대로)
6. `git revert <commit>` 후 정상 배포 진행

---

## 5. Database Backup & Restore (DB 백업/복구)

### 5.1 Backup
- 자동: cron (§7) — 매일 02:30 KST.
- 수동:
  ```bash
  STACK=production scripts/backup-db.sh
  # → /var/backups/app-academy/production/db_tac-YYYYMMDDTHHMMSSZ.sql.gz
  ```

### 5.2 Restore
**경고**: 기존 DB 내용을 덮어쓴다. 반드시 복구 직전에 `backup-db.sh` 한 번 더 돌려라.

```bash
# 1. 컨테이너 정지 (mysql은 그대로 두고 backend/frontend만 정지)
cd ~/app-academy
COMPOSE="docker compose -f docker/production/docker-compose.production.yml \
                       --env-file docker/production/.env.production"
$COMPOSE stop backend frontend

# 2. 복구
gunzip -c /var/backups/app-academy/production/db_tac-<TS>.sql.gz \
  | docker exec -i tac-prod-mysql mysql \
        --default-character-set=utf8mb4 \
        -uroot -p"$MYSQL_ROOT_PASSWORD" db_tac

# 3. 마커 정리 — 복구한 시점 이후 SQL은 다시 적용해야 한다
#    (필요 시 sql/_applied/*.sha256 중 해당 마이그레이션 마커만 삭제)

# 4. 컨테이너 재시작
$COMPOSE up -d backend frontend
```

---

## 6. Domain Cut-over (도메인 전환)

### 6.1 Staging cut-over (`tpi.amoeba.site` → `app-academy-stg.amoeba.site`)
완료 — `scripts/deploy-staging.sh`가 두 vhost를 동시에 설치, 구 도메인은 301 redirect.

### 6.2 Production 신규 도메인 (`app-academy.amoeba.site`)
사전 작업 (수동, 1회):
1. **DNS**: A record `app-academy.amoeba.site` → 프로덕션 호스트 IP. TTL 300으로 시작.
2. **TLS**: `*.amoeba.site` 와일드카드 인증서가 이미 `/etc/letsencrypt/live/amoeba.site/`에 있는지 확인. 없으면 DNS-01로 갱신.
3. **Nginx 사전 검증**: `nginx -t` 후 reload.
4. **app-academy 신규 입주 안내**: 학원 운영자에게 새 URL 공지.

### 6.3 Legacy 도메인 정리 (T+6mo)
`tpi.amoeba.site` vhost는 cut-over 후 6개월간 301 redirect로 유지 → 외부 북마크/링크 보호. 이후 제거:
1. `git rm docker/staging/nginx-tpi.conf`
2. `scripts/deploy-staging.sh`에서 `install_vhost ... nginx-tpi.conf` 라인 제거
3. 호스트에서 `sudo rm /etc/nginx/sites-enabled/tpi.amoeba.site /etc/nginx/sites-available/tpi.amoeba.site && sudo systemctl reload nginx`
4. DNS A record 삭제

---

## 7. Cron — Backup Schedule (백업 스케줄)

배포 호스트에 1회 설치:

```bash
# 배포 사용자(예: appacademy)의 crontab에 추가
crontab -e
```

```cron
# Daily DB backup — 02:30 KST
30 2 * * *  /home/appacademy/app-academy/scripts/backup-db.sh \
            >> /var/log/app-academy/backup.log 2>&1
```

로그 디렉터리 준비:
```bash
sudo mkdir -p /var/log/app-academy /var/backups/app-academy/staging /var/backups/app-academy/production
sudo chown $USER:$USER /var/log/app-academy /var/backups/app-academy
```

오프사이트 복제(권장):
```cron
# Hourly rclone sync to S3 cold storage
0 * * * *  rclone sync /var/backups/app-academy/production s3-cold:app-academy/production --quiet
```

---

## 8. Health Checks & Monitoring (헬스체크)

| 항목 | 명령 |
|------|------|
| HTTP | `curl -sIL https://app-academy.amoeba.site/` → 200 |
| Backend | `curl -sf https://app-academy.amoeba.site/api/health` (구현 후) |
| Container | `docker ps --filter name=tac-prod-` → 모두 `healthy` |
| MySQL | `docker exec tac-prod-mysql mysqladmin -uroot -p$MYSQL_ROOT_PASSWORD ping` |
| Disk | `df -h /var/lib/app-academy /var/backups/app-academy` (>20% 여유 유지) |
| Logs | `docker logs tac-prod-backend --tail 100 --since 10m` |

5xx 알림: 외부 모니터(예: Better Uptime, Healthchecks.io)에서 `/api/health`를 1분 간격 폴링.

---

## 9. Common Incidents (자주 발생하는 장애)

| 증상 | 원인 후보 | 1차 대응 |
|------|----------|---------|
| 502 Bad Gateway | backend container down | `docker logs tac-prod-backend --tail 200` → restart |
| AMA webhook deduped 폭주 | nonce 재전송 / clock drift | 호스트 `timedatectl status` 확인, AMA 측 로그 대조 |
| Toss webhook 401 | HMAC secret 불일치 | `.env.production` `TOSS_SECRET_KEY` 확인 |
| MySQL connection refused | mysql container restart 중 | 30s 대기, 안 되면 `docker compose logs mysql` |
| nginx 502 only on /api/webhooks/ama/ | proxy_request_buffering off 누락 | `nginx-app-academy.conf` 검증 |

---

## 10. Reference (참고)

- 배포 스크립트: [scripts/deploy-staging.sh](../../scripts/deploy-staging.sh), [scripts/deploy-production.sh](../../scripts/deploy-production.sh)
- 백업 스크립트: [scripts/backup-db.sh](../../scripts/backup-db.sh)
- Compose: [docker/staging/](../../docker/staging/), [docker/production/](../../docker/production/)
- CI/CD: [.github/workflows/cd-staging.yml](../../.github/workflows/cd-staging.yml), [.github/workflows/cd-production.yml](../../.github/workflows/cd-production.yml)
- 포트 규칙: [CLAUDE.md §4.7](../../CLAUDE.md)
