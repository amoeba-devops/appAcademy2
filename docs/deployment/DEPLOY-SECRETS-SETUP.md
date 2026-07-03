# Deploy Secrets & Environment Setup Guide (배포 시크릿·환경 구성 가이드)

> **2026-07-04 아카이브 안내**: 일부 호스트/서비스 설명은 MySQL legacy 및 과거 vhost 구성을 전제로 작성되었다. 현재 배포는 PostgreSQL-only 기준이며, 최신 런타임/구성은 현재 compose 파일과 deploy script를 우선 참조한다.

> **목적**: CD 파이프라인의 `Deploy to Staging` / `Deploy to Production` step이
> `error: missing server host` 로 실패하는 문제를 해결한다. 원인은 GitHub
> Environment 에 SSH 시크릿이 미설정 + `production` 환경의 reviewer 승인 게이트
> 미구성이다. ([project-deploy-known-issues] §1)
>
> **대상**: repo **admin** 권한 보유자 (Secrets/Environments 설정 권한 필요).
> **소요**: 20–30분. **한 번만** 하면 이후 배포는 `gh workflow run` 으로 동작.
> **작성**: 2026-06-09 / 관련: [RUNBOOK.md](RUNBOOK.md), [reference-deploy-workflow]

---

## 0. 워크플로가 참조하는 정확한 이름 (변경 금지 기준)

CD 워크플로 정의에서 그대로 추출한 값이다. 시크릿 이름·환경 이름이 **정확히** 일치해야 한다.

| 환경 | GH Environment | SSH 시크릿 (정확한 이름) | deploy step 위치 |
|------|----------------|--------------------------|------------------|
| Staging | `staging` | `STAGING_SSH_HOST`, `STAGING_SSH_USER`, `STAGING_SSH_KEY`, `STAGING_SSH_PORT`(옵션, 기본 22) | [cd-staging.yml](../../.github/workflows/cd-staging.yml) `deploy` |
| Production | `production` | `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_KEY`, `PRODUCTION_SSH_PORT`(옵션, 기본 22) | [cd-production.yml](../../.github/workflows/cd-production.yml) `deploy` |

> ⚠️ **이름 주의**: 프로덕션 prefix 는 `PROD_` 가 아니라 **`PRODUCTION_`** 이다.
> 시크릿은 repo 전역이 아니라 **해당 Environment 스코프**로 넣어야 한다 (deploy job 이
> `environment: name: staging|production` 안에서 실행되므로 environment secret 이 정석이고,
> reviewer 게이트와 한 곳에서 관리된다).

**이 앱(ACM)의 정확한 호스트** — `deploy-*.sh` 가 실제로 설치·reload·smoke 하는 vhost 기준:

| 환경 | 앱(ACM) 호스트 = **canonical** | 컨테이너 | 비고 |
|------|-------------------------------|----------|------|
| Production | **`acm.amoeba.site`** | frontend-acm SPA `:5174` | `acm.amoeba.site/admin/login` 등 실제 진입점 |
| Staging | **`acm-stg.amoeba.site`** | frontend-acm SPA | 유일한 staging 진입점 |

> ⚠️ **`app-academy.amoeba.site`(production) 는 앱 호스트가 아니다** — 레거시 Next.js 스택(`:3000`)용
> vhost 로, 2026-06-04 compose 에서 frontend 서비스가 제거되어 **사실상 죽은 호스트**다.
> `deploy-production.sh` 는 이 vhost 를 설치하지 않는다. → cd-production smoke 도 `acm.amoeba.site` 로 정정함.
> staging 의 `app-academy-stg.amoeba.site` 도 2026-07-04 retire 되었고, 현재 staging smoke / review URL 은
> `acm-stg.amoeba.site` 만 사용한다.
>
> ⚠️ **`tpi.amoeba.site` 는 앱 호스트가 아니다** — 2026-06-08 staging 스택에서 vhost 제거됨
> ([deploy-staging.sh](../../scripts/deploy-staging.sh) L209 주석). cd-staging 의 stale `tpi` smoke step 은 제거함.

---

## 1. 배포용 SSH 키페어 생성 + 호스트 등록

각 호스트(staging/production)마다 **전용 deploy 키**를 권장한다 (사람 키 재사용 금지).

### 1.1 키 생성 (관리자 로컬에서)
```bash
# staging 용
ssh-keygen -t ed25519 -f ./tac-staging-deploy -N '' -C 'gha-deploy-staging'
# production 용
ssh-keygen -t ed25519 -f ./tac-production-deploy -N '' -C 'gha-deploy-production'
```
→ `tac-*-deploy`(개인키, 시크릿에 넣을 값), `tac-*-deploy.pub`(공개키, 호스트에 등록).

