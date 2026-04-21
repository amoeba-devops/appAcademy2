---
document_id: STAGING-DEPLOY-GUIDE-1.0.0
version: 1.0.0
status: ACTIVE
---

# Staging Deployment Guide (스테이징 배포 가이드)

## 1. Overview (개요)

Target: `tpi.amoeba.site` (IP `125.133.49.165`, host user `appacademy`).

Architecture: host nginx (port 80) reverse-proxies to a Docker Compose
stack running MySQL 8, Redis 7, NestJS backend, and Next.js frontend.

## 2. Branch Policy (브랜치 정책)

| Branch | Role |
|--------|------|
| `main` | **Staging deploy source** — always deployable |
| `feat/*`, `fix/*`, `docs/*`, `chore/*` | Short-lived working branches |
| `production` | Reserved for future prod cutover (not in scope yet) |

Commit message convention: `type(scope): description` — e.g.
`feat(portal): add map-test intake form`.

## 3. First-time Server Bootstrap (최초 1회)

Run `scripts/staging-setup.sh` on the staging host. It:

1. Snapshots + stops the existing PM2 apps (`tac-backend`, `tac-frontend`)
2. Dumps the native MySQL to `~/backup-pre-docker-YYYY-MM-DD.sql`
3. Disables native MySQL + Redis services
4. Installs Docker + Compose plugin
5. Generates a GitHub deploy key at `~/.ssh/github_deploy_tpi`
   — **register the public key in GitHub** (Settings → Deploy keys,
   read-only) when prompted
6. Clones the repo to `~/app-academy` via the deploy key
7. Generates `docker/staging/.env.staging` with fresh random secrets
8. Installs the fixed nginx config (`tpi.amoeba.site`, no more `tdi` typo)

```bash
ssh appacademy@125.133.49.165
# First time: scp over the script because repo isn't cloned yet
# scp scripts/staging-setup.sh appacademy@...:/tmp/
# bash /tmp/staging-setup.sh
```

## 4. Normal Deploy Cycle (상시 배포)

```
local dev machine                    GitHub                       staging host
─────────────────                    ──────                       ────────────
edit code
git commit
git push origin main         ─▶   main updated
                                                    (manual trigger)
                                                         │
                                                         ▼
                                       ssh appacademy@125.133.49.165
                                       cd ~/app-academy
                                       scripts/deploy-staging.sh
                                                         │
                                                         ▼
                                       · git pull origin main
                                       · docker compose build
                                       · apply pending SQL migrations
                                       · docker compose up -d
                                       · nginx reload
                                       · smoke test
```

`scripts/deploy-staging.sh` is idempotent — safe to re-run after failures.

## 5. SQL Migration Strategy (SQL 관리)

Files in `sql/*.sql` are applied in **alphabetical order**. Each
successfully applied file is recorded under `sql/_applied/<filename>.sha256`
(gitignored). The deploy script:

- Skips files whose recorded SHA256 matches the on-disk hash.
- Re-applies files if their content has changed (new SHA256).

This gives simple forward-only, re-runnable migrations without a
dedicated runner (Flyway/TypeORM migrations are future scope).

## 6. Secrets (비밀값 관리)

| Secret | Where |
|--------|-------|
| MySQL passwords, JWT_SECRET, NEXTAUTH_SECRET | `docker/staging/.env.staging` (chmod 600, server-only) |
| GitHub deploy key | `~/.ssh/github_deploy_tpi` + GitHub repo Deploy keys |
| Previous (pm2-era) MySQL backup | `~/backup-pre-docker-YYYY-MM-DD.sql` (sensitive — delete after verification) |

**Never commit `.env.staging` to git.** `.gitignore` already excludes
`docker/staging/.env.staging`.

## 7. Rollback (롤백)

If a deploy breaks staging:

1. Quickest — roll back to a known good commit:
   ```bash
   ssh appacademy@125.133.49.165
   cd ~/app-academy
   git reset --hard <good-sha>
   scripts/deploy-staging.sh
   ```
2. Full disaster — restore pre-Docker pm2 setup:
   ```bash
   cd ~/app-academy.pm2-backup-<timestamp>
   sudo systemctl enable --now mysql redis-server
   mysql -uroot < ~/backup-pre-docker-YYYY-MM-DD.sql
   pm2 resurrect
   ```

## 8. Troubleshooting (문제 해결)

| Symptom | Check |
|---------|-------|
| `502 Bad Gateway` from nginx | `docker ps` — is `tac-frontend` up? `docker logs tac-frontend` |
| Backend API errors | `docker logs tac-backend` — DB connection? |
| MySQL won't start | `docker logs tac-mysql` — likely `data/mysql` volume permissions |
| `frontend build` OOM | Add swap: `sudo fallocate -l 2G /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |
| Deploy key not accepted | `ssh -T git@github.com-deploy` — re-verify key registered and read-only |

## 9. Out of Scope (본 문서 범위 외)

- HTTPS (Let's Encrypt via certbot) — follow-up task
- GitHub Actions auto-deploy on push
- Blue/green or zero-downtime rolling update
- Production (`production` branch) deployment workflow
