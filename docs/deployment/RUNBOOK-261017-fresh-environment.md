---
document_id: APP-ACADEMY-RUNBOOK-261017-FRESH-ENV
version: 1.1.0
status: Active
created: 2026-10-17
audience: Ops / Maintainer
related: REQ-261017, PLN-261017, RUNBOOK-CURRENT
change_log:
  - 1.1.0 (2026-10-17): 공개 시드 비밀번호 하드닝(REQ-261017B) — ACM_INITIAL_ADMIN_PASSWORD 절차
  - 1.0.0 (2026-10-17): 최초 작성 — 빈 DB 에서 새 환경 구축 절차
---

# New Environment Setup (새 환경 구축) — Runbook

## 1. Overview (개요)

빈 PostgreSQL 에서 ACM 스택을 처음 띄우는 절차다(새 스테이징·재해 복구·로컬 초기화).
기존 환경 배포는 [RUNBOOK-CURRENT](RUNBOOK-CURRENT.md) 를 따른다.

REQ-261017 이전에는 `sql/acm/*.sql` 을 이름 순으로 적용해 빈 DB 에서 31개 파일이 실패했다.
이제 배포 스크립트·로컬 docker·CI·통합 테스트가 모두 같은 순서 스크립트를 쓴다.

| 항목 | 내용 |
| --- | --- |
| 순서 스크립트 | `scripts/acm-migration-order.sh <sql_dir>` — 숫자 버전 순, 접미사(a,b,…) 순 |
| 의존 역순 예외 | `999m` → `1006` 뒤, `999r` → `1007` 뒤, `999y` → `1025` 뒤 (스크립트 `DEFERRED`) |
| 적용 기록 | `sql/_applied/acm/<파일명>.sha256` (파일명 + 내용 해시) |
| CI 검증 | `ci.yml` backend-integration · "Fresh install (empty DB) migration check" |

> 새 마이그레이션이 **더 큰 번호의 파일에 의존**하면 빈 DB 에서 실패한다. 번호를 의존 대상보다 크게 매기거나,
> 불가피하면 `DEFERRED` 에 추가한다. CI 의 fresh-install 단계가 이를 잡아낸다.

## 2. Prerequisites (사전 준비)

1. 호스트 접근·TLS: 기존 호스트 절차와 동일 (SSH 키, certbot webroot).
2. 저장소: `git clone https://github.com/amoeba-devops/appAcademy2 ~/app-academy`
3. 환경 파일: `docker/production/.env.production` (또는 staging) — [DEPLOY-SECRETS-SETUP](DEPLOY-SECRETS-SETUP.md) 기준.
   최소 `ACM_PG_*`, `ACM_JWT_SECRET`, `ACM_PII_KEY`(64 hex), `ACM_PUBLIC_URL`(예: `https://acm.example`), `DEPLOY_SHA`,
   **`ACM_INITIAL_ADMIN_PASSWORD`**(12자 이상, 영문·숫자 포함 — 4장 참고).
4. `sql/_applied/acm/` 가 **비어 있어야** 한다(다른 환경의 마커를 복사하지 않는다).

## 3. Procedure (절차)

```bash
cd ~/app-academy
# 1) 빈 DB 로 시작 — DEPLOY_SQL_BOOTSTRAP 은 쓰지 않는다(마커만 찍고 적용하지 않음).
unset DEPLOY_SQL_BOOTSTRAP
scripts/deploy-production.sh          # 스테이징은 scripts/deploy-staging.sh
```

배포 로그 4단계에서 모든 파일이 `[apply] … OK` 여야 한다(2026-10-17 기준 136개). `FAIL` 이면 해당 파일 이름과
마지막 10줄이 출력되고 배포가 중단된다 — 컨테이너는 재시작되지 않는다.

확인:

