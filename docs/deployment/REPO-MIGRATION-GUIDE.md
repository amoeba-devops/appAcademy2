---
document_id: TAC-REPO-MIGRATION-GUIDE-1.0.0
version: 1.0.0
status: Active
created: 2026-04-28
author: Gray Kim
change_log:
  - version: 1.0.0
    date: 2026-04-28
    author: Gray Kim
    description: |
      Repository migration guide — KimIgyong/app-academy → amoeba-devops/appAcademy2.
      Documents the canonical remote, GHCR namespace cutover, local/staging/CI
      configuration, and rollback procedure.
---

# Repository Migration Guide (저장소 이관 가이드)

## 0. Decision Record (결정 기록)

| Item | Old (legacy) | **New (canonical)** |
|------|--------------|---------------------|
| Git remote | `https://github.com/KimIgyong/app-academy.git` | **`https://github.com/amoeba-devops/appAcademy2.git`** |
| GHCR namespace | `ghcr.io/kimigyong/app-academy/` | **`ghcr.io/amoeba-devops/appacademy2/`** (lowercase per GHCR policy) |
| Cutover commit | — | `fd5419f` (Phase B), `92028be` (CD trigger) |
| Cutover date | — | **2026-04-28** |
| Owner | Personal account | `amoeba-devops` org |

**구 repo 처리**: 그대로 유지 (archive/private 전환 없음). 본 가이드 §6 fallback 용으로 보존.

> 본 문서 발행 이후 모든 신규 작업·PR·이슈는 신규 repo 기준이며, 구 repo는 read-only reference 취급.

---

## 1. Local Developer Setup (로컬 개발 환경)

### 1.1 신규 클론 (새로 시작하는 경우)

```bash
git clone https://github.com/amoeba-devops/appAcademy2.git
cd appAcademy2
# 또는 디렉터리명 유지:
# git clone https://github.com/amoeba-devops/appAcademy2.git app-academy
```

### 1.2 기존 클론 마이그레이션 (현 디렉터리 유지)

> 현재 워킹트리(`/Users/gray/Documents/Claude/Projects/app-academy/`)는 이 절차로 이미 마이그레이션 완료되어 있다. 신규 멤버가 기존 클론을 살릴 때만 실행.

```bash
cd app-academy/

# 1) 작업 중 변경사항 백업
git status
git stash push -m "pre-migration-backup-$(date +%F)"  # (있으면)

# 2) origin 신규 repo로 전환
git remote set-url origin https://github.com/amoeba-devops/appAcademy2.git
git remote -v   # → origin = appAcademy2

# 3) (선택) 구 repo를 legacy remote로 백업
git remote add legacy https://github.com/KimIgyong/app-academy.git
git config remote.legacy.skipDefaultUpdate true   # `git fetch --all`에서 자동 fetch 제외
git fetch legacy

# 4) 신규 origin과 동기화
git fetch origin
git checkout main
git reset --hard origin/main

# 5) (옵션) 백업한 작업분 복원
git stash pop
```

### 1.3 Verifying

```bash
git remote -v
# origin   https://github.com/amoeba-devops/appAcademy2.git (fetch)
# origin   https://github.com/amoeba-devops/appAcademy2.git (push)
# legacy   https://github.com/KimIgyong/app-academy.git (fetch)   ← 백업, 자동 fetch 제외
# legacy   https://github.com/KimIgyong/app-academy.git (push)

git rev-list --left-right --count legacy/main...origin/main
# 0  N    ← N = 마이그레이션 후 신규 repo에만 추가된 커밋 수
```

### 1.4 로컬 dev 서버 기동

저장소 이관과 무관하게 [CLAUDE.md §4.7 로컬 포트 규칙](../../CLAUDE.md) 준수.
- Frontend: http://localhost:**3009**
- Backend: http://localhost:**4009**/api

```bash
npm run dev   # frontend(3009) + backend(4009) 동시 기동
```

---

## 2. CI/CD Configuration (신규 repo Settings)

신규 repo `amoeba-devops/appAcademy2`에서 다음을 1회만 설정한다.

### 2.1 Workflow Permissions
**Settings → Actions → General → Workflow permissions**
- ☑ **Read and write permissions** (GHCR push 권한 자동 부여)

### 2.2 Environments
**Settings → Environments → New environment**
- Name: `staging`
  - URL: `https://app-academy-stg.amoeba.site` (또는 임시 `https://tpi.amoeba.site`)
  - Protection rules (선택): reviewers, deployment branches=main 등
- Name: `production` (production 컷오버 시 추가)

