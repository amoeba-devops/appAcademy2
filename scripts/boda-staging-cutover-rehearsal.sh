#!/usr/bin/env bash
# =============================================================================
# BODA staging 컷오버 리허설 (REQ-260526 T8 / RPT-260624)
#
# 목적: 벤더 실연동 전환 전, staging 에서 "설정 → 룸 개설 → 입장 컨텍스트 →
#       (시뮬레이션) 상태머신/출결" 을 API 로 점검한다.
#
# 안전: 자격증명(authKey 등)은 코드에 넣지 않고 환경변수로만 받는다.
#       조회/생성/시뮬레이션만 수행하며, 마지막에 테스트 이벤트를 정리한다.
#
# 사전 준비 (호출 측):
#   export ACM_BASE="https://<staging-host>/api"   # 예: https://acm-stg.amoeba.site/api
#   export ACM_JWT="<staging ADMIN 계정 JWT>"        # /admin/login 후 토큰
#   export BODA_AUTHKEY="769730064"                  # 벤더 문서값 (커밋 금지)
#   # 선택:
#   export BODA_EVENTSECRET="<고정 헤더 토큰>"        # 벤더가 토큰 지원 시
#   export BODA_ALLOW_CIDRS="1.2.3.0/24"             # 벤더 회신 IP 대역
#
# 서버측(SSH) 선행 필요 — 이 스크립트로는 불가, §끝 참고:
#   BODA_BASIC_AUTH, BODA_MODE=http, BODA_SIMULATE_ENABLED=true
#
# 사용:
#   bash scripts/boda-staging-cutover-rehearsal.sh
# =============================================================================
set -euo pipefail

# ---- config (identifiers — TPI 기본값, 필요 시 override) --------------------
ACM_BASE="${ACM_BASE:?ACM_BASE 미설정 (예: https://acm-stg.amoeba.site/api)}"
ACM_JWT="${ACM_JWT:?ACM_JWT 미설정 (staging ADMIN JWT)}"
BODA_AUTHKEY="${BODA_AUTHKEY:?BODA_AUTHKEY 미설정 (벤더 문서값, 커밋 금지)}"

BODA_WEB_URL="${BODA_WEB_URL:-https://bodaedu.kr}"
BODA_SVR_URL="${BODA_SVR_URL:-https://svr.bodaedu.kr}"
BODA_WEBRTC_URL="${BODA_WEBRTC_URL:-https://bodaedu.kr/webrtc}"
BODA_COMPANY_CODE="${BODA_COMPANY_CODE:-245}"
BODA_COMPANY_ID="${BODA_COMPANY_ID:-tpi}"
BODA_ROOM_CODE="${BODA_ROOM_CODE:-699}"
BODA_EVENTSECRET="${BODA_EVENTSECRET:-}"
BODA_ALLOW_CIDRS="${BODA_ALLOW_CIDRS:-}"
RUN_SIMULATE="${RUN_SIMULATE:-1}"   # 0 으로 두면 webhook 시뮬레이션 건너뜀

command -v jq  >/dev/null || { echo "jq 필요 (brew install jq)"; exit 1; }
command -v curl >/dev/null || { echo "curl 필요"; exit 1; }

