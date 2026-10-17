---
document_id: APP-ACADEMY-RUNBOOK-261017C-CUTOVER
version: 1.0.0
status: Ready
created: 2026-10-17
audience: Ops (Claude + 사용자)
related: PLN-261017C-prod-server-migration, PR #351 (domain), SERVER-261017-staging-production
change_log:
  - 1.0.0 (2026-10-17): 전환 당일 절차 — 211.110.140.172 → 175.126.232.175, 메인 도메인 acm-tpi.amoeba.site
---

# Production Cutover Runbook (프로덕션 전환 당일 절차)

| 항목 | 값 |
| --- | --- |
| 현재 서버 | 211.110.140.172 — `ssh acm-prod`(appacademy), root 는 `ssh amb-mail` |
| 새 서버 | 175.126.232.175 — `ssh acm-new`(appacademy), `ssh acm-new-root` |
| 도메인 | `acm-tpi.amoeba.site`(메인, 이미 새 서버 — 지금은 "점검 중" 화면), `acm.amoeba.site`(GoDaddy, 전환 때 변경) |
| 예상 쓰기 중단 | 10~15분 (DNS 전파 별도) |
| 담당 | **U** = 사용자, **C** = Claude |

## 0. D-1 (하루 전)

| # | 작업 | 담당 |
| --- | --- | --- |
| 0-1 | GoDaddy `acm.amoeba.site` TTL 600 → 300 | U |
| 0-2 | 보다스쿨·AMA: 출발 IP 허용 목록 확인, `acm-tpi.amoeba.site` 도메인 허용·앱 URL 추가 요청 | U |
| 0-3 | 새 서버 상태 점검: 컨테이너·인증서 2개·백업 cron·직결 키 (`ssh acm-new 'docker ps'`) | C |
| 0-4 | 사용자 공지: 점검 시각, 새 주소 `https://acm-tpi.amoeba.site`(다시 로그인·알림 허용 필요) | U |

## 1. 쓰기 중단 (T+0)

```bash
# 1-1 현재 서버: 점검 화면으로 전환(root). 되돌리기는 7장.
ssh amb-mail 'install -d /var/www/maintenance && cp /home/appacademy/app-academy/docker/maintenance/maintenance.html /var/www/maintenance/ \
  && cp /home/appacademy/app-academy/docker/maintenance/nginx-acm-maintenance.conf /etc/nginx/sites-available/acm-maintenance.conf \
  && ln -sf /etc/nginx/sites-available/acm-maintenance.conf /etc/nginx/sites-enabled/acm.amoeba.site \
  && nginx -t && systemctl reload nginx'
# 1-2 현재 서버: backend 정지(백그라운드 작업 중단). DB·MinIO 는 계속 둔다.
ssh acm-prod 'docker stop tac-prod-backend'
```

## 2. 최종 백업 → 새 서버 (T+2)

```bash
ssh acm-prod 'STACK=production BACKUP_DIR=/var/backups/app-academy/production ~/app-academy/scripts/backup-acm.sh'
# 방금 만든 세 파일을 직결로 전송 (약 70MB/s)
ssh acm-prod 'cd /var/backups/app-academy/production && TS=$(ls -t db_acm-*.dump | head -1 | sed "s/db_acm-//; s/.dump//") \
  && ssh -i ~/.ssh/id_ed25519_to_acm_new appacademy@175.126.232.175 "mkdir -p /backup/app-academy/cutover" \
  && scp -i ~/.ssh/id_ed25519_to_acm_new db_acm-$TS.dump minio-$TS.tar.gz acm-uploads-$TS.tar.gz appacademy@175.126.232.175:/backup/app-academy/cutover/ \
  && sha256sum *$TS*'
ssh acm-new 'cd /backup/app-academy/cutover && sha256sum *'   # 해시 대조
```

## 3. 새 서버 복원 (T+5)

```bash
ssh acm-new 'set -e; cd ~/app-academy; export DEPLOY_SHA=<운영 sha>
C="docker compose -f docker/production/docker-compose.production.yml --env-file docker/production/.env.production"
$C stop backend frontend-acm
B=/backup/app-academy/cutover; TS=$(ls -t $B/db_acm-*.dump | head -1 | sed "s#.*/db_acm-##; s/.dump//")
docker exec tac-prod-postgres-acm sh -c "dropdb -U \"\$POSTGRES_USER\" --force \"\$POSTGRES_DB\" && createdb -U \"\$POSTGRES_USER\" \"\$POSTGRES_DB\""
docker exec -i tac-prod-postgres-acm sh -c "pg_restore -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" --no-owner --exit-on-error" < $B/db_acm-$TS.dump
$C stop minio
docker run --rm -v $PWD/data/minio:/dst -v $B:/b:ro redis:7-alpine sh -c "find /dst -mindepth 1 -delete && tar -C /dst -xzf /b/minio-$TS.tar.gz"
docker run --rm -v $PWD/data/acm-uploads:/dst -v $B:/b:ro redis:7-alpine sh -c "find /dst -mindepth 1 -delete && tar -C /dst -xzf /b/acm-uploads-$TS.tar.gz"
$C start minio'
ssh acm-prod 'tar -C ~/app-academy/sql -cf - _applied' | ssh acm-new 'tar -C ~/app-academy/sql -xf -'
```