```bash
docker exec -i tac-prod-postgres-acm sh -c 'psql -U "$POSTGRES_USER" -d db_acm -Atc "select count(*) from pg_tables where tablename like '\''amb_acm_%'\''"'
ls sql/_applied/acm | wc -l           # sql/acm/*.sql 개수와 같아야 한다
curl -s -o /dev/null -w '%{http_code}\n' https://<host>/api/acm/auth/me   # 401
```

## 4. First Admin (최초 관리자)

`500`(테넌트 관리자 `admin@tpi.co.kr`)·`511`(시스템 관리자 `admin@amoeba.group`) 시드 비밀번호는 저장소에 공개돼 있다.
그래서 (REQ-261017B):

- 운영 모드(`NODE_ENV=production`, staging·production 컨테이너)에서는 공개 시드 비밀번호 로그인이 **거부**된다(`SEED_PASSWORD_DISABLED`).
- 백엔드는 기동할 때 `ACM_INITIAL_ADMIN_PASSWORD` 가 있으면 공개 시드 비밀번호를 쓰는 계정을 모두 그 값으로 바꾸고,
  첫 로그인 때 새 비밀번호로 바꾸게 한다. 로그: `public seed password replaced … for N account(s)`.

절차:

1. 배포 전 env 파일에 `ACM_INITIAL_ADMIN_PASSWORD` 를 넣는다(비밀번호 관리 도구로 생성, 채팅·티켓에 붙이지 않는다).
2. 배포 → backend 로그에서 `replaced … for 2 account(s)` 확인.
3. `/admin/login` 에서 `admin@tpi.co.kr` 로 로그인 → 강제 변경 화면에서 각자 비밀번호로 변경. 시스템 관리자도 같은 방식.
4. env 파일에서 `ACM_INITIAL_ADMIN_PASSWORD` 를 지우고 backend 를 다시 띄운다(이미 바뀐 계정에는 다시 적용되지 않는다).
5. 메일 설정(`/admin/config/mail`)을 해 두면 비밀번호 찾기·임시 비밀번호가 메일로 나간다.
   미설정이면 임시 비밀번호가 관리자 화면에 한 번만 표시된다.
6. 사용자·교사·직원을 만든다. 비밀번호를 잊은 사용자는 로그인 화면 "비밀번호를 잊으셨나요?" →
   관리자 `/admin/password-requests` 에서 [임시 비밀번호 발급](24시간 유효, 로그인 후 변경 필수).

> env 없이 배포했다면 로그에 `still use a public seed password` 경고가 남고 관리자 로그인이 막힌다.
> env 를 넣고 backend 만 다시 띄우면 된다(`DEPLOY_SHA` 포함).
> 로컬(개발 모드)은 시드 비밀번호로 로그인되지만 첫 로그인 때 변경을 강제한다.

## 5. Local (로컬)

```bash
docker compose rm -sfv postgres                  # 컨테이너 제거
docker volume rm "$(basename "$PWD")_acm-pg-data" # 로컬 DB 볼륨 삭제(로컬 데이터가 모두 지워진다)
docker compose up -d postgres                    # docker/local/initdb-acm.sh 가 같은 순서로 전체 적용
```

## 6. Troubleshooting (문제 해결)

| 증상 | 원인·조치 |
| --- | --- |
| `relation … does not exist` 로 특정 파일 FAIL | 더 큰 번호 파일에 의존. 번호 조정 또는 `DEFERRED` 추가 후 CI fresh-install 통과 확인 |
| 모든 파일이 `[skip]` 인데 테이블 없음 | 다른 환경의 `_applied` 마커를 복사함. 마커 디렉터리를 비우고 재실행 |
| backend 502 | `DEPLOY_SHA` 누락으로 구 이미지 기동 — env 확인 후 재배포 |
| 관리자 로그인 "기본(시드) 비밀번호는 운영 환경에서 사용할 수 없습니다" | `ACM_INITIAL_ADMIN_PASSWORD` 설정 후 backend 재기동(4장) |
