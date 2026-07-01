#!/usr/bin/env bash
# REQ-260622 T5-01 — MySQL → PostgreSQL production cutover wrapper.
#
# Runs as `appacademy@<host>` inside the app-academy repo checkout.
# All destructive actions are gated by explicit operator confirmation.
#
#   scripts/cutover-mysql-to-pg.sh {staging|production} \
#       [--skip-backup]        # only for repeat-rehearsal (dry-run mode)
#       [--dry-run]            # pass --dry-run to the migrator (no PG writes)
#       [--verify-only]        # skip maintenance page + backup; only run row-diff
#       [--no-maintenance]     # skip nginx swap (for the verify-only mode)
#
# Flow (default):
#   1. Assertions       — target env exists, images ready, DB containers healthy
#   2. Maintenance ON   — nginx symlink swap → 503 page live
#   3. Backup           — mysqldump + pg_dump → /var/backups/app-academy/.../pre-cutover-<ts>.sql.gz
#   4. Migrate          — for domain in [tenant-bootstrap, pay, map, notification,
#                                        audit, posts, csl-aux, subscription]:
#                            npx ts-node scripts/migrate-mysql-to-pg/src/index.ts --domain $domain
#   5. Verify           — same command + --verify-only for each domain; abort on any diff ≠ 0
#   6. Image swap       — DEPLOY_SHA=<pg-only-image> docker compose up -d backend
#   7. Smoke            — curl /api/health, /api/acm/csl/inquiries (auth cookie), etc.
#   8. Maintenance OFF  — restore original nginx symlink
#   9. Post-check       — 30-min monitor prompt
#
# Rollback: any non-zero exit before step 6 leaves maintenance ON but keeps
# MySQL intact — operator can re-link the original vhost, restart the OLD
# backend image, and investigate. Rollback after step 6 requires DB restore
# (see RUNBOOK-260622-cutover.md §7).

set -euo pipefail

ENV="${1:-}"
shift || true

SKIP_BACKUP=0
DRY_RUN=0
VERIFY_ONLY=0
NO_MAINT=0

for arg in "$@"; do
  case "$arg" in
    --skip-backup)     SKIP_BACKUP=1 ;;
    --dry-run)         DRY_RUN=1 ;;
    --verify-only)     VERIFY_ONLY=1; NO_MAINT=1; SKIP_BACKUP=1 ;;
    --no-maintenance)  NO_MAINT=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

case "$ENV" in
  staging)
    REPO=~/app-academy
    COMPOSE_FILE=docker/staging/docker-compose.staging.yml
    ENV_FILE=docker/staging/.env.staging
    NGINX_LIVE=/etc/nginx/sites-enabled/acm-stg.amoeba.site
    NGINX_APP=/etc/nginx/sites-available/acm-stg.amoeba.site
    NGINX_MAINT=/etc/nginx/sites-available/acm-maintenance.conf
    BACKUP_DIR=/var/backups/app-academy/staging
    MYSQL_CONTAINER=tac-mysql
    PG_CONTAINER=tac-postgres-acm
    ;;
  production)
    REPO=~/app-academy
    COMPOSE_FILE=docker/production/docker-compose.production.yml
    ENV_FILE=docker/production/.env.production
    NGINX_LIVE=/etc/nginx/sites-enabled/acm.amoeba.site
    NGINX_APP=/etc/nginx/sites-available/acm.amoeba.site
    NGINX_MAINT=/etc/nginx/sites-available/acm-maintenance.conf
    BACKUP_DIR=/var/backups/app-academy/production
    MYSQL_CONTAINER=tac-prod-mysql
    PG_CONTAINER=tac-prod-postgres-acm
    ;;
  *)
    echo "Usage: $0 {staging|production} [--dry-run|--verify-only|--skip-backup|--no-maintenance]" >&2
    exit 1
    ;;
esac

COMPOSE="docker compose -f $REPO/$COMPOSE_FILE --env-file $REPO/$ENV_FILE"
DOMAINS=(tenant-bootstrap pay map notification audit posts csl-aux subscription)
TS=$(date -u +%Y%m%dT%H%M%SZ)

# ANSI colour helpers — bright cyan for headings, red for aborts.
say()  { printf '\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!! %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31mXX %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  read -r -p "$1 [y/N] " ans
  [[ "${ans:-N}" =~ ^[yY]$ ]] || die "aborted by operator"
}

cd "$REPO"

# --- 1. Assertions -----------------------------------------------------
say "1. Pre-flight"

[[ -f "$COMPOSE_FILE" ]] || die "missing $COMPOSE_FILE"
[[ -f "$ENV_FILE"     ]] || die "missing $ENV_FILE (secrets not staged)"

if [[ "$VERIFY_ONLY" == "0" ]]; then
  # DBs must be running for backup + migration.
  docker ps --format '{{.Names}}' | grep -q "^${MYSQL_CONTAINER}$" \
    || die "$MYSQL_CONTAINER not running — start the stack first"
  docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$" \
    || die "$PG_CONTAINER not running — start the stack first"
fi

if [[ "$NO_MAINT" == "0" ]]; then
  [[ -f "$NGINX_MAINT" ]] \
    || die "maintenance vhost not installed at $NGINX_MAINT — copy docker/maintenance/nginx-acm-maintenance.conf and /var/www/maintenance/maintenance.html first"
