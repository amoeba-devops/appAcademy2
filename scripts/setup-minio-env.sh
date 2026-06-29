#!/usr/bin/env bash
# REQ-260626 T-06 / ADR-008 — bootstrap MinIO root credentials on a remote
# host's .env file and bring up the new compose services. Run locally with
# your SSH key loaded:
#
#   scripts/setup-minio-env.sh staging      # → appacademy@acm-stg
#   scripts/setup-minio-env.sh production   # → appacademy@acm
#
# Idempotent: skips if ACM_S3_ROOT_USER is already present.
# Credentials are generated server-side, so they never appear in this
# script's stdout (or any local logs).
#
# Guide: docs/deployment/SETUP-260629-minio-attachment-store.md

set -euo pipefail

ENVIRONMENT="${1:-}"
case "$ENVIRONMENT" in
  staging)
    HOST="acm-stg.amoeba.site"
    USER="appacademy"
    COMPOSE_DIR="~/app-academy/docker/staging"
    ENV_FILE=".env.staging"
    COMPOSE_FILE="docker-compose.staging.yml"
    ;;
  production)
    HOST="acm.amoeba.site"
    USER="appacademy"
    COMPOSE_DIR="~/app-academy/docker/production"
    ENV_FILE=".env.production"
    COMPOSE_FILE="docker-compose.production.yml"
    ;;
  *)
    echo "Usage: $0 {staging|production}" >&2
    exit 1
    ;;
esac

echo "→ Target: $USER@$HOST  ($ENV_FILE)"
read -r -p "Proceed? [y/N] " confirm
[[ "${confirm:-N}" =~ ^[yY]$ ]] || { echo "Aborted."; exit 0; }

# All real work happens server-side inside a single heredoc — credentials
# never leave the remote host.
ssh "$USER@$HOST" bash -s <<EOF
set -euo pipefail
cd $COMPOSE_DIR

if grep -q '^ACM_S3_ROOT_USER=' $ENV_FILE; then
  echo "[skip] ACM_S3_ROOT_USER already present in $ENV_FILE — bringing up services only."
else
  echo "[gen]  Appending ACM_S3_ROOT_USER + ACM_S3_ROOT_PASSWORD to $ENV_FILE"
  {
    echo ""
    echo "# REQ-260626 T-06 / ADR-008 — MinIO root credentials (generated \$(date -Iseconds))"
    echo "ACM_S3_ROOT_USER=\$(openssl rand -hex 16)"
    echo "ACM_S3_ROOT_PASSWORD=\$(openssl rand -hex 32)"
  } >> $ENV_FILE
  chmod 600 $ENV_FILE
fi

echo "[boot] docker compose up -d minio minio-init backend"
docker compose -f $COMPOSE_FILE up -d minio minio-init backend

sleep 5
echo ""
echo "── minio service ─────────────────────────────────"
docker compose -f $COMPOSE_FILE ps minio
echo ""
echo "── minio-init log (bucket creation) ──────────────"
docker compose -f $COMPOSE_FILE logs minio-init --tail 10 || true
echo ""
echo "── backend ObjectStoreClient log ─────────────────"
docker compose -f $COMPOSE_FILE logs backend --tail 50 | grep ObjectStoreClient || \
  echo "[warn] ObjectStoreClient log not found yet — re-run 'logs backend --tail 100' in ~30s."
EOF
