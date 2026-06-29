---
document_id: SETUP-260629-minio-attachment-store
version: 1.0.0
status: active
created: 2026-06-29
product_code: ACM
title: MinIO 첨부 저장소 운영자 셋업 (T-06 / ADR-008)
related:
  - docs/design/adr/ADR-008-attachment-storage.md
  - docker/staging/docker-compose.staging.yml
  - docker/production/docker-compose.production.yml
---

# SETUP-260629 — MinIO 첨부 저장소 운영자 셋업

> REQ-260626 T-06 / ADR-008 에 따라 CSL 모듈의 성적표/수업자료 업로드 백엔드로 **MinIO** (S3-호환 self-hosted) 를 채택. 이 문서는 운영자가 staging + production 호스트에서 한 번만 수행할 셋업 절차다.

---

## 1. Pre-flight check

- 호스트에 `docker compose` 사용 가능 (이미 TAC 서비스 실행 중).
- 호스트 디스크 여유: 예상 ~1GB 이내 (Trinity 1개 테넌트 기준, inquiry × 첨부 10 × 10MB = 100MB / inquiry).
- 본 작업으로 노출되는 추가 포트는 **없음** — MinIO 는 `127.0.0.1:9000/9001` 만 바인딩되며 backend container 가 docker network 로 접근.

---

## 2. 호스트 `.env` 파일에 secrets 추가

TAC 배포는 GH Actions secrets 가 아니라 **호스트의 `.env.*` 파일**에서 env 를 주입한다 ([DEPLOY-SECRETS-SETUP.md §4](DEPLOY-SECRETS-SETUP.md) 참조).

### Staging (acm-stg)

```bash
ssh appacademy@acm-stg
cd ~/app-academy/docker/staging
# 기존 .env.staging 끝에 다음 두 줄 추가
ACM_S3_ROOT_USER=$(openssl rand -hex 16)
ACM_S3_ROOT_PASSWORD=$(openssl rand -hex 32)

cat >> .env.staging <<EOF

# REQ-260626 T-06 / ADR-008 — MinIO root credentials.
# Backend SDK reuses these as ACM_S3_ACCESS_KEY_ID / SECRET_ACCESS_KEY.
ACM_S3_ROOT_USER=${ACM_S3_ROOT_USER}
ACM_S3_ROOT_PASSWORD=${ACM_S3_ROOT_PASSWORD}
EOF

# bucket 이름을 기본값(`acm-attachments`) 이외로 쓰려면 한 줄 더:
# echo "ACM_S3_BUCKET=tac-acm-attachments" >> .env.staging
```

### Production (acm)

```bash
ssh appacademy@acm
cd ~/app-academy/docker/production
# 동일 절차 — 다른 랜덤 값으로
ACM_S3_ROOT_USER=$(openssl rand -hex 16)
ACM_S3_ROOT_PASSWORD=$(openssl rand -hex 32)

cat >> .env.production <<EOF

# REQ-260626 T-06 / ADR-008 — MinIO root credentials.
ACM_S3_ROOT_USER=${ACM_S3_ROOT_USER}
ACM_S3_ROOT_PASSWORD=${ACM_S3_ROOT_PASSWORD}
EOF
```

> 추가 변수 (기본값으로 충분, 변경 시만 명시):
> - `ACM_S3_BUCKET` (기본 `acm-attachments`)
> - `ACM_S3_ENDPOINT` (기본 `http://minio:9000` — compose 내부)
> - `ACM_S3_REGION` (기본 `us-east-1`)
> - `ACM_S3_FORCE_PATH_STYLE` (기본 `true`)

GH Actions secrets 는 **건드릴 필요 없음**.

---

## 3. 호스트에서 첫 부팅

본 PR 머지 + cd-staging 통과 시점부터 `docker compose up -d minio minio-init` 가 자동 실행되어:

1. `minio` 서비스가 `9000`(API) + `9001`(console) 에서 listen
2. `minio-init` 컨테이너가 1회 실행되어 `mc alias set` + `mc mb acm-attachments` 수행 (이미 존재하면 `|| true` 로 무시)
3. backend 가 `ACM_S3_*` env 로 SDK 부팅. 로그에 `ObjectStoreClient ready (endpoint=http://minio:9000, bucket=acm-attachments, forcePathStyle=true)` 가 보여야 함.

검증:
```bash
ssh appacademy@acm-stg
docker compose -f docker/staging/docker-compose.staging.yml ps minio
# → tac-minio Up healthy
docker compose -f docker/staging/docker-compose.staging.yml logs minio-init --tail 20
# → "Bucket created successfully `tac/acm-attachments`."
docker compose -f docker/staging/docker-compose.staging.yml logs backend --tail 50 | grep ObjectStoreClient
# → ObjectStoreClient ready ...
```

---

## 4. 콘솔 접근 (옵션)

MinIO 콘솔은 호스트의 `127.0.0.1:9001` 에 묶여 있어 SSH 터널로만 접근 가능:

```bash
ssh -L 9001:localhost:9001 appacademy@acm-stg
# → browse http://localhost:9001
# → Login: ACM_S3_ROOT_USER / ACM_S3_ROOT_PASSWORD
```

콘솔에서 bucket / object 직접 확인 가능. 일반 운영에는 불필요하지만 디버깅 시 유용.

---

## 5. 백업

`/data/minio/` 디렉토리만 정기 백업 대상:

```bash
# 호스트 cron 예시 (이미 PG 백업 옆에 두면 됨)
tar czf /var/backups/app-academy/staging/minio-$(date +%F).tar.gz \
        /var/lib/docker/volumes/.../minio/
```

복구: tar 풀고 `docker compose restart minio`.

---

## 6. 운영 한계 + 향후

- 본 셋업은 **단일 호스트, 단일 노드** MinIO. HA 필요 시 distributed MinIO (4 호스트 minimum) 또는 클라우드 S3/R2 로 마이그.
- 클라우드 마이그 시:
  - `ACM_S3_ENDPOINT` 를 비우거나 AWS endpoint 로 변경
  - `ACM_S3_REGION` 정확한 region 설정
  - `ACM_S3_FORCE_PATH_STYLE` 을 `false`
  - 기존 객체 마이그: `mc mirror tac/acm-attachments s3/<aws-bucket>`
  - **코드 변경 0** (AWS SDK 그대로)

---

## 7. 트러블슈팅

| 증상 | 원인 | 조치 |
|---|---|---|
| backend log: `OBJECT_STORE_NOT_CONFIGURED` 503 | `ACM_S3_*` env 누락 | secrets + workflow env 확인, backend 컨테이너 재시작 |
| Browser PUT 시 403 | presigned URL 만료 (5분) 또는 Content-Type mismatch | 다시 시도. `Content-Type` 헤더가 서버에서 발급한 값과 동일해야 함 |
| `mc mb` 시 `Access Denied` | root user/password 가 backend env 와 다름 | `ACM_S3_ROOT_*` 와 `ACM_S3_ACCESS_KEY_ID/SECRET_ACCESS_KEY` 가 동일 값인지 확인 (현 셋업은 root 동일 사용) |
| 호스트 디스크 부족 | 백업 미설정 + 첨부 누적 | `/data/minio` 사용량 모니터링, lifecycle 정책 추가 검토 (lifecycle: 90일 후 자동 삭제 등) |
