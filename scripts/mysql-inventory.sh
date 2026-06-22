#!/usr/bin/env bash
#
# Phase 0 T0-01 — MySQL `db_tac` row count + 마지막 쓰기 시점 인벤토리.
#
# 사용:
#   ssh appacademy@acm.amoeba.site
#   cd ~/app-academy
#   bash scripts/mysql-inventory.sh production > /tmp/mysql-inventory-$(date +%F).txt
#
# read-only. SELECT 만 수행 — destructive 작업 없음.
set -Eeuo pipefail

ENV=${1:?usage: mysql-inventory.sh <staging|production>}
case "$ENV" in
    staging)    CONTAINER=tac-mysql ;;
    production) CONTAINER=tac-prod-mysql ;;
    *) echo "ENV must be staging|production"; exit 1 ;;
esac

# Get the root password from the env file co-located with the compose file.
ENV_FILE=$HOME/app-academy/docker/$ENV/.env.$ENV
[[ -f "$ENV_FILE" ]] || { echo "env file not found: $ENV_FILE"; exit 1; }
ROOT_PW=$(grep '^MYSQL_ROOT_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

run_sql() {
    docker exec -i "$CONTAINER" mysql -uroot -p"$ROOT_PW" -N -s db_tac <<<"$1"
}

echo "=============================================================="
echo "  Phase 0 — MySQL Inventory ($ENV)"
echo "  Run at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "  Container: $CONTAINER"
echo "=============================================================="
echo ""

echo "## 1. Per-table row count + max(created_at) when available"
echo ""
printf "%-40s | %-15s | %-25s\n" "table_name" "row_count" "max_created_at"
echo "----------------------------------------------------------------------------------------"

TABLES=$(run_sql "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='db_tac' ORDER BY TABLE_NAME")

for tbl in $TABLES; do
    cnt=$(run_sql "SELECT COUNT(*) FROM $tbl" 2>/dev/null || echo "?")
    # Find a *_created_at column to summarize last write
    created_col=$(run_sql "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='db_tac' AND TABLE_NAME='$tbl' AND COLUMN_NAME LIKE '%_created_at' LIMIT 1")
    if [[ -n "$created_col" ]]; then
        max_at=$(run_sql "SELECT MAX($created_col) FROM $tbl" 2>/dev/null || echo "-")
    else
        max_at="(no _created_at)"
    fi
    printf "%-40s | %-15s | %-25s\n" "$tbl" "$cnt" "$max_at"
done

echo ""
echo "## 2. Database storage size"
echo ""
run_sql "
SELECT
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS size_mb,
    ROUND((DATA_LENGTH / 1024 / 1024), 2) AS data_mb,
    ROUND((INDEX_LENGTH / 1024 / 1024), 2) AS index_mb,
    TABLE_ROWS AS approx_rows
FROM information_schema.TABLES
WHERE TABLE_SCHEMA='db_tac'
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
LIMIT 15;
"

echo ""
echo "## 3. Audit log distribution (Q-2 N 결정용)"
echo ""
run_sql "
SELECT
    DATE_FORMAT(aud_created_at, '%Y-%m') AS month,
    COUNT(*) AS rows_in_month
FROM tac_audit_logs
WHERE aud_created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
GROUP BY DATE_FORMAT(aud_created_at, '%Y-%m')
ORDER BY month DESC;
" 2>/dev/null || echo "(tac_audit_logs query failed — table empty or schema mismatch)"

echo ""
echo "## 4. Payment data distribution (Q-1 — 전체 이전 검증)"
echo ""
run_sql "
SELECT
    pod_status,
    COUNT(*) AS orders,
    ROUND(SUM(pod_amount), 0) AS total_amount_krw,
    MIN(pod_created_at) AS earliest,
    MAX(pod_created_at) AS latest
FROM tac_pay_orders
GROUP BY pod_status
ORDER BY orders DESC;
" 2>/dev/null || echo "(tac_pay_orders query failed)"

echo ""
echo "## 5. ACM 이중화 권위 분석 (Q-6)"
echo ""
echo "### tac_users vs amb_acm_user"
TAC_USR=$(run_sql "SELECT COUNT(*) FROM tac_users")
echo "MySQL tac_users: $TAC_USR rows"
echo "(PG amb_acm_user count: check separately via psql — see Phase 0 doc)"

echo ""
echo "=============================================================="
echo "  Inventory complete — save this output to RPT-260622-mysql-inventory.md"
echo "=============================================================="
