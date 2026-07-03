#!/usr/bin/env bash
# app-academy — Production redeploy.
# Invoked manually or by .github/workflows/cd-production.yml.
#
# Pre-conditions:
#   - $REPO_DIR is a checked-out git repo on `main`
#   - docker/production/.env.production exists (NEVER commit)
#   - docker + docker compose v2 + nginx installed
#   - DNS for acm.amoeba.site → host IP
#
# Responsibilities:
#   1. git pull origin main (compose/scripts/sql/nginx changes)
#   2. Build (DEPLOY_BUILD_LOCAL=1) or Pull from GHCR
#   3. Ensure postgres-acm + redis + minio are up
#   4. Apply pending PostgreSQL ACM SQL migrations
#   5. Ensure ACM upload dir is writable by container uid 100
#   6. docker compose up backend + frontend-acm
#   7. Sync + reload host nginx (acm.amoeba.site vhost)
#   8. Smoke test + write .last-deploy manifest
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/app-academy}"
ENV_FILE="$REPO_DIR/docker/production/.env.production"
COMPOSE_FILE="$REPO_DIR/docker/production/docker-compose.production.yml"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
BRANCH="${BRANCH:-main}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }
# sudo wrapper: reads password from SUDO_PASS env var; falls back to interactive.
sudow() { if [[ -n "${SUDO_PASS:-}" ]]; then echo "$SUDO_PASS" | sudo -S "$@" 2>/dev/null; else sudo "$@"; fi; }

[[ -d "$REPO_DIR/.git" ]] || die "$REPO_DIR is not a git repo."
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE."

cd "$REPO_DIR"
# DEPLOY_SHA from CD workflow trigger; otherwise local HEAD.
DEPLOY_SHA="${DEPLOY_SHA:-$(git rev-parse --short HEAD)}"
export DEPLOY_SHA

# --- 1. Fetch latest code ----------------------------------------------
say "1. git pull origin $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# --- 2. Pull or build images -------------------------------------------
if [[ "${DEPLOY_BUILD_LOCAL:-0}" == "1" ]]; then
    say "2. Build backend + frontend-acm locally ($DEPLOY_SHA)"
    $COMPOSE build backend frontend-acm
else
    say "2. Pull backend + frontend-acm from GHCR ($DEPLOY_SHA)"
    if [[ -n "${GHCR_PULL_TOKEN:-}" ]] && [[ -n "${GHCR_PULL_USER:-}" ]]; then
        echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin >/dev/null
    fi
    if ! $COMPOSE pull backend frontend-acm; then
        warn "GHCR pull failed — falling back to local build"
        $COMPOSE build backend frontend-acm
    fi
fi

# --- 3. Ensure data services are up ------------------------------------
say "3. Start redis + postgres-acm + minio (idempotent)"
$COMPOSE up -d redis postgres-acm minio minio-init

# shellcheck disable=SC1091
set -a; source "$ENV_FILE"; set +a

# --- 4. Apply ACM Postgres migrations ----------------------------------
say "4. Apply ACM Postgres migrations (sql/acm/)"
acm_pg_ready=0
for i in $(seq 1 30); do
    if docker exec tac-prod-postgres-acm pg_isready -U "${ACM_PG_USER:-acm}" -d "${ACM_PG_DATABASE:-db_acm}" > /dev/null 2>&1; then
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
    if docker exec -i -e PGPASSWORD="$ACM_PG_PASSWORD" tac-prod-postgres-acm \
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

# --- 5. Ensure ACM upload dir is writable by container uid 100 ----------
say "5. Ensure ACM upload dir (${DATA_DIR:-./data}/acm-uploads) is writable"
ACM_UPLOAD_HOST_DIR="${DATA_DIR:-$REPO_DIR/data}/acm-uploads"
sudow mkdir -p "$ACM_UPLOAD_HOST_DIR"
sudow chown -R 100:101 "$ACM_UPLOAD_HOST_DIR"
sudow chmod 770 "$ACM_UPLOAD_HOST_DIR"

# --- 6. Restart app containers -----------------------------------------
say "6. Restart backend + frontend-acm"
$COMPOSE up -d --no-deps backend frontend-acm

# --- 7. Sync + reload nginx ---------------------------------------------
say "7. Sync + reload host nginx (acm.amoeba.site vhost)"
NGINX_SRC="$REPO_DIR/docker/production/nginx-acm.conf"
NGINX_DST="/etc/nginx/sites-available/acm.amoeba.site"
NGINX_LINK="/etc/nginx/sites-enabled/acm.amoeba.site"

nginx_changed=0
if ! sudow cmp -s "$NGINX_SRC" "$NGINX_DST"; then
    say "   acm.amoeba.site vhost changed — installing"
    sudow cp "$NGINX_SRC" "$NGINX_DST"
    nginx_changed=1
fi
[[ -L "$NGINX_LINK" ]] || { sudow ln -sf "$NGINX_DST" "$NGINX_LINK"; nginx_changed=1; }

if [[ "$nginx_changed" == "1" ]]; then
    sudow nginx -t
    sudow systemctl reload nginx
else
    echo "   vhost unchanged — skipping reload"
fi

# --- 8. Smoke test + manifest ------------------------------------------
say "8. Smoke test"
sleep 5
echo "   --- https://acm.amoeba.site/ (TLS may not yet be issued) ---"
curl -sIL --max-time 15 https://acm.amoeba.site/ 2>&1 | head -1 \
    || warn "HTTPS smoke failed — check SSL cert (Phase 5)."
echo "   --- http://acm.amoeba.site/ ---"
curl -sI --max-time 10 http://acm.amoeba.site/ | head -1 \
    || warn "HTTP smoke failed — check nginx + container."
echo "   --- http://127.0.0.1:4000/api/health (backend direct) ---"
curl -sS --max-time 5 http://127.0.0.1:4000/api/health || warn "backend not healthy."

cat > "$REPO_DIR/.last-deploy" <<EOF
deployed_at=$(date -Iseconds)
deployed_sha=$DEPLOY_SHA
deployed_by=${USER}
branch=$BRANCH
stack=production
EOF
cat "$REPO_DIR/.last-deploy"

say "✅ Production deployment complete."
