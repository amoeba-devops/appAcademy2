#!/usr/bin/env bash
# Trinity Academy — Staging redeploy.
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
DEPLOY_SHA="$(git rev-parse --short HEAD)"

# --- 2. Build images ----------------------------------------------------
say "2. Build backend + frontend images ($DEPLOY_SHA)"
$COMPOSE build backend frontend

# --- 3. Ensure data services are up -------------------------------------
say "3. Start mysql + redis (idempotent)"
$COMPOSE up -d mysql redis

# Wait for MySQL healthcheck to pass.
say "   waiting for mysql healthy..."
for i in $(seq 1 30); do
    status=$(docker inspect -f '{{.State.Health.Status}}' tac-mysql 2>/dev/null || echo "starting")
    [[ "$status" == "healthy" ]] && break
    sleep 2
done
[[ "$status" == "healthy" ]] || die "mysql did not become healthy in 60s."

# --- 4. Apply pending SQL migrations ------------------------------------
say "4. Apply SQL migrations (idempotent via sql/_applied/)"
mkdir -p "$REPO_DIR/sql/_applied"

# Load env for password.
# shellcheck disable=SC1091
set -a; source "$REPO_DIR/docker/staging/.env.staging"; set +a

for sql_file in $(find "$REPO_DIR/sql" -maxdepth 1 -type f -name '*.sql' | sort); do
    fname="$(basename "$sql_file")"
    marker="$REPO_DIR/sql/_applied/$fname.sha256"
    current_hash="$(sha256sum "$sql_file" | awk '{print $1}')"

    if [[ -f "$marker" ]] && [[ "$(cat "$marker")" == "$current_hash" ]]; then
        echo "   [skip]  $fname (already applied)"
        continue
    fi

    echo "   [apply] $fname"
    docker exec -i tac-mysql mysql \
        --default-character-set=utf8mb4 \
        -uroot -p"$MYSQL_ROOT_PASSWORD" "${MYSQL_DATABASE:-db_tac}" \
        < "$sql_file"
    echo "$current_hash" > "$marker"
done

# --- 5. Restart app containers ------------------------------------------
say "5. Restart backend + frontend"
$COMPOSE up -d --no-deps backend frontend

# --- 6. Reload nginx ----------------------------------------------------
say "6. Reload host nginx"
sudo nginx -t
sudo systemctl reload nginx

# --- 7. Smoke test ------------------------------------------------------
say "7. Smoke test http://tpi.amoeba.site/"
sleep 5
curl -sI http://tpi.amoeba.site/ | head -1 || warn "smoke test failed — check logs."

# --- 8. Manifest --------------------------------------------------------
cat > "$REPO_DIR/.last-deploy" <<EOF
deployed_at=$(date -Iseconds)
deployed_sha=$DEPLOY_SHA
deployed_by=${USER}
branch=$BRANCH
EOF
cat "$REPO_DIR/.last-deploy"

say "✅ Deployment complete."