### 2.3 Secrets (Repository secrets)
**Settings → Secrets and variables → Actions → New repository secret**

| Name | Value | 비고 |
|------|-------|------|
| `STAGING_SSH_HOST` | `125.133.49.165` | (또는 호스트명) |
| `STAGING_SSH_USER` | `appacademy` | deploy-staging.sh 소유자 |
| `STAGING_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----`<br>...<br>`-----END OPENSSH PRIVATE KEY-----`<br>(끝줄에 줄바꿈 1개) | OpenSSH 형식. 호스트의 `authorized_keys`에 짝 public key 등록 필요 |
| `STAGING_SSH_PORT` | `22` | 기본 22면 생략 가능 (workflow에 fallback 22) |

> ⚠️ `STAGING_SSH_KEY`는 90% 실패 원인이 **마지막 줄 줄바꿈 누락** 또는 RSA `.pem` 형식. OpenSSH 형식 + 끝 줄바꿈 필수.

### 2.4 Deploy keys
**Settings → Deploy keys → Add deploy key**

스테이징 호스트가 `git pull origin`할 때 사용할 read-only public key 등록.
- Title: `staging host (~/.ssh/github_deploy_tpi.pub)`
- Key: 호스트의 `cat ~/.ssh/github_deploy_tpi.pub` 출력
- ☐ Allow write access (체크 해제 — read-only)

### 2.5 Workflow 자기 검증

빈 commit으로 트리거 후 결과 확인:

```bash
git commit --allow-empty -m "chore(ci): smoke test"
git push
```

**Actions** 탭에서 다음 4 job이 모두 ✅ 되어야 정상:
- CI → 모든 job (Lint·Typecheck·Build·Docker·Trivy·Playwright)
- CD — Staging → build-push (×2) + deploy

> CI Lint 실패는 본 마이그레이션과 별개의 기존 코드 이슈일 수 있음.

---

## 3. Staging Host Cutover (스테이징 호스트 컷오버)

### 3.1 사전 점검

```bash
ssh appacademy@125.133.49.165
cd ~/app-academy
git remote -v   # 현재 origin 확인
ls docker/staging/.env.staging   # 시크릿 파일 존재 확인
```

### 3.2 origin URL 갱신

```bash
# (a) 백업 — 작업 중 변경사항이 있다면 stash
git status
git stash push -m "pre-repo-migration-$(date +%F)" 2>/dev/null || true

# (b) origin 신규 repo로 전환
git remote set-url origin git@github.com:amoeba-devops/appAcademy2.git
git remote -v
```

### 3.3 SSH/Deploy key 점검

호스트의 deploy key가 신규 repo에 등록돼있어야 git fetch 가능.

```bash
# 현재 사용 중인 deploy key 확인
ls ~/.ssh/github_deploy_*
cat ~/.ssh/github_deploy_tpi.pub   # 또는 사용 중인 key의 .pub
```

이 출력을 신규 repo §2.4 절차로 등록 (read-only).

```bash
# SSH config 점검 — Host alias가 github.com-deploy로 돼있을 수 있음
grep -A4 "Host github.com" ~/.ssh/config

# 연결 검증
ssh -T git@github.com-deploy 2>&1 | head -3
# Expected: "Hi amoeba-devops/appAcademy2! You've successfully authenticated..."
```

### 3.4 코드 동기화 + 첫 배포

```bash
# (a) 신규 origin에서 fetch
git fetch origin
git checkout main
git reset --hard origin/main
git log -1 --oneline   # → 92028be 또는 그 이후 commit

# (b) GHCR pull 인증 (private package인 경우)
#     .env.staging의 GHCR_PULL_TOKEN/USER가 amoeba-devops 권한 있어야 함
#     필요 시 docker login으로 사전 검증:
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

# (c) 첫 배포 — 신규 GHCR path에서 pull
DEPLOY_SHA=$(git rev-parse --short HEAD) scripts/deploy-staging.sh

# (d) GHCR pull 실패 시 fallback: 호스트에서 직접 빌드
DEPLOY_BUILD_LOCAL=1 DEPLOY_SHA=$(git rev-parse --short HEAD) scripts/deploy-staging.sh
```

### 3.5 검증

```bash
# 컨테이너 상태
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
# tac-backend, tac-frontend가 ghcr.io/amoeba-devops/appacademy2/... 이미지로 떠있어야 함

# Smoke test
curl -sIL --max-time 10 https://tpi.amoeba.site/ | head -3
curl -sS https://tpi.amoeba.site/api/health
```

---

## 4. GHCR Image Path (이미지 경로)

