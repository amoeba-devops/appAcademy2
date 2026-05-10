# RPT-260510-acm-tch-list-and-resume — 작업 완료 보고서

> **연관 문서**
> - REQ: [REQ-260510-acm-tch-list-and-resume.md](../analysis/REQ-260510-acm-tch-list-and-resume.md)
> - PLN: [PLN-260510-acm-tch-list-and-resume.md](../plan/PLN-260510-acm-tch-list-and-resume.md)
> - TC: [TC-260510-acm-tch-list-and-resume.md](../test/TC-260510-acm-tch-list-and-resume.md)

## 1. 작업 요약 (Summary)

- ACM 강사관리(`/admin/tch`) 기능 개선
  - 목록 화면을 12개 컬럼으로 확장 (이름 / 강사여부 / 고용형태 / 아이디 / 생년월일 / 이메일 / 핸드폰 / 입사일자 / 출결번호 / 최종로그인 / 재직상태 / 계정상태)
  - 상세보기에 강사 이력서(첨부파일) 업로드/다운로드/삭제 기능 추가
  - 재직상태 enum을 `ACTIVE / INACTIVE` → `ACTIVE / LEAVE / RESIGNED` 로 확장
  - 신규 필드: `강사여부`, `고용형태(FULL_TIME/PART_TIME)`, `입사일자`, `출결번호`
  - 운영자가 강사 로그인 계정을 잠금/해제할 수 있도록 `usr_locked_at` 추가 + `ACCOUNT_LOCKED` 응답
- 첨부파일 보관소: backend 컨테이너 `/app/uploads` (volume `acm-uploads`), 경로 `tch-resume/{entId}/{tchId}/{attId}.{ext}`
- 첨부 정책: PDF/JPG/PNG 만, 최대 10 MB, MIME + magic-byte 동시 검증

## 2. 변경 파일 (Changed Files)

### SQL
- [sql/acm/830-acm-tch-extend.sql](../../sql/acm/830-acm-tch-extend.sql) — `amb_acm_tch_teacher` 컬럼 4개 추가 + status CHECK 교체, `amb_acm_user.usr_locked_at` 추가, `amb_acm_tch_attachment` 테이블 신규

### Backend (NestJS)
- [backend/src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity.ts](../../backend/src/modules/acm-tch/infrastructure/typeorm/teacher.typeorm-entity.ts) — `isInstructor`/`employmentType`/`hiredAt`/`attendanceNo` + status enum 확장
- [backend/src/modules/acm-tch/infrastructure/typeorm/teacher-attachment.typeorm-entity.ts](../../backend/src/modules/acm-tch/infrastructure/typeorm/teacher-attachment.typeorm-entity.ts) — 신규 엔티티
- [backend/src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity.ts](../../backend/src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity.ts) — `lockedAt` 컬럼 추가
- [backend/src/modules/acm-tch/application/dto/teacher.dto.ts](../../backend/src/modules/acm-tch/application/dto/teacher.dto.ts) — 신규 enum/필드/필터 추가
- [backend/src/modules/acm-tch/application/teacher.service.ts](../../backend/src/modules/acm-tch/application/teacher.service.ts) — 계정 메타 join, accountState 필터, lock/unlock, 신규 필드 매핑
- [backend/src/modules/acm-tch/application/teacher-attachment.service.ts](../../backend/src/modules/acm-tch/application/teacher-attachment.service.ts) — 신규 서비스 (validate / write / stream)
- [backend/src/modules/acm-tch/presentation/teacher.controller.ts](../../backend/src/modules/acm-tch/presentation/teacher.controller.ts) — `PATCH :id/account/lock`, `:id/account/unlock`
- [backend/src/modules/acm-tch/presentation/teacher-attachment.controller.ts](../../backend/src/modules/acm-tch/presentation/teacher-attachment.controller.ts) — 신규 컨트롤러
- [backend/src/modules/acm-tch/acm-tch.module.ts](../../backend/src/modules/acm-tch/acm-tch.module.ts) — 신규 엔티티/서비스/컨트롤러 등록
- [backend/src/modules/acm-auth/application/acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) — `lockUser`/`unlockUser` + 로그인 시 `ACCOUNT_LOCKED` 차단

