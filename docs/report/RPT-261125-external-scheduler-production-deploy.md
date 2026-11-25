---
document_id: SCHEDULER-DEPLOY-RPT-1.0.0
version: 1.0.0
status: deployed
date: 2026-11-25
change_log:
  - 2026-11-25 v1.0.0 스테이징·프로덕션 배포 및 실제 HTTP·브라우저 검증 완료
---

# External Scheduler API Production Deployment (외부 스케줄 API 운영 배포)

## 1. Release (배포 결과)

- PR: [#450](https://github.com/amoeba-devops/appAcademy2/pull/450)
- Application merge SHA: `bfd59c80a713d56fc498c402944e4332e7fa3712`
- Staging: **2026-11-25 12:38:55 KST**, `bfd59c8`
- Production: **2026-11-25 12:45:52 KST**, `bfd59c8`
- [API 사용안내](https://acm.amoeba.site/admin/config/api): 서비스 설정의 신규 메뉴. 외부 API / 연동 안내 / API 사용 설정 제공.
- Base URL: `https://acm.amoeba.site/api/integrations/v1`

테넌트별 API 기본값은 OFF다. 기존 고객의 설정·키·수업은 변경하지 않았다. 테넌트 마스터가 API 사용 설정에서 필요한 API를 켜고 앱·키를 발급하면 사용할 수 있다.

## 2. Pipelines (파이프라인)

| Gate | Result |
| --- | --- |
| PR CI | [45540094926](https://github.com/amoeba-devops/appAcademy2/actions/runs/45540094926) success |
| Main CI | [45541210150](https://github.com/amoeba-devops/appAcademy2/actions/runs/45541210150) success |
| Staging CD | [45541210223](https://github.com/amoeba-devops/appAcademy2/actions/runs/45541210223) success |
| Production CD | [45542134508](https://github.com/amoeba-devops/appAcademy2/actions/runs/45542134508) success; smoke enabled |

프로덕션 환경 보호 규칙을 확인했고 추가 승인 게이트는 없었다. 스테이징에서 생성한 동일 SHA 이미지로 운영 배포했다. 이전 운영 버전은 `e4f943d`다.

## 3. Backup and Migration (백업·마이그레이션)

운영 서버 내부 백업:

```text
/backup/app-academy/production/db_acm-pre-scheduler-api-20261125T124434.dump
SHA-256: 41063e74531c51ccaab1b489cbbc8ee976b512c2e02b522fb4e625042265380c
8.8 MB; root owner; mode 600; pg_restore -l passed
```

`1072-external-scheduler-api.sql`의 스테이징·운영 소스 및 적용 마커 SHA-256:

```text
47ea73c792bd26e9c9869eabfc30f8f328b5e524ca652b672c5dbe471a3db252
```

신규 API 설정·클라이언트·키·수업 연결·멱등 응답·감사 테이블과 CAL 외부 출처/수업 방식/버전/공통 잠금이 적용됐다. 테넌트 API 설정은 명시적 활성화 전 OFF이며 기존 데이터는 소급 변경하지 않는다.

## 4. Deployed Verification (배포 후 검증)

스테이징과 운영에서 실제 배포된 HTTP API로 다음을 검증했다.

- 임의의 별도 검증 테넌트에서 기본 OFF → ON 저장 → 앱 생성 → API 키 1회 발급.
- 강사 목록 조회, 미등록 데모 학생 이름으로 대면 일정 등록·기간/단건 조회·수정·삭제.
- 동일 멱등 키 재시도 시 같은 결과, 겹치는 강사 일정은 409.
- 전체 OFF 즉시 403, 키 폐기 즉시 401, 카탈로그 5개 작업 및 OpenAPI 3.0.3 다운로드.
- 고객 테넌트 설정 변경 없음. 검증 당시 다른 활성 API 테넌트 수는 0.
- 임시 테넌트·계정·키·수업 등 업무 데이터 정리 완료. 기존 append-only 감사 기록은 보존.

첫 스테이징 검증의 업무 API는 모두 통과했으나 정리 도구가 감사 로그 삭제 방지 규칙에 걸렸다. 삭제 방지 규칙을 유지하면서 보호된 테이블을 제외하도록 검증 도구를 보완했고, 도구 소유 표식이 있는 임시 테넌트만 확인해 정리한 뒤 전체 검증을 다시 통과했다. 운영에서는 보완된 도구를 사용했다. 이 도구 보완은 배포된 애플리케이션 이미지 변경이 아니다.

운영 번들의 Playwright 검증은 **23개 그룹 통과**:

- API 사용안내 5개: 카탈로그/타입/예제/검색/복사/OpenAPI, 설정 저장·재접속/앱/키1회표시/폐기/중지, 권한 제한, 모바일, 오류 처리.
- 기존 포털 메뉴·공지사항·특이사항 숨김 등 9개.
- 강사 캘린더·타임존·퇴원생·업무 메뉴 순서/링크 등 9개.

브라우저 검증은 실제 배포 번들과 합성 API 데이터·신원을 사용했다. 실제 API 동작은 위의 별도 검증 테넌트에서 확인했다. 원문 키·JWT·고객 개인정보는 보고서나 스크린샷에 기록하지 않았다.

## 5. Health and Rollback (상태·되돌리기)

운영 백엔드·프론트엔드는 모두 `bfd59c8` 이미지로 running, restart count 0. Backend health HTTP 200. 배포 후 확인한 최근 백엔드 `QueryFailedError / UnhandledPromiseRejection / FATAL / ERROR` 표식 수는 0이다. `acm.amoeba.site`와 `acm-tpi.amoeba.site`에서 익명 외부 API 호출은 401, API 사용안내 SPA 경로는 200이다.

문제 발생 시 테넌트 API 또는 앱/키를 중지하고 이전 이미지 `e4f943d`로 복귀한다. additive schema·생성 수업·감사 자료는 즉시 삭제하지 않는다.

## 6. Deliverables (산출물)

- [요구사항](../analysis/REQ-261125-external-scheduler-api.md)
- [화면 구성·작업 계획](../plan/PLN-261125-external-scheduler-api.md)
- [API 사용 문서](../integration/external-scheduler-api.md)
- [구현·로컬 검증](RPT-261125-external-scheduler-api.md)
- 배포 검증 도구: `scripts/verify-scheduler-deployment.cjs`; backend container 안에서 `ACM_VERIFY_SCHEDULER=1`을 명시하고 실행. 기존 감사 기록은 삭제하지 않는다.
