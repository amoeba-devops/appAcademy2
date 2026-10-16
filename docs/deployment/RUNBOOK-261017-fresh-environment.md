---
document_id: APP-ACADEMY-RUNBOOK-261017-FRESH-ENV
version: 1.0.0
status: Active
created: 2026-10-17
audience: Ops / Maintainer
related: REQ-261017, PLN-261017, RUNBOOK-CURRENT
change_log:
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
   최소 `ACM_PG_*`, `ACM_JWT_SECRET`, `ACM_PII_KEY`(64 hex), `ACM_PUBLIC_URL`(예: `https://acm.example`), `DEPLOY_SHA`.
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

1. `500-acm-auth.sql` 시드 관리자(`admin@tpi.co.kr`)로 `/admin/login` 로그인.
   시드 비밀번호는 저장소에 공개된 값이므로 **즉시 바꾼다**: 마이페이지(`/admin/me`) → 비밀번호 변경.
2. 메일 설정(`/admin/config/mail`)을 먼저 해 두면 비밀번호 찾기·임시 비밀번호가 메일로 나간다.
   미설정이면 임시 비밀번호가 관리자 화면에 한 번만 표시된다.
3. 테넌트 설정 → 사용자·교사·직원을 만든다. 비밀번호를 잊은 사용자는 로그인 화면 "비밀번호를 잊으셨나요?" →
   관리자 `/admin/password-requests` 에서 [임시 비밀번호 발급](24시간 유효, 로그인 후 변경 필수).

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