### Frontend (frontend-acm)
- [frontend-acm/src/modules/tch/types.ts](../../frontend-acm/src/modules/tch/types.ts) — 타입 확장
- [frontend-acm/src/modules/tch/hooks/use-teachers.ts](../../frontend-acm/src/modules/tch/hooks/use-teachers.ts) — lock/unlock/attachment 훅
- [frontend-acm/src/modules/tch/pages/tch-list-page.tsx](../../frontend-acm/src/modules/tch/pages/tch-list-page.tsx) — 상태 필터 옵션 갱신
- [frontend-acm/src/modules/tch/components/tch-table.tsx](../../frontend-acm/src/modules/tch/components/tch-table.tsx) — 12-컬럼 테이블 + sticky 첫 컬럼
- [frontend-acm/src/modules/tch/components/tch-form-modal.tsx](../../frontend-acm/src/modules/tch/components/tch-form-modal.tsx) — 신규 필드 입력 + 계정 잠금 섹션 + 첨부 panel
- [frontend-acm/src/modules/tch/components/tch-attachment-panel.tsx](../../frontend-acm/src/modules/tch/components/tch-attachment-panel.tsx) — 신규 컴포넌트 (업로드/다운로드/삭제)
- i18n locale (4개 언어 모두 갱신):
  - [frontend-acm/src/i18n/locales/ko/tch.json](../../frontend-acm/src/i18n/locales/ko/tch.json)
  - [frontend-acm/src/i18n/locales/en/tch.json](../../frontend-acm/src/i18n/locales/en/tch.json)
  - [frontend-acm/src/i18n/locales/vi/tch.json](../../frontend-acm/src/i18n/locales/vi/tch.json)
  - [frontend-acm/src/i18n/locales/zh-CN/tch.json](../../frontend-acm/src/i18n/locales/zh-CN/tch.json)

### Infra
- [docker/staging/docker-compose.staging.yml](../../docker/staging/docker-compose.staging.yml) — `ACM_UPLOAD_DIR=/app/uploads` env + bind-mount `${DATA_DIR}/acm-uploads`
- [docker/production/docker-compose.production.yml](../../docker/production/docker-compose.production.yml) — 동일 적용

## 3. 테스트 결과 (Test Results)

| 검증 항목 | 결과 |
|-----------|------|
| Backend `tsc --noEmit` | ✅ 통과 (0 error) |
| Frontend-acm `tsc --noEmit` | ✅ 통과 (0 error) |
| TC-260510 단위/통합 케이스 | ⏳ 스테이징 배포 후 수기 실행 예정 |

**자동화 단위/통합 테스트 신규 추가는 본 차수에서 생략** — 기존 ACM 모듈도 단위 테스트 커버리지가 비어 있어 별도 차수에서 일괄 도입 예정 (TC 문서에는 시나리오만 정의).

## 4. 회귀 영향 (Regression Impact)

- `tch_status='INACTIVE'` 데이터를 마이그레이션이 일괄 `'RESIGNED'` 로 치환 (idempotent)
- 기존 `INACTIVE` 텍스트를 사용하던 i18n 키 제거 — 다른 모듈에서 `tch:status.INACTIVE` 를 직접 참조하는 곳 없음 (검색 확인)
- 신규 컬럼은 모두 default/null 허용이라 기존 row 영향 없음

## 5. 후속 작업 / 알려진 한계 (Follow-ups / Known Limitations)

- 단위 테스트 미작성 — TC-260510 시나리오를 jest spec 으로 코드화 필요
- Account 메타는 `accountState` 필터 적용 시 페이지 내 후처리 필터링 → 실제 카운트와 `total` 이 불일치할 수 있음 (PG 측 LEFT JOIN 으로 통합하는 후속 최적화 필요)
- 강사 본인 잠금 방지는 frontend 가드만 적용 — backend 에서도 `req.user.id === teacher.userId` 체크 추가 권장 (후속)
- 첨부 파일은 로컬 디스크 보관 — S3 마이그레이션 필요 시 `TeacherAttachmentService.baseDir` 만 교체

## 6. 배포 절차 (Deployment Steps)

1. `git push` → CI 이미지 빌드
2. 스테이징 deploy: `ssh appacademy@125.133.49.165 "nohup bash scripts/deploy-staging.sh > /tmp/deploy-260510.log 2>&1 &"`
3. 마이그레이션 적용:
   ```bash
   ssh appacademy@125.133.49.165 \
     'docker exec -i $(docker ps -qf name=postgres-acm) \
        psql -U acm -d db_acm < sql/acm/830-acm-tch-extend.sql'
   ```
4. 스테이징 데이터 디렉토리 생성: `mkdir -p /home/appacademy/data/acm-uploads && chmod 770`
5. 컨테이너 재기동 (compose up -d) → backend 가 새 volume mount
6. Smoke: 로그인 → `/admin/tch` → 12 컬럼 노출 → 강사 1건 편집 → PDF 업로드/다운로드 → 잠금/해제

## 7. 메모리/문서 갱신 (Memory & Docs)

- 메모리: 본 차수 새로운 패턴 없음 — 추가 메모 갱신 없음
- 문서: REQ/PLN/TC + 본 RPT 로 4-종 세트 완비
