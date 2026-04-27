#!/usr/bin/env bash
# app-academy — Export the demo (Trinity) tenant data as a portable seed.
#
# Produces a single .sql file containing INSERTs for the demo tenant
# (acd_is_demo = 1) — usable to re-seed a fresh staging DB or to ship a
# read-only demo dataset alongside the app store listing.
#
# Excludes: any row owned by NON-demo tenants, app-internal tables that
# would leak production data (audit logs, webhook ledgers).
#
# Usage:
#   STACK=staging scripts/export-demo-seed.sh                 # writes to repo
#   STACK=staging OUT=/tmp/demo.sql scripts/export-demo-seed.sh
#
# Designed to run on the host where the MySQL container lives.

set -euo pipefail

STACK="${STACK:-staging}"
case "$STACK" in
  staging)    CONTAINER="${CONTAINER:-tac-mysql}";       ;;
  production) CONTAINER="${CONTAINER:-tac-prod-mysql}";  ;;
  *) echo "STACK must be staging or production" >&2; exit 2 ;;
esac

DB_NAME="${DB_NAME:-db_tac}"
OUT="${OUT:-./sql/seeds/demo-tenant-$(date -u +%Y%m%d).sql}"
mkdir -p "$(dirname "$OUT")"

# Tables that carry tenant data via acd_id and are safe to export.
TENANT_TABLES=(
  tac_academies
  tac_users
  tac_programs
  tac_classes
  tac_consultations
  tac_enrollments
  tac_pay_refund_policies
  tac_pay_refund_policy_tiers
)

# Tables to NEVER export (sensitive / per-deploy state).
# Kept here for documentation; they are simply not in TENANT_TABLES.
#   tac_subscription_events  (webhook ledger — environment-specific)
#   tac_audit_log            (PII)
#   tac_pay_payment_orders   (real PG data)
#   tac_pay_ledger / tac_pay_receipts / tac_tax_invoices

echo "[export-demo-seed] $STACK · container=$CONTAINER · out=$OUT"

# Resolve the demo tenant's acd_id once.
demo_id=$(docker exec "$CONTAINER" sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -N -B -e "
    SELECT acd_id FROM '"$DB_NAME"'.tac_academies
     WHERE acd_is_demo = 1 LIMIT 1;"')

if [[ -z "$demo_id" ]]; then
  echo "ERROR: no demo tenant (acd_is_demo=1) found in $DB_NAME." >&2
  echo "       Run sql/091-migration-trinity-as-demo.sql first." >&2
  exit 1
fi
echo "  demo acd_id = $demo_id"

{
  echo "-- Demo tenant seed export — generated $(date -u -Iseconds)"
  echo "-- Source: $STACK / acd_id=$demo_id"
  echo "SET NAMES utf8mb4;"
  echo "SET FOREIGN_KEY_CHECKS=0;"
  echo
  for tbl in "${TENANT_TABLES[@]}"; do
    echo "-- ---- $tbl --------------------------------------------"
    # tac_academies has no acd_id self-reference; filter by primary key.
    if [[ "$tbl" == "tac_academies" ]]; then
      where="acd_id = $demo_id"
    else
      where="acd_id = $demo_id"
    fi
    docker exec "$CONTAINER" sh -c \
      'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot \
         --no-create-info --skip-add-locks --skip-comments \
         --skip-triggers --no-tablespaces \
         --where='"'"'"$where"'"'"' \
         '"$DB_NAME"' '"$tbl"
  done
  echo "SET FOREIGN_KEY_CHECKS=1;"
} > "$OUT"

size=$(stat -c '%s' "$OUT" 2>/dev/null || stat -f '%z' "$OUT")
echo "[export-demo-seed] wrote $size bytes → $OUT"
