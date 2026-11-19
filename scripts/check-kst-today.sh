#!/usr/bin/env bash
# REQ-261119 FR-9 — '오늘·이번 달' 을 UTC 로 구하는 코드 차단.
# `new Date().toISOString().slice(0, 10|7)` 과 SQL `CURRENT_DATE` 는 서버(UTC) 기준이라
# 한국 00:00~09:00 에 하루 어긋난다. 대신:
#   backend : todayInTz() / monthInTz()  (acm-common/time/zoned-time.util)
#   frontend: todayKst() / monthKst()    (@/lib/tz)
set -euo pipefail
cd "$(dirname "$0")/.."
hits=$(grep -rnE "new Date\(\)\.toISOString\(\)\.(slice|substring)\(0, ?(7|10)\)|\bCURRENT_DATE\b" \
  backend/src frontend-acm/src --include='*.ts' --include='*.tsx' \
  | grep -vE "\.spec\.tsx?:|^[^:]+:[0-9]+:\s*(//|\*|/\*)" || true)
if [ -n "$hits" ]; then
  echo "::error::UTC 기준 '오늘' 계산 발견 — todayInTz()/todayKst() 를 쓰세요 (REQ-261119)"
  echo "$hits"
  exit 1
fi
echo "kst-today check OK"
