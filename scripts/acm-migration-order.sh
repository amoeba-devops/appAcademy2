#!/usr/bin/env bash
# REQ-261017 FR-7 — sql/acm 마이그레이션 적용 순서(한 줄에 파일 경로 하나).
#
# 사전순(sort)은 1002-… 가 110-… 보다 먼저 와서 빈 DB 에서 31개가 실패했다.
# 버전 순(번호 → 접미사 → 이름: 100 < 999 < 999m < 999zz < 1000)으로 정렬하고,
# 나중 번호에 의존하는 999* 3개는 의존 대상 바로 뒤에 둔다.
# 배포 스크립트·로컬 docker 초기화·CI 빈 DB 검사·통합 테스트가 모두 이 순서를 쓴다.
# 이미 적용된 파일은 각 배포 스크립트의 마커(파일명 + sha256)로 건너뛰므로 기존 환경엔 영향 없음.
# bash 3.2(macOS)·BSD 도구에서도 동작하도록 정렬·재배치는 awk/sort 만 쓴다.
#
# usage: scripts/acm-migration-order.sh [sql_dir]   (기본: 이 스크립트 기준 ../sql/acm)
set -euo pipefail

dir="${1:-$(cd "$(dirname "$0")/../sql/acm" && pwd)}"

# 999* 파일 → 의존 대상 접두어(그 파일 바로 뒤에 적용)
DEFERRED='999m-=1006- 999r-=1007- 999y-=1025-'

for path in "$dir"/*.sql; do
  [ -f "$path" ] && basename "$path"
done |
  awk '{ match($0, /^[0-9]+/); n = substr($0, 1, RLENGTH); rest = substr($0, RLENGTH + 1);
         match(rest, /^[a-z]*/); s = substr(rest, 1, RLENGTH);
         printf "%010d\t%s\t%s\n", n, s, $0 }' |
  LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2 -k3,3 |
  cut -f3 |
  awk -v dir="$dir" -v deferred="$DEFERRED" '
    BEGIN { n = split(deferred, pairs, " ");
            for (i = 1; i <= n; i++) { split(pairs[i], kv, "="); after[kv[1]] = kv[2] } }
    { files[++count] = $0 }
    END {
      for (i = 1; i <= count; i++) {
        f = files[i]; held = 0
        for (p in after) if (index(f, p) == 1) { held = 1; queue[after[p]] = queue[after[p]] f "\n" }
        if (!held) order[++m] = f
      }
      for (i = 1; i <= m; i++) {
        f = order[i]; print dir "/" f
        for (a in queue) if (index(f, a) == 1 && queue[a] != "") {
          k = split(queue[a], q, "\n"); for (j = 1; j <= k; j++) if (q[j] != "") print dir "/" q[j]
          queue[a] = ""
        }
      }
      for (a in queue) if (queue[a] != "") {
        k = split(queue[a], q, "\n"); for (j = 1; j <= k; j++) if (q[j] != "") print dir "/" q[j]
      }
    }'
