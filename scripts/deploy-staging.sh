#!/usr/bin/env bash
# app-academy — Staging redeploy.
# Run on the staging host after a `git push origin main` from a dev machine.
#
#   cd ~/app-academy && scripts/deploy-staging.sh
#
# Responsibilities:
#   1. git pull origin main
#   2. docker compose build (backend + frontend)
#   3. docker compose up -d mysql redis (if not already up)
#   4. Apply pending SQL migrations (tracked under sql/_applied/)
#   5. docker compose up -d backend frontend
#   6. Reload host nginx (tpi.amoeba.site)
#   7. Smoke test + write .last-deploy manifest
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/app-academy}"
COMPOSE="docker compose -f $REPO_DIR/docker/staging/docker-compose.staging.yml --env-file $REPO_DIR/docker/staging/.env.staging"
BRANCH="${BRANCH:-main}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }

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
if [[ "${DEPLOY_BUILD_LOCAL:-0}" == "1" ]]; then
    say "2. Build backend + frontend images locally ($DEPLOY_SHA)"
    $COMPOSE build backend frontend
else
    say "2. Pull backend + frontend images from GHCR ($DEPLOY_SHA)"
    if [[ -n "${GHCR_PULL_TOKEN:-}" ]] && [[ -n "${GHCR_PULL_USER:-}" ]]; then
        echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin >/dev/null
    fi
    if ! $COMPOSE pull backend frontend; then
        warn "GHCR pull failed — falling back to local build"
        $COMPOSE build backend frontend
    fi
fi

# --- 3. Ensure data services are up -------------------------------------
say "3. Start mysql + redis (idempotent)"
$COMPOSE up -d mysql redis

# Wait until a real SQL query succeeds — mysqladmin ping can return healthy
# during the MySQL entrypoint's temporary startup phase before the TCP
# listener is actually ready, so ping alone is not enough.
# shellcheck disable=SC1091
set -a; source "$REPO_DIR/docker/staging/.env.staging"; set +a
say "   waiting for mysql responsive..."
mysql_ready=0
for i in $(seq 1 90); do
    if docker exec tac-mysql mysql --default-character-set=utf8mb4 \
            -uroot -p"$MYSQL_ROOT_PASSWORD" -e 'SELECT 1' > /dev/null 2>&1; then
        mysql_ready=1
        echo "   ready after ${i}x2s"
        break
    fi
    sleep 2
done
[[ "$mysql_ready" == "1" ]] || die "mysql did not become responsive in 180s."

# --- 4. Apply pending SQL migrations ------------------------------------
# Bootstrap mode: pre-mark every existing SQL file as applied (no DB exec)
# and continue with the rest of the deploy. Use after a fresh repo clone
# on a host whose DB already has the schema (the gitignored
# sql/_applied/ directory got out of sync with reality):
#   DEPLOY_SQL_BOOTSTRAP=1 scripts/deploy-staging.sh
say "4. Apply SQL migrations (idempotent via sql/_applied/)"
mkdir -p "$REPO_DIR/sql/_applied"

# Idempotent error patterns from MySQL — these mean the schema change was
# already applied successfully on a prior run and re-applying is safe to
# treat as a no-op. We mark the migration as applied and continue.
IDEMPOTENT_PATTERNS='ERROR 1050.*already exists|ERROR 1060.*Duplicate column|ERROR 1061.*Duplicate key|ERROR 1062.*Duplicate entry|ERROR 1091.*check that column/key exists'

for sql_file in $(find "$REPO_DIR/sql" -maxdepth 1 -type f -name '*.sql' | sort); do
    fname="$(basename "$sql_file")"
    marker="$REPO_DIR/sql/_applied/$fname.sha256"
    current_hash="$(sha256sum "$sql_file" | awk '{print $1}')"

    if [[ -f "$marker" ]] && [[ "$(cat "$marker")" == "$current_hash" ]]; then
        echo "   [skip]  $fname (already applied)"
        continue
    fi

    if [[ "${DEPLOY_SQL_BOOTSTRAP:-0}" == "1" ]]; then
        echo "$current_hash" > "$marker"
        echo "   [bootstrap-mark] $fname"
        continue
    fi

    printf '   [apply] %-58s ' "$fname"
    if docker exec -i tac-mysql mysql \
            --default-character-set=utf8mb4 \
            -uroot -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-db_tac}" \
            < "$sql_file" > /tmp/sql-out.log 2>&1; then
        echo "OK"
        echo "$current_hash" > "$marker"
    elif grep -E -q "$IDEMPOTENT_PATTERNS" /tmp/sql-out.log; then
        # Migration's effect already present in DB — mark and continue.
        # Surface the matched error so the operator can sanity-check.
        echo "ALREADY-APPLIED (idempotent)"
        grep -E "$IDEMPOTENT_PATTERNS" /tmp/sql-out.log | head -2 | sed 's/^/      /'
        echo "$current_hash" > "$marker"
    else
        echo "FAIL"
        grep -v 'Using a password' /tmp/sql-out.log | tail -5
        die "SQL apply failed on $fname"
    fi
done

# --- 5. Restart app containers ------------------------------------------
say "5. Restart backend + frontend + frontend-acm"
$COMPOSE up -d --no-deps backend frontend frontend-acm

# --- 6. Sync + reload nginx ---------------------------------------------
# The repo is the source of truth for both vhosts. Install whichever has
# changed; reload nginx once at the end if anything changed.
say "6. Sync + reload host nginx"
nginx_changed=0

install_vhost() {
    local src="$1" name="$2"
    local dst="/etc/nginx/sites-available/$name"
    local link="/etc/nginx/sites-enabled/$name"
    if ! sudo cmp -s "$src" "$dst"; then
        say "   $name changed — installing"
        sudo cp "$src" "$dst"
        nginx_changed=1
    fi
    [[ -L "$link" ]] || { sudo ln -sf "$dst" "$link"; nginx_changed=1; }
}

# Canonical app-academy vhost (S4 cut-over).
install_vhost "$REPO_DIR/docker/staging/nginx-app-academy.conf" \
              "app-academy-stg.amoeba.site"
# Legacy tpi vhost — now a 301 redirect to the canonical host. Kept for 6mo.
install_vhost "$REPO_DIR/docker/staging/nginx-tpi.conf" \
              "tpi.amoeba.site"
# ACM v1.0a SPA vhost — proxies to acm-frontend container on :5174.
install_vhost "$REPO_DIR/docker/staging/nginx-acm.conf" \
              "acm-stg.amoeba.site"

if [[ "$nginx_changed" == "1" ]]; then
    sudo nginx -t
    sudo systemctl reload nginx
else
    echo "   nginx vhosts unchanged — skipping reload"
fi

# --- 7. Smoke test ------------------------------------------------------
# Follow redirects so a 301 http -> https counts as healthy.
say "7. Smoke test https://app-academy-stg.amoeba.site/"
sleep 5
curl -sIL --max-time 15 https://app-academy-stg.amoeba.site/ | head -1 \
    || warn "smoke test failed — check logs + firewall (port 443)."
echo "   legacy redirect check:"
curl -sI --max-time 10 https://tpi.amoeba.site/ | head -1 \
    || warn "tpi → app-academy redirect not responding."
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
