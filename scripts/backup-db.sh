#!/usr/bin/env bash
# app-academy — DB backup script
# Dumps the MySQL container's db_tac to a timestamped .sql.gz and prunes
# files older than RETENTION_DAYS. Designed to be invoked from cron on the
# host (staging or production) — uses `docker exec` so MySQL credentials
# never leave the container env.
#
# Usage (cron):
#   # Daily 02:30 KST, 7-day retention (staging) or 30-day (production)
#   30 2 * * *  /home/appacademy/app-academy/scripts/backup-db.sh \
#               >> /var/log/app-academy/backup.log 2>&1
#
# Env overrides:
#   STACK            staging | production           (default: staging)
#   CONTAINER        MySQL container name           (default: tac-mysql / tac-prod-mysql)
#   DB_NAME          Database to dump               (default: db_tac)
#   BACKUP_DIR       Where to write dumps           (default: /var/backups/app-academy/$STACK)
#   RETENTION_DAYS   Days to keep                   (default: 7 staging / 30 production)

set -euo pipefail

STACK="${STACK:-staging}"
case "$STACK" in
  staging)    DEFAULT_CONTAINER="tac-mysql";       DEFAULT_RETENTION=7  ;;
  production) DEFAULT_CONTAINER="tac-prod-mysql";  DEFAULT_RETENTION=30 ;;
  *) echo "ERROR: STACK must be 'staging' or 'production' (got: $STACK)" >&2; exit 2 ;;
esac

CONTAINER="${CONTAINER:-$DEFAULT_CONTAINER}"
DB_NAME="${DB_NAME:-db_tac}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/app-academy/$STACK}"
RETENTION_DAYS="${RETENTION_DAYS:-$DEFAULT_RETENTION}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/db_tac-$ts.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup-db] $STACK · container=$CONTAINER · db=$DB_NAME · out=$out"

# `MYSQL_PWD` is read by mysqldump from the container's own env, so the
# password never appears in `ps` on the host.
docker exec "$CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump \
     --user=root --single-transaction --quick --routines --triggers \
     --set-gtid-purged=OFF --no-tablespaces \
     "'"$DB_NAME"'"' \
  | gzip -9 > "$out"

# Atomic-ish: rename only after successful gzip exit (set -e guarantees we
# only reach this line on success).
size=$(stat -c '%s' "$out" 2>/dev/null || stat -f '%z' "$out")
echo "[backup-db] wrote $size bytes"

# Sanity check: backup must be > 1 KiB (uncompressed empty schema is larger).
if [[ "$size" -lt 1024 ]]; then
  echo "[backup-db] ERROR: dump suspiciously small ($size bytes)" >&2
  exit 1
fi

# Retention prune.
echo "[backup-db] pruning > $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'db_tac-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -print -delete

echo "[backup-db] OK"
