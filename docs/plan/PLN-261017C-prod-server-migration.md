---
document_id: ACM-PROD-SERVER-MIGRATION-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-17
related: REQ-261017C-prod-server-migration, SERVER-261017-staging-production, RUNBOOK-261017-fresh-environment
change_log:
  - version: 1.1.0
    date: 2026-10-17
    description: Approved; WP1–WP4 done, rehearsal results / 승인, 1~4단계 완료·리허설 결과
  - version: 1.0.0
    date: 2026-10-17
    description: Work plan with target layout and cutover steps / 작업 계획 + 서버 구성안 + 전환 절차
---
# Production Server Migration Plan (프로덕션 서버 이전 작업 계획)

요구사항: [REQ-261017C](../analysis/REQ-261017C-prod-server-migration.md)

## 1. Target Layout (서버 구성안)

```
                 acm.amoeba.site (GoDaddy DNS, A → 175.126.232.175 전환)
                                   │ 443 / 80
┌──────────────────────── 175.126.232.175 (ACM 전용) ────────────────────────┐
│ ufw: 22, 80, 443 만 허용                                                    │
│ nginx (호스트) ── TLS(certbot webroot, 자동 갱신)                            │
│   ├─ /            → 127.0.0.1:5174  acm-prod-frontend                      │
│   ├─ /api/*       → 127.0.0.1:4000  tac-prod-backend                       │
│   └─ /.well-known → /var/www/certbot                                       │
│ Docker (compose: docker/production/docker-compose.production.yml)          │
│   tac-prod-postgres-acm 127.0.0.1:5434   tac-prod-redis 127.0.0.1:6379      │
│   tac-prod-minio 127.0.0.1:9000/9001     데이터: ~/app-academy/data         │
│ /backup (931G)                                                             │
│   └ app-academy/production/  db_acm-YYYYMMDD.dump, minio-YYYYMMDD.tar.gz    │
│     (매일 02:30, 30일 보관)                                                  │
│ 계정: root(키 전용, 관리) / appacademy(키 전용, docker 그룹 + 제한 sudo)     │
└────────────────────────────────────────────────────────────────────────────┘
현재 서버 211.110.140.172: 전환 후 ACM 컨테이너만 정지·14일 보존 (메일서버 등 다른 스택 영향 없음)
```

## 2. Work Packages (작업 단위)

진행은 WP1 → WP7 순서. WP1~WP4 는 **서비스 영향 없음**(새 서버만 작업). WP5 만 점검 시간 필요.

### WP1. 서버 기본·보안 (새 서버, root) — 영향 없음

1. 패키지 업데이트, `unattended-upgrades`(보안 업데이트 자동), `fail2ban`(SSH 무차별 대입 차단).
2. 스왑 4GB(`/swapfile`), 시간대 Asia/Seoul 유지.
3. SSH 하드닝: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`
   — **적용 전 키 접속(root·appacademy) 재확인, 적용 후 새 세션으로 재확인**(끊김 방지).
4. 방화벽 `ufw`: 22/tcp, 80/tcp, 443/tcp 허용 후 활성화. 5000번(cafe24 기본 thttpd)은 외부 차단.

### WP2. 런타임 설치 (root) — 영향 없음

1. Docker Engine + Compose v2(공식 저장소), `appacademy` 를 docker 그룹에 추가.
2. nginx, certbot, `/var/www/certbot`, `/var/log/app-academy`(appacademy 소유).
3. 제한 sudo(`/etc/sudoers.d/appacademy-deploy`, `visudo -c` 검증) — 배포 스크립트가 쓰는 명령만 허용:
   - `cmp`/`cp` `docker/production/nginx-acm.conf` → `/etc/nginx/sites-available/acm.amoeba.site`, `ln -sf` sites-enabled
   - `nginx -t`, `systemctl reload nginx`
   - 업로드 폴더 `mkdir`/`chown 100:101`/`chmod 770` (경로 고정)
   - 스크립트 변경 없음: `SUDO_PASS` 가 비어 있으면 `sudo` 를 그대로 호출 → 비밀번호 없이 통과.

### WP3. 앱 준비 (appacademy) — 영향 없음

1. `git clone https://github.com/amoeba-devops/appAcademy2.git ~/app-academy` (공개 저장소).
2. `.env.production` 를 현재 서버 → 새 서버로 **파일 대 파일 복사**(값 출력 없음, 권한 600).
   새 서버에서 쓰지 않는 항목 정리 대상 표시만: `SUDO_PASS`, `MYSQL_*`, `NEXTAUTH_*`(레거시) — 삭제는 전환 안정화 후.