### 1.2 호스트에 공개키 등록
배포를 수행할 **호스트의 deploy 계정**(`STAGING_SSH_USER`/`PRODUCTION_SSH_USER` 가 될 계정)에서:
```bash
# 각 호스트에서 (또는 ssh-copy-id 로)
mkdir -p ~/.ssh && chmod 700 ~/.ssh
cat tac-staging-deploy.pub >> ~/.ssh/authorized_keys   # 해당 호스트의 user 로
chmod 600 ~/.ssh/authorized_keys
```

### 1.3 연결 검증 (시크릿 넣기 전에 직접 확인)
```bash
ssh -i ./tac-staging-deploy -p 22 <USER>@<STAGING_HOST> 'echo OK && docker compose version'
```
`OK` + docker compose v2 버전이 떠야 한다. 실패하면 시크릿을 넣어도 워크플로가 같은 이유로 실패한다.

---

## 2. GitHub Environment 시크릿 등록

> Environment 가 없으면 먼저 만든다: **Settings → Environments → New environment** 로 `staging`, `production` 생성.

### 옵션 A — `gh` CLI (권장, 빠름)
```bash
# staging
gh secret set STAGING_SSH_HOST  --env staging    --body '<staging-host-or-ip>'
gh secret set STAGING_SSH_USER  --env staging    --body '<staging-ssh-user>'
gh secret set STAGING_SSH_KEY   --env staging    < ./tac-staging-deploy        # 개인키 파일 전체
gh secret set STAGING_SSH_PORT  --env staging    --body '22'                   # 22 면 생략 가능

# production
gh secret set PRODUCTION_SSH_HOST --env production --body '<prod-host-or-ip>'
gh secret set PRODUCTION_SSH_USER --env production --body '<prod-ssh-user>'
gh secret set PRODUCTION_SSH_KEY  --env production < ./tac-production-deploy
gh secret set PRODUCTION_SSH_PORT --env production --body '22'
```
> `--env <name>` 이 핵심 — 빠지면 repo-level 로 들어가서 environment 게이트와 분리된다.
> repo 지정이 필요하면 `--repo amoeba-devops/appAcademy2` 추가.

### 옵션 B — 웹 UI
Settings → Environments → `staging`(또는 `production`) → **Environment secrets → Add secret**.
`STAGING_SSH_KEY`/`PRODUCTION_SSH_KEY` 값에는 개인키 **파일 내용 전체**
(`-----BEGIN OPENSSH PRIVATE KEY-----` ~ `-----END ...-----`, 마지막 개행 포함)를 붙여넣는다.

### 검증
```bash
gh secret list --env staging
gh secret list --env production
# HOST/USER/KEY(/PORT) 4종이 보여야 함
```

---

## 3. `production` 환경 — reviewer 승인 게이트 구성

프로덕션 배포는 사람이 승인해야만 deploy job 이 실행되도록 막는다. (현재 미구성이라
dispatch 시 승인 대기 없이 곧장 deploy 로 진입한다.)

### 옵션 A — 웹 UI (권장)
1. **Settings → Environments → `production`**
2. **Required reviewers** 체크 → 승인자(개인 또는 팀) 1–6명 추가
3. (선택) **Wait timer** — 배포 전 강제 지연(분). 없어도 됨.
4. (선택) **Deployment branches** → `Selected branches` → `main` 만 허용 (오배포 방지)
5. Save

### 옵션 B — REST API (`gh api`)
```bash
# reviewers 의 id 조회 (user 또는 team)
gh api users/<github-login> --jq '.id'                       # user id
gh api orgs/amoeba-devops/teams/<team-slug> --jq '.id'       # team id

# production 환경에 승인자 설정 (type: User | Team)
gh api -X PUT repos/amoeba-devops/appAcademy2/environments/production \
  -F "reviewers[][type]=User" -F "reviewers[][id]=<USER_ID>" \
  -F "deployment_branch_policy[protected_branches]=true" \
  -F "deployment_branch_policy[custom_branch_policies]=false"
```
> 검증: `gh api repos/amoeba-devops/appAcademy2/environments/production --jq '.protection_rules'`
> → `required_reviewers` 룰이 보여야 한다.

---

## 4. 원격 호스트 사전 조건 (deploy 스크립트가 기대하는 상태)

deploy step 은 SSH 접속 후 호스트의 스크립트를 실행한다 — 호스트가 아래를 갖춰야 한다.
([deploy-staging.sh](../../scripts/deploy-staging.sh), [deploy-production.sh](../../scripts/deploy-production.sh) 헤더 주석 기준)

