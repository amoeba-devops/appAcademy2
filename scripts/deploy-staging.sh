#!/usr/bin/env bash
# app-academy — Staging redeploy.
# Run on the staging host after a `git push origin main` from a dev machine.
#
#   cd ~/app-academy && scripts/deploy-staging.sh
#
# Responsibilities:
#   1. git pull origin main
#   2. docker compose build (backend + frontend)
#   3. docker compose up -d postgres-acm redis minio (if not already up)
#   4. Apply pending PostgreSQL ACM SQL migrations
#   5. docker compose up -d backend frontend
#   6. Reload host nginx (app-academy-stg + acm-stg vhosts)
#   7. Smoke test + write .last-deploy manifest
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/app-academy}"
COMPOSE="docker compose -f $REPO_DIR/docker/staging/docker-compose.staging.yml --env-file $REPO_DIR/docker/staging/.env.staging"
BRANCH="${BRANCH:-main}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }
# sudo wrapper: reads password from SUDO_PASS env var (set in .env.staging or exported before call)
# Falls back to interactive sudo if SUDO_PASS is unset/empty.
sudow() { if [[ -n "${SUDO_PASS:-}" ]]; then echo "$SUDO_PASS" | sudo -S "$@" 2>/dev/null; else sudo "$@"; fi; }

[[ -d "$REPO_DIR/.git" ]] || die "$REPO_DIR is not a git repo. Run scripts/staging-setup.sh first."
[[ -f "$REPO_DIR/docker/staging/.env.staging" ]] || die "Missing docker/staging/.env.staging."

cd "$REPO_DIR"

# --- 1. Fetch latest code -----------------------------------------------
say "1. git pull origin $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
# DEPLOY_SHA from CD workflow trigger; otherwise local HEAD.
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse --short HEAD)}"
export DEPLOY_SHA

# --- 2. Pull (or build) images -----------------------------------------
# Legacy `frontend` (Next.js) service was removed from the compose on
# 2026-06-04 — directory archived in PLN-260519 Phase 7. We now only
# manage backend + frontend-acm.
if [[ "${DEPLOY_BUILD_LOCAL:-0}" == "1" ]]; then
    say "2. Build backend + frontend-acm images locally ($DEPLOY_SHA)"
    $COMPOSE build backend frontend-acm
else
    say "2. Pull backend + frontend-acm images from GHCR ($DEPLOY_SHA)"
    if [[ -n "${GHCR_PULL_TOKEN:-}" ]] && [[ -n "${GHCR_PULL_USER:-}" ]]; then
        echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin >/dev/null
    fi
    if ! $COMPOSE pull backend frontend-acm; then
        warn "GHCR pull failed — falling back to local build"
        $COMPOSE build backend frontend-acm
    fi
fi

# --- 3. Ensure data services are up -------------------------------------
say "3. Start redis + postgres-acm + minio (idempotent)"
$COMPOSE up -d redis postgres-acm minio minio-init

# shellcheck disable=SC1091
set -a; source "$REPO_DIR/docker/staging/.env.staging"; set +a

# --- 4. Apply ACM Postgres migrations -----------------------------------
# Bootstrap mode: pre-mark every existing SQL file as applied (no DB exec)
# and continue with the rest of the deploy. Use after a fresh repo clone
# on a host whose DB already has the schema (the gitignored
# sql/_applied/ directory got out of sync with reality):
#   DEPLOY_SQL_BOOTSTRAP=1 scripts/deploy-staging.sh
say "4. Apply ACM Postgres migrations (sql/acm/)"
acm_pg_ready=0
for i in $(seq 1 30); do
    if docker exec tac-postgres-acm pg_isready -U "${ACM_PG_USER:-acm}" -d "${ACM_PG_DATABASE:-db_acm}" > /dev/null 2>&1; then
        acm_pg_ready=1
        break
    fi
    sleep 2
done
[[ "$acm_pg_ready" == "1" ]] || die "postgres-acm did not become responsive in 60s."