검증: 테이블별 건수 대조(현재 서버 DB 는 1-2 이후 변하지 않음) — 167 테이블 전부 일치해야 다음 단계.

## 4. 새 서버 실서비스 설정 (T+10)

```bash
# 4-1 외부 통신 차단 해제 (리허설 안전장치)
ssh acm-new-root 'while iptables -S DOCKER-USER | grep -q acm-rehearsal; do
  r=$(iptables -S DOCKER-USER | grep acm-rehearsal | head -1 | sed "s/^-A/-D/"); eval iptables $r; done; iptables -S DOCKER-USER'
# 4-2 메인 주소 env (값 출력 없이 키만 교체)
ssh acm-new 'cd ~/app-academy/docker/production && sed -i -E "s#^FRONTEND_URL=.*#FRONTEND_URL=https://acm-tpi.amoeba.site#" .env.production \
  && (grep -q "^ACM_PUBLIC_URL=" .env.production && sed -i -E "s#^ACM_PUBLIC_URL=.*#ACM_PUBLIC_URL=https://acm-tpi.amoeba.site#" .env.production || echo "ACM_PUBLIC_URL=https://acm-tpi.amoeba.site" >> .env.production) \
  && grep -E "^(FRONTEND_URL|ACM_PUBLIC_URL)=" .env.production'
# 4-3 도메인 PR #351 머지(C) → 새 서버 nginx 반영, 임시 "점검 중" 설정 제거
gh pr ready 351 && gh pr merge 351 --merge
ssh acm-new 'cd ~/app-academy && git fetch -q && git reset -q --hard origin/main'
ssh acm-new-root 'rm -f /etc/nginx/sites-enabled/acm-tpi-prelaunch.conf /etc/nginx/sites-available/acm-tpi-prelaunch.conf \
  && cp /home/appacademy/app-academy/docker/production/nginx-acm.conf /etc/nginx/sites-available/acm.amoeba.site \
  && nginx -t && systemctl reload nginx'
# 4-4 앱 기동 (운영 sha 그대로)
ssh acm-new 'cd ~/app-academy && DEPLOY_SHA=<운영 sha> docker compose -f docker/production/docker-compose.production.yml --env-file docker/production/.env.production up -d backend frontend-acm'
```

검증(C): `https://acm-tpi.amoeba.site/admin/login` 200, `/api/acm/auth/me` 401, 없는 경로 404,
`curl --resolve acm.amoeba.site:443:175.126.232.175` 로 같은 확인, backend 로그 에러 없음.

## 5. DNS 전환 (T+15)

| # | 작업 | 담당 |
| --- | --- | --- |
| 5-1 | GoDaddy `acm.amoeba.site` A → `175.126.232.175` | U |
| 5-2 | `dig +short acm.amoeba.site @8.8.8.8` 로 전파 확인, 두 도메인 실제 접속 확인 | C |
| 5-3 | 새 서버 `certbot renew --dry-run --cert-name acm.amoeba.site` 성공 확인 | C |

## 6. 마무리 (당일)

| # | 작업 | 담당 |
| --- | --- | --- |
| 6-1 | GitHub `production` Environment: `PRODUCTION_SSH_HOST=175.126.232.175`, `PRODUCTION_SSH_KEY`=새 배포 키(C 가 생성·등록, 비밀키 전달 방법 협의) | U(+C) |
| 6-2 | `gh workflow run cd-production.yml -f sha=<머지 후 main sha>` 로 파이프라인 확인 | C |
| 6-3 | 현재 서버: `frontend` 도 정지(점검 화면은 nginx 가 계속 표시), cron 은 유지(14일 보존 기간 백업) | C |
| 6-4 | 다음 날 02:30 새 서버 백업 생성 확인 | C |
| 6-5 | 문서·메모리 갱신(SERVER-261017, RUNBOOK-CURRENT) | C |

Google Drive 리디렉트 URI(DB `amb_acm_sys_google_app.sga_redirect_uri`)는 `acm.amoeba.site` 로 그대로 둔다 — 최종 메인 `acm.tpi.co.kr` 로 갈 때 한 번만 바꾼다.

## 7. Rollback (되돌리기)

| 시점 | 방법 |
| --- | --- |
| 5-1 이전 | 현재 서버: `ln -sf /etc/nginx/sites-available/acm.amoeba.site /etc/nginx/sites-enabled/acm.amoeba.site && nginx -t && systemctl reload nginx`(root), `docker start tac-prod-backend` → 원복. 새 서버는 정지 |
| 5-1 이후 | GoDaddy A 를 211.110.140.172 로 되돌리고 위와 같이 현재 서버 재기동. 새 서버에 쓰인 데이터는 덤프해 수동 반영 |
| D+14 이전 | 현재 서버 데이터·이미지 보존 — 언제든 위 절차로 원복 |

## 8. D+14 정리

현재 서버 ACM 컨테이너·이미지 제거(마지막 백업은 새 서버 `/backup` 에 보관), cron 제거, 직결 키(`~/.ssh/id_ed25519_to_acm_new`, 새 서버 authorized_keys 의 `acm-migration` 줄) 삭제. 다른 스택은 손대지 않는다.