3. DB 이미지 빌드 `tac-postgres-acm:pg16-bigm`, 앱 이미지 `docker pull …:<현재 운영 sha>`(GHCR 익명 pull 확인됨).
4. 인증서(리허설용): 현재 서버의 `acm.amoeba.site` 인증서를 root 경로로 복사해 nginx 에 임시 사용
   (DNS 전환 전에는 새 서버에서 발급 불가). 전환 후 WP6 에서 새로 발급.

### WP4. 백업 스크립트 + 리허설 (영향 없음)

1. **새 백업 스크립트**(저장소 PR): `scripts/backup-acm.sh`
   - `pg_dump -Fc db_acm` + MinIO 데이터 `tar.gz` → `BACKUP_DIR`(기본 `/var/backups/app-academy/<stack>`), 30일 지난 파일 삭제, 결과 로그.
   - 새 서버 `BACKUP_DIR=/backup/app-academy/production`, 현재 서버 cron 도 같은 스크립트로 교체(백업 즉시 복구).
2. **리허설 이전**: 현재 서버 `pg_dump -Fc` → 새 서버 `pg_restore`, MinIO `rsync`, `sql/_applied/acm` 마커 복사.
3. 새 서버에서 compose 전체 기동 → 검증(도메인 전환 없이):
   - `curl --resolve acm.amoeba.site:443:175.126.232.175 https://acm.amoeba.site/admin/login` → 200
   - API 401/404, 테이블별 건수 현재 서버와 대조, 첨부 1건 다운로드.
4. 리허설 소요시간 측정 → 실제 점검 시간 확정.

### WP5. 전환 (점검 시간, 목표 30분)

| 시각 | 작업 | 담당 |
| --- | --- | --- |
| D-1 | GoDaddy 에서 `acm.amoeba.site` TTL 600 → 300 | 사용자 |
| D-1 | 보다스쿨·AMA 출발 IP 허용 목록 확인(필요 시 새 IP 추가) | 사용자 |
| T-0 | 현재 서버 backend·frontend 정지(쓰기 중단) — DB·MinIO 는 유지 | Claude |
| T+5 | 최종 `pg_dump` → 새 서버 복원, MinIO 증분 `rsync`, 건수 대조 | Claude |
| T+15 | 새 서버 backend·frontend 기동, `--resolve` 로 검증 | Claude |
| T+20 | GoDaddy A 레코드 → 175.126.232.175 | 사용자 |
| T+25 | 전파 확인(`dig`), 실제 도메인으로 로그인 화면·API 확인 | Claude |
| T+30 | 새 서버에서 certbot 발급(webroot) → nginx reload | Claude |

### WP6. 전환 후 (당일)

1. 인증서 발급·자동 갱신 dry-run, 백업 cron 첫 실행 확인.
2. GitHub `production` Environment: `PRODUCTION_SSH_HOST=175.126.232.175`, `PRODUCTION_SSH_KEY` 새 배포 키
   — 저장소 관리자(사용자) 작업. 새 배포 키는 Claude 가 만들어 appacademy 에 등록, 비밀키 전달 방법은 사용자와 정함.
3. 다음 배포를 `cd-production` 로 실행해 파이프라인 확인.
4. 문서·메모리 갱신(SERVER-261017, RUNBOOK-CURRENT).

### WP7. 정리 (D+14)

현재 서버의 ACM 컨테이너·이미지 제거(데이터는 최종 백업 1부 `/backup` 에 보관), 현재 서버 cron 제거. 다른 스택은 손대지 않음.

## 3. Rollback (되돌리기)

