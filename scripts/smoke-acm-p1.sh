#!/usr/bin/env bash
# ============================================================================
# ACM SCH + QNA P1 smoke test (Follow-up cycle 2026-05-02)
#
# Usage:
#   bash scripts/smoke-acm-p1.sh <BASE_URL> [TOKEN]
#   ACM_SMOKE_TOKEN=xxx bash scripts/smoke-acm-p1.sh https://acm-stg.amoeba.site
#
# Verifies 7 representative endpoints across SCH + QNA P1 surface.
# Exits non-zero on any failure.
# ============================================================================
set -u
set -o pipefail

BASE_URL="${1:-${ACM_SMOKE_BASE:-}}"
TOKEN="${2:-${ACM_SMOKE_TOKEN:-}}"

if [[ -z "${BASE_URL}" ]]; then
  echo "ERROR: BASE_URL required (arg #1 or ACM_SMOKE_BASE)"
  exit 2
fi

# If no TOKEN provided, log in via /api/acm/auth/login using
# ACM_SMOKE_EMAIL / ACM_SMOKE_PASSWORD (defaults match the seed admin).
if [[ -z "${TOKEN}" ]]; then
  EMAIL="${ACM_SMOKE_EMAIL:-admin@tpi.co.kr}"
  PASSWORD="${ACM_SMOKE_PASSWORD:-acm20261234}"
  echo "Logging in as ${EMAIL} ..."
  login_resp="$(curl -s -X POST -H 'Content-Type: application/json' \
        --data "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" \
        "${BASE_URL}/api/acm/auth/login")"
  TOKEN="$(printf '%s' "${login_resp}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')"
  if [[ -z "${TOKEN}" ]]; then
    echo "ERROR: login failed; response: ${login_resp}"
    exit 2
  fi
  echo "  -> token acquired (${#TOKEN} chars)"
fi

PASS=0
FAIL=0

call() {
  local name="$1"; shift
  local method="$1"; shift
  local path="$1"; shift
  local expect="$1"; shift
  local body="${1:-}"

  local args=(-s -o /tmp/acm-smoke-body.txt -w "%{http_code}" -X "${method}" \
              -H "Authorization: Bearer ${TOKEN}" \
              -H "Accept: application/json")
  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi
  local code
  code="$(curl "${args[@]}" "${BASE_URL}${path}" || echo 000)"

  if [[ "${code}" == "${expect}" ]]; then
    echo "  PASS [${code}] ${name}"
    PASS=$((PASS + 1))
  else
    echo "  FAIL [expected ${expect} got ${code}] ${name}"
    echo "  body: $(head -c 300 /tmp/acm-smoke-body.txt)"
    FAIL=$((FAIL + 1))
  fi
}

echo "ACM SCH + QNA P1 smoke against ${BASE_URL}"
echo

echo "[1] SCH — list schools"
call "GET /api/acm/sch/schools" GET "/api/acm/sch/schools" 200

echo "[2] SCH — autocomplete"
call "GET /api/acm/sch/schools/autocomplete?q=a" GET "/api/acm/sch/schools/autocomplete?q=a&limit=3" 200

echo "[3] QNA — list categories"
call "GET /api/acm/qna/categories" GET "/api/acm/qna/categories" 200

echo "[4] QNA — list questions"
call "GET /api/acm/qna/questions" GET "/api/acm/qna/questions" 200

echo "[5] QNA — list questions filtered (status=OPEN)"
call "GET /api/acm/qna/questions?status=OPEN" GET "/api/acm/qna/questions?status=OPEN" 200

echo "[6] QNA — list questions filtered (faqOnly=true)"
call "GET /api/acm/qna/questions?faqOnly=true" GET "/api/acm/qna/questions?faqOnly=true" 200

echo "[7] CSL — list inquiries (sanity, ent token reachability)"
call "GET /api/acm/csl/inquiries" GET "/api/acm/csl/inquiries" 200

echo
echo "RESULT: ${PASS} pass / ${FAIL} fail"
[[ "${FAIL}" -eq 0 ]] || exit 1
exit 0