fi

echo "  env=$ENV  ts=$TS  dry-run=$DRY_RUN  verify-only=$VERIFY_ONLY  skip-backup=$SKIP_BACKUP"
confirm "Proceed with cutover?"

# --- 2. Maintenance ON -------------------------------------------------
if [[ "$NO_MAINT" == "0" ]]; then
  say "2. Maintenance ON (nginx swap)"
  sudo ln -sf "$NGINX_MAINT" "$NGINX_LIVE"
  sudo nginx -t && sudo systemctl reload nginx
  echo "  maintenance page live at https://<host>/"
  sleep 3  # let in-flight requests drain
fi

# --- 3. Backups --------------------------------------------------------
if [[ "$SKIP_BACKUP" == "0" ]]; then
  say "3. Pre-cutover backups → $BACKUP_DIR/"
  sudo mkdir -p "$BACKUP_DIR"

  local_out_mysql="$BACKUP_DIR/pre-cutover-mysql-$TS.sql.gz"
  docker exec "$MYSQL_CONTAINER" bash -lc \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump --single-transaction --routines --triggers -uroot db_tac' \
    | gzip > "$local_out_mysql"
  echo "  mysql → $local_out_mysql ($(stat -c%s "$local_out_mysql" 2>/dev/null || echo ?) bytes)"

  local_out_pg="$BACKUP_DIR/pre-cutover-pg-$TS.sql.gz"
  docker exec "$PG_CONTAINER" bash -lc \
    'PGPASSWORD="$ACM_PG_PASSWORD" pg_dump -U "$ACM_PG_USER" "$ACM_PG_DATABASE"' \
    | gzip > "$local_out_pg"
  echo "  pg    → $local_out_pg ($(stat -c%s "$local_out_pg" 2>/dev/null || echo ?) bytes)"
else
  warn "backup skipped (--skip-backup or --verify-only)"
fi

# --- 4. Migrate --------------------------------------------------------
DRY_FLAG=""
if [[ "$DRY_RUN" == "1" ]]; then DRY_FLAG="--dry-run"; fi

if [[ "$VERIFY_ONLY" == "0" ]]; then
  say "4. Migrate domains (order: ${DOMAINS[*]})"
  for d in "${DOMAINS[@]}"; do
    echo "  → $d"
    ( cd "$REPO/backend" && \
      npx ts-node "$REPO/scripts/migrate-mysql-to-pg/src/index.ts" \
        --domain "$d" $DRY_FLAG \
    ) || die "migrate failed at domain=$d"
  done
fi

# --- 5. Verify ---------------------------------------------------------
say "5. Verify (row diff, per domain)"
for d in "${DOMAINS[@]}"; do
  echo "  → $d --verify-only"
  ( cd "$REPO/backend" && \
    npx ts-node "$REPO/scripts/migrate-mysql-to-pg/src/index.ts" \
      --domain "$d" --verify-only \
  ) || die "verify failed at domain=$d"
done

if [[ "$VERIFY_ONLY" == "1" ]]; then
  say "verify-only mode complete"
  exit 0
fi

# --- 6. Image swap -----------------------------------------------------
say "6. Backend image swap (PG-only image)"
DEPLOY_SHA="${DEPLOY_SHA:-}"
if [[ -z "$DEPLOY_SHA" ]]; then
  DEPLOY_SHA=$(git -C "$REPO" rev-parse --short HEAD)
fi
export DEPLOY_SHA
$COMPOSE pull backend || warn "GHCR pull failed — will rebuild locally"
$COMPOSE up -d backend

# --- 7. Smoke ----------------------------------------------------------
say "7. Smoke"
sleep 15
for i in $(seq 1 6); do
  code=$(curl -sIL -o /dev/null -w '%{http_code}' --max-time 15 https://acm.amoeba.site/api/health || echo 000)
  echo "  attempt $i → $code"
  [[ "$code" == "200" ]] && break
  [[ "$i" == "6" ]] && die "smoke failed — MAINTENANCE STAYS ON, investigate before restoring"
  sleep 5
done

# --- 8. Maintenance OFF ------------------------------------------------
if [[ "$NO_MAINT" == "0" ]]; then
  say "8. Maintenance OFF (restore normal vhost)"
  sudo ln -sf "$NGINX_APP" "$NGINX_LIVE"
  sudo nginx -t && sudo systemctl reload nginx
  echo "  live app restored"
fi

# --- 9. Post-check reminder --------------------------------------------
say "9. Post-cutover"
cat <<POST
  ✅ Cutover complete for $ENV @ $TS

  Manual monitoring for the next 30 minutes:
    docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs backend --tail 200 -f
    curl -s https://acm.amoeba.site/api/health
    (login → dashboard → CSL list → CAL month → attachment)

  MySQL container is STILL running per Q-4 (즉시 삭제) — remove in the SAME
  maintenance window when 30-min monitoring passes:
    docker rm -f $MYSQL_CONTAINER
    docker volume rm ${ENV}_mysql   # verify name via 'docker volume ls'

  Backups retained at:
    $BACKUP_DIR/pre-cutover-mysql-$TS.sql.gz
    $BACKUP_DIR/pre-cutover-pg-$TS.sql.gz
POST
