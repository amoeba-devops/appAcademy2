---
document_id: ATTACHMENT-ADR-008
version: 1.0.0
status: Accepted
date: 2026-06-29
deciders: gray.kim@amoeba.group
related_question: T-06 (S3 transcript/material upload), RPT-260626 §5 잔여
supersedes: —
---

# ADR-008 — CSL Attachment 저장 백엔드 (Object Store Backend)

## 1. Context (배경)

REQ-260626 T-06 의 목표는 INTAKE 단계의 **성적표 멀티 업로드**(FR-CSL-105)와
TRIAL_CLASS 단계의 **수업자료 업로드**(FR-CSL-126), 그리고 (이미 구현된)
**결과 PDF 다운로드**(FR-CSL-116) 첨부 파일을 안전하게 보관·전송하는 것이다.

DB 측 골격은 이미 마련됨 (PR #59, sql/acm/985 §5):
- `amb_acm_csl_attachment` (id, ent_id, inq_id, category, ref_id, **s3_key**, filename, mime, size_bytes, visibility, uploaded_by, created/deleted_at)
- 정책: PDF/JPEG/PNG only, **≤10MB × 최대 10개/inq+category** (Q-CSL-106), `visibility ∈ {STAFF_ONLY, TEACHER_STUDENT}` (POL-CSL-203).

설계서(DSN-260626 §3.2)는 **AWS S3 + presigned POST/GET** 가정.
RPT-260626 v1.1 §5 는 T-06 의 차단 사유로 *"AWS credentials 운영자 설정 필요"* 를 명시.

본 ADR의 질문:

> **AWS 가입 없이 (= AWS S3 무사용) T-06 을 구현할 수 있는가? 어떤 백엔드를 쓰는 게 합당한가?**

## 2. Options (대안 비교)

### Option A — **MinIO (셀프호스트 S3-호환)** ⭐ 추천

- Apache 2.0 라이선스의 S3-호환 object store. 단일 바이너리 + Go.
- **코드는 그대로 AWS SDK** 사용 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`). `endpoint: 'http://minio:9000'` + `forcePathStyle: true` 한 줄 차이.
- presigned PUT/GET URL 동일 동작. 5분 TTL, 10MB cap 그대로 적용.
- docker-compose 에 1 서비스 추가 + 호스트 볼륨 1 개 마운트로 끝.

**운영자 작업 (1회, ~10분)**:
1. docker-compose.staging.yml + .production.yml 에 `minio` 서비스 추가 (이미지 `minio/minio`, 볼륨 `/data/minio:/data`, 포트 9000 internal).
2. 첫 부팅 후 `mc alias set` 으로 access key 1쌍 생성 → secrets 에 `ACM_S3_ACCESS_KEY_ID` / `ACM_S3_SECRET_ACCESS_KEY` 주입.
3. `mc mb tac/acm-attachments` (bucket 생성). 끝.

**장점**
- AWS 계정/카드 등록 불필요. 데이터가 호스트 안에 머무름 (개인정보 거버넌스 측면 ✓).
- 코드 = 미래 클라우드 S3 마이그 시 **endpoint 한 줄만 변경**.
- 백업은 `/data/minio` 볼륨 한 폴더만 rsync → 단일 PG dump 와 통합 가능.
- presigned URL 사용으로 백엔드가 파일 스트림을 거치지 않음 (CPU/메모리 부담 0).

**단점**
- 단일 노드 — HA 가 필요해지면 distributed MinIO (4 노드 minimum) 또는 클라우드 마이그.
- 운영자 입장에서 새로운 서비스(MinIO) 가 1개 추가됨 → 모니터링 대시보드에 추가 필요.

### Option B — 로컬 파일시스템 (가장 간단)

- 디스크에 그대로 저장: `/var/lib/acm-attachments/{ent_id}/{att_id}-{filename}`.
- Nest 의 `multer` 로 multipart receive → `fs.createWriteStream` 직접 저장.
- Download endpoint 는 `fs.createReadStream` + `Content-Disposition: attachment` 스트림 응답.
- presigned URL 개념 없음 — 모든 다운로드가 백엔드 경유 (JWT guard + visibility check 우선).

**운영자 작업**:
- docker volume `/data/acm-attachments:/var/lib/acm-attachments` 마운트만 하면 됨. 별도 서비스 0.

**장점**
- 의존성 0개. 가장 단순. 학습 곡선 0.
- 백업: 디스크 한 폴더만 tar.gz.

**단점**
- **멀티 replica 배포 불가** (NFS / shared volume 도입 시 가능하나 운영 부담 ↑).
- 모든 다운로드가 백엔드 메모리/CPU 통과 → 10MB 파일 동시 다운로드 시 백엔드 부하.
- presigned URL 없음 → 학부모/강사 포털에서 long-lived URL 발급 불가 (매번 백엔드 인증 거쳐야 함).
- 미래에 S3/MinIO 로 갈 때 **저장/다운로드 코드 전면 재작성** 필요.
- `s3_key` 컬럼 의미가 어색해짐 (실은 filesystem path).

### Option C — PostgreSQL `BYTEA`

- 첨부 본체를 DB 의 `BYTEA` 컬럼에 직접 저장.
- 다운로드는 백엔드가 row 를 SELECT 후 스트림.

**장점**
- pg_dump 한 번이 모든 데이터(메타+본체) 백업.
- 트랜잭션 일관성 보장 (메타 row 와 본체가 같은 commit).

**단점**
- **10MB × 10/inq × inquiry 수 = DB 본체가 빠르게 비대화**. 100 inq → 10GB BYTEA. PG 견디지만 dump/restore 시간·복제 대역폭이 선형 증가.
- TOAST 압축은 PDF/이미지에 효과 미미 (이미 압축됨).
- shared_buffers / WAL 도 영향.
- 학부모 포털 대용량 다운로드 시 PG 연결 점유.

**적합 케이스**: 1MB 이하 작은 파일이 주 (서명 이미지, 텍스트 분량) — 본 케이스(성적표 PDF 다수)와 안 맞음.

### Option D — Cloudflare R2 / Backblaze B2 (제3자 S3 호환, AWS 외)

- S3-호환 API, AWS 계정 불필요. R2 는 egress 무료.
- 코드 변경 = endpoint 1 줄.

**장점**
- 인프라 직접 운영 필요 없음.
- 비용: 데이터셋이 작아 사실상 free tier 안.

**단점**
- 외부 서비스 의존(또 하나의 계정/카드 필요).
- 데이터가 호스트 외부에 나감 → 학원법/개인정보 거버넌스 확인 필요.
- Trinity tenant 첫 도입 단계에서 굳이 외부 의존 추가는 보수적으로 회피.

## 3. Decision (결정)

**Option A — MinIO** 를 채택한다 (Proposed).

근거:
1. **운영자 작업 최소** — docker-compose service 1 개 + access key 1쌍 + bucket 1 개. 클라우드 가입 0.
2. **코드는 미래 그대로** — `@aws-sdk/client-s3` 사용. 나중에 AWS S3 / R2 로 가도 endpoint 1 줄 변경.
3. **presigned URL 그대로** — 학부모 포털·강사 포털에서 short-lived URL 발급 가능 → 백엔드 부하 분산.
4. **개인정보 거버넌스** — 데이터가 호스트 안에 머무름. NFR-CSL-103 파일 권한 분리(visibility) 도 그대로 적용.
5. **백업 단순** — `/data/minio` 한 폴더 + PG dump.

DSN-260626 §3 의 표현 "AWS S3 + presigned POST/GET" 은 **"S3 API 가 가능한 object store"** 로 일반화한다 (본 ADR 로 supersede).

## 4. Implementation Plan (구현 계획)

```
backend/src/modules/acm-csl/infrastructure/external/
  ├ object-store.client.ts    (S3Client + presigner 래퍼)
  └ object-store.module.ts    (forRoot: env-driven config)

backend/src/modules/acm-csl/application/
  ├ attachment.service.ts      (presigned URL 발급 + DB row CRUD + 권한 가드)
  └ attachment.audit.ts        (NFR-CSL-104 download audit)

backend/src/modules/acm-csl/presentation/inquiry.controller.ts
  + POST /:inqId/attachments/presigned-upload
  + POST /:inqId/attachments/:attId/confirm
  + GET  /:inqId/attachments
  + GET  /:inqId/attachments/:attId/download
  + DELETE /:inqId/attachments/:attId  (soft-delete, STAFF↑)

frontend-acm/src/modules/csl/components/
  + attachment-uploader.tsx    (drag-drop + 멀티 progress)
  + attachment-list.tsx        (visibility 기반 필터링)
  - map-test-panel.tsx의 TranscriptUploadStub 교체
  - trial-class-panel.tsx의 material upload placeholder 교체

infra/docker-compose.{staging,production}.yml
  + minio 서비스 (image: minio/minio, 9000 internal, /data 볼륨)

env (.env.example + secrets):
  + ACM_S3_ENDPOINT=http://minio:9000
  + ACM_S3_REGION=us-east-1            (placeholder, MinIO 무관)
  + ACM_S3_BUCKET=acm-attachments
  + ACM_S3_FORCE_PATH_STYLE=true
  + ACM_S3_ACCESS_KEY_ID=...
  + ACM_S3_SECRET_ACCESS_KEY=...
```

**작업 분량 추정**:
- BE: presigned URL 발급 endpoint + DB CRUD + visibility guard + audit row — ~1.5d
- FE: uploader + list 컴포넌트 + i18n 4 locale — ~0.5d
- Infra: docker-compose minio + secrets 주입 (운영자) — ~10분
- Test: unit (size/mime/count 가드) + 운영자 매트릭스 — 함께 0.5d

**총**: ~2.5 d (BE+FE), 운영자 10분.

## 5. Consequences (영향)

- **DSN-260626 §3.2 / RPT-260626 §5 supersede** — "AWS S3" 표현은 본 ADR 의 "S3 API 가능 object store" 로 일반화.
- `att_s3_key` 컬럼 이름은 그대로 유지 (의미는 "object key", MinIO/S3 공통).
- 미래 S3/R2 마이그 비용: endpoint 1 줄 + bucket 옮기기 (mc mirror / rclone). 코드 변경 0.

## 6. References

- docs/design/DSN-260626-acm-csl-pipeline-revision.md §3.2 (attachment 테이블)
- docs/implementation/RPT-260626-csl-pipeline-revision-rollout.md §5 (T-06 잔여)
- sql/acm/985-acm-csl-pipeline-revision.sql §5 (DDL)
- MinIO docs: https://min.io/docs/minio/container/
- `@aws-sdk/client-s3` v3 with custom endpoint
