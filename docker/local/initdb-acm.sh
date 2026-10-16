#!/usr/bin/env bash
# REQ-261017 — 로컬 docker 최초 기동(빈 볼륨) 시 sql/acm 을 배포와 같은 순서로 적용한다.
# postgres 이미지가 /docker-entrypoint-initdb.d/*.sh 를 한 번 실행한다.
set -euo pipefail
for f in $(bash /acm-scripts/acm-migration-order.sh /acm-sql); do
  echo "[initdb-acm] $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < "$f"
done
