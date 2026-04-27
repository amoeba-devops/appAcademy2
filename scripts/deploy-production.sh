#!/usr/bin/env bash
# app-academy — Production redeploy.
# Invoked by .github/workflows/cd-production.yml after manual approval.
# Deploys the EXACT image SHA already validated in staging — never builds.
#
# Pre-conditions:
#   - $REPO_DIR is a checked-out git repo on `main`
#   - docker/production/.env.production exists (NEVER commit)
#   - $DEPLOY_SHA is set to the short SHA to deploy
#
# Responsibilities:
#   1. git pull origin main (for compose/scripts/sql/nginx changes only)
#   2. Pre-deploy DB backup (mandatory; abort if it fails)
#   3. Pull pre-built backend + frontend images from GHCR
#   4. Ensure mysql + redis are up
#   5. Apply pending SQL migrations (idempotent via sql/_applied/)
#   6. docker compose up -d backend frontend
#   7. Sync + reload host nginx (production vhost)
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

[[ -d "$REPO_DIR/.git" ]] || die "$REPO_DIR is not a git repo."
[[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE."
[[ -n "${DEPLOY_SHA:-}" ]] || die "DEPLOY_SHA is required (set by CD-Production workflow)."

cd "$REPO_DIR"
export DEPLOY_SHA

# --- 1. Fetch latest infra code -----------------------------------------
say "1. git pull origin $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# --- 2. Pre-deploy DB backup (mandatory) --------------------------------
say "2. Pre-deploy DB backup"
STACK=production scripts/backup-db.sh \
  || die "Backup failed — aborting deploy. NO changes were applied."

# --- 3. Pull pre-built images ($DEPLOY_SHA) ----------------------------
say "3. Pull backend + frontend images from GHCR ($DEPLOY_SHA)"
if [[ -n "${GHCR_PULL_TOKEN:-}" ]] && [[ -n "${GHCR_PULL_USER:-}" ]]; then
    echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin >/dev/null
fi
$COMPOSE pull backend frontend \
  || die "GHCR pull failed for SHA $DEPLOY_SHA. Was it built by CD-Staging?"

# --- 4. Ensure data services are up -------------------------------------
say "4. Start mysql + redis (idempotent)"
$COMPOSE up -d mysql redis

# shellcheck disable=SC1091
set -a; source "$ENV_FILE"; set +a
say "   waiting for mysql responsive..."
mysql_ready=0
for i in $(seq 1 90); do
    if docker exec tac-prod-mysql mysql --default-character-set=utf8mb4 \
            -uroot -p"$MYSQL_ROOT_PASSWORD" -e 'SELECT 1' > /dev/null 2>&1; then
        mysql_ready=1
        echo "   ready after ${i}x2s"
        break
    fi
    sleep 2
done
[[ "$mysql_ready" == "1" ]] || die "mysql did not become responsive in 180s."

# --- 5. Apply pending SQL migrations ------------------------------------
say "5. Apply SQL migrations (idempotent via sql/_applied/)"
mkdir -p "$REPO_DIR/sql/_applied"

for sql_file in $(find "$REPO_DIR/sql" -maxdepth 1 -type f -name '*.sql' | sort); do
    fname="$(basename "$sql_file")"
    marker="$REPO_DIR/sql/_applied/$fname.sha256"
    current_hash="$(sha256sum "$sql_file" | awk '{print $1}')"

    if [[ -f "$marker" ]] && [[ "$(cat "$marker")" == "$current_hash" ]]; then
        echo "   [skip]  $fname (already applied)"
        continue
    fi

    printf '   [apply] %-58s ' "$fname"
    if docker exec -i tac-prod-mysql mysql \
            --default-character-set=utf8mb4 \
            -uroot -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-db_tac}" \
            < "$sql_file" > /tmp/sql-out.log 2>&1; then
        echo "OK"
        echo "$current_hash" > "$marker"
    else
        echo "FAIL"
        grep -v 'Using a password' /tmp/sql-out.log | tail -5
        die "SQL apply failed on $fname — backup is at /var/backups/app-academy/production/"
    fi
done

# --- 6. Restart app containers ------------------------------------------
say "6. Restart backend + frontend"
$COMPOSE up -d --no-deps backend frontend

# --- 7. Sync + reload nginx ---------------------------------------------
say "7. Sync + reload host nginx (production vhost)"
NGINX_SRC="$REPO_DIR/docker/production/nginx-app-academy.conf"
NGINX_DST="/etc/nginx/sites-available/app-academy.amoeba.site"
NGINX_LINK="/etc/nginx/sites-enabled/app-academy.amoeba.site"

if ! sudo cmp -s "$NGINX_SRC" "$NGINX_DST"; then
    say "   production vhost changed — installing"
    sudo cp "$NGINX_SRC" "$NGINX_DST"
    [[ -L "$NGINX_LINK" ]] || sudo ln -sf "$NGINX_DST" "$NGINX_LINK"
    sudo nginx -t
    sudo systemctl reload nginx
else
    echo "   production vhost unchanged — skipping reload"
fi

# --- 8. Smoke test + manifest -------------------------------------------
say "8. Smoke test https://app-academy.amoeba.site/"
sleep 5
curl -sIL --max-time 15 https://app-academy.amoeba.site/ | head -1 \
    || warn "smoke test failed — investigate immediately."

cat > "$REPO_DIR/.last-deploy" <<EOF
deployed_at=$(date -Iseconds)
deployed_sha=$DEPLOY_SHA
deployed_by=${USER}
branch=$BRANCH
stack=production
EOF
cat "$REPO_DIR/.last-deploy"

say "✅ Production deployment complete."