| 항목 | staging | production |
|------|---------|-----------|
| repo 체크아웃 | `~/app-academy` (`.git` 존재, `main`) | 동일 |
| compose 파일 | `docker/staging/docker-compose.staging.yml` | `docker/production/docker-compose.production.yml` |
| env 파일 (커밋 금지) | `docker/staging/.env.staging` | `docker/production/.env.production` |
| 런타임 | docker + docker compose v2 + nginx | 동일 |
| GHCR pull | `.env` 의 `GHCR_PULL_USER`/`GHCR_PULL_TOKEN` (private 이미지 pull 용 PAT `read:packages`) | 동일 |
| 최초 셋업 | `scripts/staging-setup.sh` | 수동 (RUNBOOK 참조) |

- deploy 스크립트가 **`git reset --hard origin/main`** 후 **대기 중 SQL 마이그레이션을 자동 적용**한다
  (staging step4 / production step5 — MySQL `sql/` + Postgres `sql/acm/`). 즉 REQ-260609 의
  `sql/120-…`, `sql/acm/880-…` 도 첫 배포 때 자동 적용된다.
- production 은 deploy 전 **DB 백업이 mandatory**(`scripts/backup-db.sh`) — 실패 시 배포 중단.

### ⚠️ REQ-260609 전용 수동 후속 (마이그레이션 자동적용과 별개)
`sql/120` 백필은 **데모 테넌트(`acd_is_demo=1`)만** `VN3040` 으로 채운다. 실 TPI 테넌트 행은
배포 후 1회 수동 갱신해야 로그인 게이트가 통과한다:
```sql
-- prod MySQL (db_tac)
UPDATE tac_academies SET acd_ama_entity_code='VN3040'
 WHERE acd_ama_tenant_id = '<TPI_ENTITY_UUID>';
```
미설정 시 해당 테넌트는 `403 ENTITY_NOT_ALLOWED` 로 로그인 차단된다.

---

## 5. 적용 후 재배포 + 검증

### Staging (main push 시 자동, 또는 수동)
```bash
gh workflow run cd-staging.yml                 # 또는 main 에 push
gh run watch "$(gh run list --workflow=cd-staging.yml -L1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
기대: `Build & Push to GHCR` + `Deploy to Staging`(SSH·smoke) 모두 ✅.

### Production (수동 dispatch → reviewer 승인 → deploy)
```bash
gh workflow run cd-production.yml -f sha=<short-sha>     # 예: 09ae39f (CD-Staging 가 빌드한 SHA)
```
1. `Preflight (verify images)` 가 GHCR 이미지 존재 확인 → ✅
2. **deploy job 이 `Waiting` 상태로 멈춘다** (reviewer 승인 대기) ← 게이트 정상 동작 신호
3. 지정 reviewer 가 Actions UI 에서 **Review deployments → Approve** (이 직전에 §4 의 `VN3040` 백필 확인)
4. 승인 후 SSH deploy + smoke test 진행

### 헬스 체크
```bash
curl -sI https://acm.amoeba.site/ | head -1             # HTTP/2 200 기대 (production 앱 호스트)
curl -sI https://acm.amoeba.site/admin/login | head -1  # 로그인 진입점
```

---

## 6. 트러블슈팅

| 증상 | 원인 / 조치 |
|------|-------------|
| `error: missing server host` | `*_SSH_HOST` 가 비었거나 environment 스코프가 아님 → `gh secret list --env <env>` 확인 |
| `Permission denied (publickey)` | 공개키가 호스트 `authorized_keys` 에 없음 / 개인키 시크릿 값 깨짐(개행 누락) → §1.3 직접 ssh 재확인 |
| production 이 승인 없이 바로 deploy | reviewer 게이트 미구성 → §3 |
| `MISSING: ghcr.io/.../tac-backend:<sha>` (preflight) | 그 SHA 가 CD-Staging 으로 빌드되지 않음 → 먼저 staging 빌드된 SHA 사용 |
| GHCR pull 실패 → 로컬 빌드 fallback | 호스트 `.env` 의 `GHCR_PULL_TOKEN`(PAT `read:packages`) 누락/만료 |
| 배포 후 로그인 `403 ENTITY_NOT_ALLOWED` | 실 TPI 행 `acd_ama_entity_code` 미설정 → §4 백필 |

> 배포 절차 일반은 [RUNBOOK.md](RUNBOOK.md), 트리거 명령은 [reference-deploy-workflow] 메모 참조.