mkdir -p "$REPO_DIR/sql/_applied/acm"
for sql_file in $(find "$REPO_DIR/sql/acm" -maxdepth 1 -type f -name '*.sql' | sort); do
    fname="$(basename "$sql_file")"
    marker="$REPO_DIR/sql/_applied/acm/$fname.sha256"
    current_hash="$(sha256sum "$sql_file" | awk '{print $1}')"

    if [[ -f "$marker" ]] && [[ "$(cat "$marker")" == "$current_hash" ]]; then
        echo "   [skip]  acm/$fname (already applied)"
        continue
    fi

    if [[ "${DEPLOY_SQL_BOOTSTRAP:-0}" == "1" ]]; then
        echo "$current_hash" > "$marker"
        echo "   [bootstrap-mark] acm/$fname"
        continue
    fi

    printf '   [apply] acm/%-54s ' "$fname"
    if docker exec -i -e PGPASSWORD="$ACM_PG_PASSWORD" tac-postgres-acm \
            psql -U "${ACM_PG_USER:-acm}" -d "${ACM_PG_DATABASE:-db_acm}" \
            -v ON_ERROR_STOP=1 -q < "$sql_file" > /tmp/acm-sql-out.log 2>&1; then
        echo "OK"
        echo "$current_hash" > "$marker"
    else
        echo "FAIL"
        tail -10 /tmp/acm-sql-out.log
        die "ACM SQL apply failed on $fname"
    fi
done
# --- 4c. Ensure ACM upload dir exists with backend container ownership ---
# Container runs as uid 100/gid 101 (alpine `app` user). The bind-mount
# host dir must be writable by that uid or POST /attachments returns 500.
say "4c. Ensure ACM upload dir (${DATA_DIR:-./data}/acm-uploads) is writable by container uid 100"
ACM_UPLOAD_HOST_DIR="${DATA_DIR:-$REPO_DIR/data}/acm-uploads"
sudow mkdir -p "$ACM_UPLOAD_HOST_DIR"
sudow chown -R 100:101 "$ACM_UPLOAD_HOST_DIR"
sudow chmod 770 "$ACM_UPLOAD_HOST_DIR"

say "5. Restart backend + frontend-acm"
$COMPOSE up -d --no-deps backend frontend-acm

# --- 6. Sync + reload nginx ---------------------------------------------
# The repo is the source of truth for both vhosts. Install whichever has
# changed; reload nginx once at the end if anything changed.
say "6. Sync + reload host nginx"
nginx_changed=0

install_vhost() {
    local src="$1" name="$2"
    local dst="/etc/nginx/sites-available/$name"
    local link="/etc/nginx/sites-enabled/$name"
    if ! sudow cmp -s "$src" "$dst"; then
        say "   $name changed — installing"
        sudow cp "$src" "$dst"
        nginx_changed=1
    fi
    [[ -L "$link" ]] || { sudow ln -sf "$dst" "$link"; nginx_changed=1; }
}

# Canonical app-academy vhost (S4 cut-over).
install_vhost "$REPO_DIR/docker/staging/nginx-app-academy.conf" \
              "app-academy-stg.amoeba.site"
# ACM v1.0a SPA vhost — proxies to acm-frontend container on :5174.
install_vhost "$REPO_DIR/docker/staging/nginx-acm.conf" \
              "acm-stg.amoeba.site"
# Note: tpi.amoeba.site vhost removed 2026-06-08 (op request) — the
# tpi.co.kr marketing mirror moved off the staging host. The config file
# (docker/staging/nginx-tpi.conf) was deleted from the repo.

if [[ "$nginx_changed" == "1" ]]; then
    sudow nginx -t
    sudow systemctl reload nginx
else
    echo "   nginx vhosts unchanged — skipping reload"
fi

# --- 7. Smoke test ------------------------------------------------------
# Follow redirects so a 301 http -> https counts as healthy.
say "7. Smoke test https://app-academy-stg.amoeba.site/"
sleep 5
curl -sIL --max-time 15 https://app-academy-stg.amoeba.site/ | head -1 \
    || warn "smoke test failed — check logs + firewall (port 443)."
echo "   acm-stg check (DNS may not yet exist on first cut-over):"
curl -sIL --max-time 10 https://acm-stg.amoeba.site/ | head -1 \
    || warn "acm-stg.amoeba.site not responding — verify DNS A record + nginx."

# --- 8. Manifest --------------------------------------------------------
cat > "$REPO_DIR/.last-deploy" <<EOF
deployed_at=$(date -Iseconds)
deployed_sha=$DEPLOY_SHA
deployed_by=${USER}
branch=$BRANCH
EOF
cat "$REPO_DIR/.last-deploy"

say "✅ Deployment complete."
