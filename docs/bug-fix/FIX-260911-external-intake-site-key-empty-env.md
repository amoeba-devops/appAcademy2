---
document_id: CSL-FIX-260911
version: 1.0.0
status: OPEN (fix on branch `fix/csl-intake-site-keys-prod-default`, not yet deployed)
date: 2026-09-11
related: docs/implementation/GUIDE-260903G-imweb-apply.md, docs/plan/PLN-260903G-external-intake-api.md, PR #193
---

# FIX-260911 — External intake returns 401 for every site key in production / 운영 외부접수 API 전건 401

## 1. Symptom (증상)

- TPI 아임웹 새 페이지 `/contact2` 에 스니펫을 게시하고 시크릿 창에서 제출 → 화면에 "접수 중 오류가 발생했습니다", 브라우저 콘솔에 `POST /api/web/external-intake 401`.
- curl 재현: 스니펫 키 `tpi-8c094fefd4fd2314` → `401 invalid site key`. dev 기본 키 `dev-intake-tpi` 도 401.

## 2. Root Cause (원인)

1. `docker/production/docker-compose.production.yml` 이 `ACM_INTAKE_SITE_KEYS: ${ACM_INTAKE_SITE_KEYS:-}` 로 값을 넘긴다. 호스트 `.env.production` 에 키가 없으면 컨테이너에는 **빈 문자열**이 들어간다.
2. `external-intake.config.ts` 의 `process.env.ACM_INTAKE_SITE_KEYS ?? DEFAULT_KEYS` 는 빈 문자열을 "설정됨"으로 취급 → 파싱 결과가 빈 Map → 모든 키 거부.
3. 별개로 `DEFAULT_KEYS` 가 dev 키(`dev-intake-*`)라서, env 가 설정돼 있지 않은 환경에서는 어차피 스니펫 키가 통하지 않는다 (GUIDE 2절 선행조건 2 가 운영에 반영되지 않은 상태).

부가 발견 (origin allowlist):
- TRINITY 사이트는 `trinityacademy.imweb.me` 가 아니라 연결 도메인 **`trinityacademy.kr`** 로 서비스 중 (imweb 내 사이트 목록 확인). 컨트롤러의 per-site origin 검사가 `https://trinityacademy.imweb.me` 만 허용 → 게시해도 403.
- `tpi.co.kr`, `trinityacademy.kr` 은 imweb 에서 HTTPS 강제 리다이렉트가 꺼져 있어 `http://` 로 진입한 방문자의 Origin 이 allowlist 에 없다. (`santacroce.co.kr` 은 https 강제 ON.)

## 3. Fix (수정)

`backend/src/modules/acm-csl/presentation/external-intake.config.ts`
- `DEFAULT_KEYS` 를 스니펫에 박힌 운영 키 3종으로 교체 (키는 비밀이 아닌 사이트 식별자 — 설계 주석 참조). `ACM_INTAKE_SITE_KEYS` 는 회전용 override 로 유지.
- 빈 `ACM_INTAKE_SITE_KEYS` 를 미설정으로 취급: `process.env.ACM_INTAKE_SITE_KEYS?.trim() || DEFAULT_KEYS`.
- TRINITY origins 에 `https://trinityacademy.kr`, `https://www.trinityacademy.kr` 및 http 변형 추가. TPI origins 에 http 변형 추가.

`external-intake.controller.spec.ts`
- 기본 키 상수를 운영 키로 변경, "빈 env → 기본 키 유효" 테스트 추가. 9/9 통과.

## 4. Verification plan (검증 계획 — 배포 후)

1. `curl -X POST https://acm.amoeba.site/api/web/external-intake -H 'x-acm-site-key: dev-intake-tpi' -H 'Origin: https://not-allowed.example' ...` → 401 유지 (dev 키 무효).
2. 같은 요청에 `tpi-8c094fefd4fd2314` + `Origin: https://not-allowed.example` → **403** (키 인정, origin 차단; 행 생성 없음).
3. 시크릿 창에서 `https://www.tpi.co.kr/contact2` 실제 제출 → "접수되었습니다" → ACM 콘솔 `[외부 웹 (TPI)]` 행 확인 후 상담종료.

## 5. Alternative without deploy (배포 없이 우회)

운영 호스트 `docker/production/.env.production` 에 아래를 추가하고 backend 컨테이너 재기동:
```
ACM_INTAKE_SITE_KEYS=TPI:tpi-8c094fefd4fd2314,TRINITY:trinity-51c0c40bd70ba964,SANTACROCE:santacroce-93d05af5a571f33a
```
단, TRINITY 의 `trinityacademy.kr` origin 은 env 로 해결되지 않는다 (`ACM_INTAKE_ORIGINS` 는 CORS 헤더만 확장하고 per-site 검사는 코드 상수). 코드 배포가 필요하다.