| 시점 | 방법 |
| --- | --- |
| DNS 변경 전 | 새 서버 정지, 현재 서버 backend·frontend 재기동 → 즉시 원복 |
| DNS 변경 후 문제 | GoDaddy A 레코드 → 211.110.140.172, 현재 서버 재기동. 전환 후 새 서버에 쓰인 데이터는 덤프해 수동 반영 |
| D+14 이전 | 현재 서버 데이터·컨테이너 그대로라 언제든 원복 가능 |

## 4. Verification Checklist (검증)

- [ ] SSH: 비밀번호 로그인 거부, root·appacademy 키 접속 정상
- [ ] ufw: 22·80·443 외 외부 접근 불가
- [ ] 테이블별 건수 일치(이전 전·후), 첨부 다운로드
- [ ] 로그인 화면 200, API 401, 없는 경로 404, 번들 버전 일치
- [ ] 인증서 발급·`certbot renew --dry-run`
- [ ] 백업 파일 생성·복원 테스트(빈 DB 로 `pg_restore`)
- [ ] `cd-production` 배포 1회 성공

## 5. Decisions Needed (결정 필요)

REQ 6장 Q1~Q6. 특히 **Q1 DNS 담당**, **Q2 전환 시각**, **Q4 보다스쿨·AMA IP 허용 목록**.
WP1~WP4 는 결정 전에도 진행 가능(서비스 영향 없음).

## 6. WP1–WP4 Results (1~4단계 결과, 2026-10-17)

| 단계 | 결과 |
| --- | --- |
| WP1 | 패키지 업데이트·재부팅(kernel 5.15.0-198), unattended-upgrades, fail2ban(sshd), 스왑 4GB 파일 추가(기존 4.1GB 파티션 포함 총 8GB). SSH: 비밀번호 로그인 차단·root 키 전용 — 새 세션으로 root·appacademy 키 접속 확인, 비밀번호 시도 거부 확인. ufw 22·80·443 만 허용(5000 외부 차단 확인) |
| WP2 | Docker 29.9.1 / Compose 5.6.0, nginx 1.18, certbot 1.21. docker 로그 20MB×5 회전. appacademy docker 그룹. 제한 sudo `/etc/sudoers.d/appacademy-deploy`(허용 명령만 무비밀번호, 그 외 거부 확인) |
| WP3 | 저장소 체크아웃, `.env.production` 파일 대 파일 복사(해시 일치, 600). DB 이미지 빌드, 앱 이미지 `516523d` pull(운영과 이미지 ID 동일). **MinIO 이미지는 Docker Hub 에서 더 이상 받을 수 없어** 현재 서버에서 `docker save/load` 로 복사. 현재 서버의 `acm.amoeba.site` 인증서 일체(webroot 갱신 설정 포함)를 복사 → 전환 후 그대로 자동 갱신 |
| WP4 | `scripts/backup-acm.sh`(PR #350) — 현재 서버 cron 교체(14일 보관, 공유 디스크), 새 서버 cron(`/backup`, 30일). 리허설: 현재 서버 백업으로 새 서버 복원 — 테이블 167개·행 28,521 **전부 일치**, MinIO 파일 65개·업로드 22개 일치, 실제 도메인·인증서로 로그인 200/API 401/404/매뉴얼 200, 번들 동일 |

리허설 중 안전장치: 새 서버 컨테이너의 외부 통신 차단(iptables `DOCKER-USER`, 주석 `acm-rehearsal`) — 알림·메일·보다스쿨·AMA 중복 호출 방지. **전환 직전에 해제한다.**

전환 소요 예측: DB 덤프 2초 + 복원 4초, 서버 간 직결(키 `from=211.110.140.172` 제한, 약 70MB/s)로 MinIO 증분 rsync 수 초 → **쓰기 중단 10~15분** (DNS 전파 별도).

전환 시 추가 절차: ① 새 서버 rehearsal DB 를 비우고(`dropdb`/`createdb`) 최종 덤프 복원 ② iptables `acm-rehearsal` 규칙 삭제 ③ 서버 간 직결 키는 D+14 정리 때 제거.

후속 과제: 새 환경 구축 시 MinIO 이미지 확보 방법(사설 레지스트리 또는 GHCR 미러) — RUNBOOK-261017 보완 필요.