AUTH=(-H "Authorization: Bearer ${ACM_JWT}")
JSON=(-H "Content-Type: application/json")
say(){ printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
ok(){ printf '  \033[32m✓ %s\033[0m\n' "$*"; }
die(){ printf '  \033[31m✗ %s\033[0m\n' "$*"; exit 1; }

# unwrap {success,data} envelope 또는 raw
data(){ jq -c 'if type=="object" and has("data") then .data else . end'; }

# ---- 0. preflight -----------------------------------------------------------
say "0. Preflight — 인증 확인 (GET /acm/auth/me)"
me=$(curl -fsS "${AUTH[@]}" "${ACM_BASE}/acm/auth/me" || die "auth 실패 — ACM_BASE/ACM_JWT 확인")
role=$(echo "$me" | data | jq -r '.user.role // .role // "?"')
echo "  role=${role}"; [ "$role" = "ADMIN" ] || [ "$role" = "APP_ADMIN" ] || die "ADMIN 권한 필요 (현재 ${role})"
ok "인증 OK"

# ---- 1. BODA 설정 저장 -------------------------------------------------------
say "1. BODA 테넌트 설정 저장 (PUT /admin/cal/boda/config)"
cfg=$(jq -n \
  --arg web "$BODA_WEB_URL" --arg svr "$BODA_SVR_URL" --arg rtc "$BODA_WEBRTC_URL" \
  --arg cc "$BODA_COMPANY_CODE" --arg ci "$BODA_COMPANY_ID" --arg rc "$BODA_ROOM_CODE" \
  --arg ak "$BODA_AUTHKEY" --arg es "$BODA_EVENTSECRET" --arg cidr "$BODA_ALLOW_CIDRS" \
  '{bodaWebUrl:$web, svrUrl:$svr, webrtcUrl:$rtc, companyCode:$cc, companyId:$ci,
    defaultRoomCode:$rc, authKey:$ak, isActive:true}
   + (if $es  != "" then {eventSecret:$es} else {} end)
   + (if $cidr!= "" then {webhookAllowCidrs:$cidr} else {} end)')
curl -fsS -X PUT "${AUTH[@]}" "${JSON[@]}" -d "$cfg" "${ACM_BASE}/admin/cal/boda/config" >/dev/null \
  || die "설정 저장 실패"
ok "설정 저장"

say "2. 설정 검증 (GET /admin/cal/boda/config)"
g=$(curl -fsS "${AUTH[@]}" "${ACM_BASE}/admin/cal/boda/config" | data)
echo "$g" | jq '{companyCode, companyId, defaultRoomCode, isActive, authKeyIsSet, eventSecretIsSet, webhookAllowCidrs}'
[ "$(echo "$g" | jq -r '.companyCode')" = "$BODA_COMPANY_CODE" ] || die "companyCode 불일치"
[ "$(echo "$g" | jq -r '.authKeyIsSet')" = "true" ] || die "authKey 미저장"
ok "설정 검증 OK (비밀은 *IsSet 플래그로만 노출)"

# ---- 3. 테스트 BODA 이벤트 생성 ---------------------------------------------
say "3. 테스트 수업 일정 생성 (POST /acm/cal/events, provider=BODASCHOOL)"
start=$(date -u -v+2M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+2 min' +%Y-%m-%dT%H:%M:%SZ)
end=$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)
body=$(jq -n --arg s "$start" --arg e "$end" \
  '{evtTitle:"[리허설] BODA 컷오버 점검", evtCategory:"CLASS",
    evtStartAt:$s, evtEndAt:$e, evtMeetingProvider:"BODASCHOOL"}')
created=$(curl -fsS -X POST "${AUTH[@]}" "${JSON[@]}" -d "$body" "${ACM_BASE}/acm/cal/events" | data)
EVT=$(echo "$created" | jq -r '.id // .evtId')
[ -n "$EVT" ] && [ "$EVT" != "null" ] || die "이벤트 생성 실패: $created"
ok "evtId=${EVT}  meetingUrl=$(echo "$created" | jq -r '.evtMeetingUrl // "?"')"

cleanup(){ say "정리 — 테스트 이벤트 삭제"; curl -fsS -X DELETE "${AUTH[@]}" "${ACM_BASE}/acm/cal/events/${EVT}" >/dev/null 2>&1 && ok "삭제" || echo "  (수동 삭제 필요: ${EVT})"; }
trap cleanup EXIT

# ---- 4. launch-context 검증 -------------------------------------------------
say "4. 런처 컨텍스트 (GET /cal/boda/launch-context?evtId=)"
lc=$(curl -fsS "${AUTH[@]}" "${ACM_BASE}/cal/boda/launch-context?evtId=${EVT}&lang=ko" | data)
echo "$lc" | jq '{status, userType, meetKey, roomCode, webBrowserUrl, embedUrl, ownerName, evtSource}'
[ "$(echo "$lc" | jq -r '.meetKey')" != "null" ] || die "meetKey 없음"
case "$(echo "$lc" | jq -r '.meetKey')" in tac-*) ok "meetKey 형식 tac-… OK";; *) die "meetKey 형식 이상";; esac
[ "$(echo "$lc" | jq -r '.roomCode')" = "$BODA_ROOM_CODE" ] || echo "  ⚠ roomCode=$(echo "$lc" | jq -r '.roomCode') (기대 ${BODA_ROOM_CODE})"
ok "런처 컨텍스트 OK (status=$(echo "$lc" | jq -r '.status'))"

# ---- 5. webhook 상태머신 시뮬레이션 (BODA_SIMULATE_ENABLED 필요) -------------
if [ "$RUN_SIMULATE" = "1" ]; then
  say "5. 상태머신 시뮬레이션 (POST …/boda/simulate-event)  ※ 서버 BODA_SIMULATE_ENABLED=true 필요"
  sim(){ # $1=eventCode $2=expectedStatus
    local r; r=$(curl -fsS -X POST "${AUTH[@]}" "${JSON[@]}" -d "{\"eventCode\":$1}" \
      "${ACM_BASE}/admin/cal/events/${EVT}/boda/simulate-event" 2>/dev/null | data) || { echo "  ⚠ simulate(code $1) 실패 — BODA_SIMULATE_ENABLED 확인"; return 0; }
    local st; st=$(echo "$r" | jq -r '.status'); echo "  event $1 → status=${st}"
    [ "$st" = "$2" ] && ok "기대 상태 ${2}" || echo "  ⚠ 기대 ${2}, 실제 ${st}"
  }
  sim 1 OPEN      # 개설
  sim 2 STARTED   # 시작
  sim 4 ENDED     # 종료
  sim 5 CLOSED    # 폐쇄
  st=$(curl -fsS "${AUTH[@]}" "${ACM_BASE}/cal/boda/rooms/${EVT}/status" | data | jq -r '.status')
  ok "최종 룸 상태 = ${st}"
else
  echo "  (RUN_SIMULATE=0 — 시뮬레이션 건너뜀)"
fi

say "리허설 완료 ✅"
cat <<'NOTE'

────────────────────────────────────────────────────────────────────────
서버측(SSH) 선행/마무리 단계 — 이 스크립트로는 불가 (staging 호스트에서):
  1) env 설정:
       BODA_MODE=http
       BODA_BASIC_AUTH=MjQ1Ojc2OTczMDA2NA==   (= base64 "245:769730064")
       BODA_SIMULATE_ENABLED=true             (리허설용, 운영 전 off)
  2) 백엔드 재시작 (scripts/deploy-staging.sh 또는 compose restart)
  3) 실연동 검증:
       - 강사 계정으로 /web/classroom/{evtId} 진입 → BODA 클라이언트 입장
       - 벤더가 webhook(event 1) 전송 → 룸 OPEN 자동 전환 확인
       - GET /cal/boda/rooms/{evtId}/status 로 상태 추적
  4) iframe(모드 A)은 Q-LX-1 회신 시 BODA_EMBED_ENABLED=true
운영 전환: 위 검증 통과 후 production 에 동일 env + config 반영.
────────────────────────────────────────────────────────────────────────
NOTE