### 4.1 New canonical paths

```
ghcr.io/amoeba-devops/appacademy2/tac-backend:<short-sha>
ghcr.io/amoeba-devops/appacademy2/tac-backend:staging
ghcr.io/amoeba-devops/appacademy2/tac-backend:production

ghcr.io/amoeba-devops/appacademy2/tac-frontend:<short-sha>
ghcr.io/amoeba-devops/appacademy2/tac-frontend:staging
ghcr.io/amoeba-devops/appacademy2/tac-frontend:production
```

### 4.2 Old (deprecated)

```
ghcr.io/kimigyong/app-academy/tac-backend:*    ← 더 이상 빌드 안됨, 호스트에 잔존 가능
ghcr.io/kimigyong/app-academy/tac-frontend:*
```

호스트의 docker 캐시에 남은 구 이미지는 안전을 위해 시점 정한 후 정리:

```bash
docker images | grep "kimigyong"
docker rmi ghcr.io/kimigyong/app-academy/tac-backend:staging   # 등
```

> 주의: 컷오버 직후 1~2주는 보존 권장 (Phase 5 롤백 안전망)

---

## 5. CI/CD Trigger Reference

### 5.1 자동 트리거
- `git push origin main` → CI + CD-Staging 자동 실행
- production 푸시는 별도 환경/승인 게이트 (cd-production.yml)

### 5.2 수동 재실행
- Actions 탭 → 해당 워크플로우 선택 → **Run workflow** 또는 **Re-run failed jobs**
- Quick trigger:
  ```bash
  git commit --allow-empty -m "chore(ci): trigger"
  git push
  ```

---

## 6. Rollback / Emergency (롤백 절차)

신규 repo 마이그레이션 후 심각한 이슈 시:

### 6.1 호스트 측 즉시 롤백 (구 origin으로 복귀)

```bash
ssh appacademy@125.133.49.165
cd ~/app-academy
git remote set-url origin https://github.com/KimIgyong/app-academy.git   # 또는 SSH URL
git fetch origin
git reset --hard origin/main   # 구 repo의 마지막 안정 commit
DEPLOY_BUILD_LOCAL=1 scripts/deploy-staging.sh
# (구 GHCR 이미지 ghcr.io/kimigyong/... 도 fallback으로 사용 가능)
```

### 6.2 로컬 측 롤백

```bash
git remote set-url origin https://github.com/KimIgyong/app-academy.git
git fetch origin
git reset --hard origin/main
```

### 6.3 신규 repo 복구

문제 해결 후 다시 신규로 전환 — §1.2, §3.2 절차 반복.

---

## 7. 체크리스트 (Cutover Verification)

이관 작업 완료 시점에 다음을 모두 ✅ 확인:

- [ ] 로컬 `git remote -v` → origin = `amoeba-devops/appAcademy2`
- [ ] 로컬 `git remote -v` → legacy = `KimIgyong/app-academy` (백업)
- [ ] 신규 repo Settings → Secrets에 `STAGING_SSH_*` 4개 등록
- [ ] 신규 repo Settings → Workflow permissions = Read and write
- [ ] 신규 repo Settings → Environments에 `staging` 생성
- [ ] 신규 repo Settings → Deploy keys에 호스트 public key 등록
- [ ] 호스트의 origin = `amoeba-devops/appAcademy2`
- [ ] 호스트의 deploy key가 신규 repo에 등록 + SSH 연결 검증 통과
- [ ] CD-Staging 워크플로우 ✅ 통과 (build-push + deploy)
- [ ] `https://tpi.amoeba.site` 200 응답
- [ ] 컨테이너 이미지가 `ghcr.io/amoeba-devops/appacademy2/...` 인지 `docker ps` 확인
- [ ] CHANGELOG.md에 컷오버 commit 기록

---

## 8. 참고 commit / 문서

- `fd5419f` — Phase B: 코드 변경 (compose, scripts, README, CUTOVER doc)
- `92028be` — Phase C 트리거 (CD secrets 적용)
- 본 가이드 commit: 추후 추가
- 관련 문서:
  - [docs/deployment/staging.md](staging.md) — 호스트 운영 룰
  - [docs/deployment/CUTOVER.md](CUTOVER.md) — production 컷오버 절차
  - [scripts/staging-setup.sh](../../scripts/staging-setup.sh) — 호스트 1회 부트스트랩
  - [scripts/deploy-staging.sh](../../scripts/deploy-staging.sh) — 재배포 스크립트
  - [.github/workflows/cd-staging.yml](../../.github/workflows/cd-staging.yml)
