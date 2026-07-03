---
document_id: RPT-260704-staging-legacy-frontend-retirement
version: 1.0.0
status: Completed
created: 2026-07-04
audience: Ops / Maintainer / Dev
---

# Staging Legacy Frontend Retirement Report

## 1. Summary

2026-07-04 기준 staging 환경의 legacy Next.js frontend runtime `tac-frontend` 를 퇴역 처리했다. staging 의 유일한 공개 진입점은 `https://acm-stg.amoeba.site/` 로 단일화했다.

## 2. Findings Before Removal

- `tac-frontend` 는 compose 에서 이미 제거된 상태였고, 호스트에 orphan 컨테이너로만 남아 있었다.
- `app-academy-stg.amoeba.site` host nginx vhost 는 여전히 `127.0.0.1:3000` (`tac-frontend`) 로 프록시하고 있었다.
- public DNS 확인 결과:
  - `acm-stg.amoeba.site` → `125.133.49.165`
  - `app-academy-stg.amoeba.site` → public DNS 미해결

## 3. Actions

- removed staging container: `tac-frontend`
- removed host nginx vhost:
  - `/etc/nginx/sites-enabled/app-academy-stg.amoeba.site`
  - `/etc/nginx/sites-available/app-academy-stg.amoeba.site`
- updated staging defaults:
  - `FRONTEND_URL` → `https://acm-stg.amoeba.site`
  - `BACKEND_URL` → `https://acm-stg.amoeba.site`
- removed retired repo artifact: `docker/staging/nginx-app-academy.conf`
- updated deploy/runbook/appstore docs to use `acm-stg.amoeba.site`

## 4. Verification

- `https://acm-stg.amoeba.site/` returns `HTTP 200`
- `https://acm-stg.amoeba.site/api/health` → `success: true`
- `https://acm-stg.amoeba.site/api/portal/programs` → `success: true`
- active staging containers after cleanup:
  - `acm-frontend`
  - `tac-backend`
  - `tac-postgres-acm`
  - `tac-redis`
  - `tac-minio`
- absent legacy container:
  - `tac-frontend`

## 5. Result

staging runtime 관점에서 legacy frontend / legacy mysql 는 모두 제거되었다. 현재 staging app-academy ACM 스택은 PostgreSQL + `frontend-acm` 기준으로만 운영된다.
