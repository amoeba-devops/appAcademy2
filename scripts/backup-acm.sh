#!/usr/bin/env bash
# ============================================================================
# REQ-261017C — ACM 일일 백업 (PostgreSQL db_acm + MinIO 첨부 + 업로드 폴더)
#
#   STACK=production scripts/backup-acm.sh      # 또는 staging
#
# 환경 변수
#   STACK            production | staging (기본 production)
#   BACKUP_DIR       저장 위치 (기본 /var/backups/app-academy/$STACK)
#   RETENTION_DAYS   보관 일수 (기본 30)
#
# - DB 는 컨테이너 안에서 pg_dump -Fc (컨테이너의 POSTGRES_USER 사용, 비밀번호 출력 없음)
# - MinIO·업로드 폴더는 root 소유라 읽기 전용 임시 컨테이너(redis:7-alpine, 이미 있는 이미지)로 tar
# - 임시 파일에 쓴 뒤 검증하고 이름을 바꾼다 — 실패한 백업이 정상 파일처럼 남지 않는다
#
# crontab 예:
#   30 2 * * * STACK=production /home/appacademy/app-academy/scripts/backup-acm.sh >> /var/log/app-academy/backup.log 2>&1
# ============================================================================
set -euo pipefail

STACK="${STACK:-production}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/docker/$STACK/.env.$STACK"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/app-academy/$STACK}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
HELPER_IMAGE="${HELPER_IMAGE:-redis:7-alpine}"

case "$STACK" in
  production) PG_CONTAINER=tac-prod-postgres-acm ;;
  staging)    PG_CONTAINER=tac-postgres-acm ;;
  *) echo "[backup-acm] unknown STACK=$STACK" >&2; exit 2 ;;
esac

log() { echo "[backup-acm] $(date '+%F %T') $STACK · $*"; }
fail() { log "FAIL: $*"; exit 1; }

DATA_DIR="$REPO_DIR/data"
if [[ -f "$ENV_FILE" ]]; then
  v="$(grep -E '^DATA_DIR=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$//; s/^"//; s/"$//')"
  [[ -n "$v" ]] && DATA_DIR="$v"
fi

TS="$(date +%Y%m%dT%H%M%S)"
mkdir -p "$BACKUP_DIR"
docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || fail "container $PG_CONTAINER not running"

# 1) PostgreSQL
db_out="$BACKUP_DIR/db_acm-$TS.dump"
docker exec "$PG_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "${POSTGRES_DB:-db_acm}" -Fc' > "$db_out.tmp" \
  || { rm -f "$db_out.tmp"; fail "pg_dump"; }
docker exec -i "$PG_CONTAINER" pg_restore -l < "$db_out.tmp" > /dev/null \
  || { rm -f "$db_out.tmp"; fail "pg_restore -l could not read the dump"; }
mv "$db_out.tmp" "$db_out"
log "db_acm → $(basename "$db_out") ($(du -h "$db_out" | cut -f1))"

# 2) MinIO 첨부 + 업로드 폴더 (있을 때만)
for part in minio acm-uploads; do
  src="$DATA_DIR/$part"
  [[ -d "$src" ]] || { log "skip $part (no $src)"; continue; }
  out="$BACKUP_DIR/$part-$TS.tar.gz"
  docker run --rm -v "$src":/src:ro "$HELPER_IMAGE" tar -C /src -czf - . > "$out.tmp" \
    || { rm -f "$out.tmp"; fail "tar $part"; }
  gzip -t "$out.tmp" || { rm -f "$out.tmp"; fail "gzip -t $part"; }
  mv "$out.tmp" "$out"
  log "$part → $(basename "$out") ($(du -h "$out" | cut -f1))"
done

# 3) 보관 기간 지난 파일 정리
deleted="$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db_acm-*.dump' -o -name 'minio-*.tar.gz' -o -name 'acm-uploads-*.tar.gz' \) -mtime +"$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')"
log "pruned $deleted file(s) older than $RETENTION_DAYS days · done"
