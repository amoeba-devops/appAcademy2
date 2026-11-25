---
document_id: ACM-PORTAL-UI-DEPLOY-1.0.0
version: 1.0.0
status: deployed
date: 2026-11-25
release_sha: def369aa10e904caa4df7cbb050fcbb3c64dd6ed
previous_sha: 7c17137bab217c56702a75eebe86b8c6f304976b
change_log:
  - 2026-11-25 v1.0.0 PR #452 병합·스테이징·운영 배포 및 검증
---

# Portal UI Production Deployment (학원포털 UI 운영 배포 보고서)

## 1. Release (반영 결과)

사용자의 “다음 진행” 요청에 따라 [PR #452](https://github.com/amoeba-devops/appAcademy2/pull/452)를 병합하고 스테이징·운영에 반영했다. 운영은 스테이징에서 검증한 동일 SHA의 프런트엔드·백엔드 이미지다.

| 항목 | 결과 |
| --- | --- |
| PR 병합 | 2026-11-25 18:04:50 KST |
| 배포 버전 | def369a / def369aa10e904caa4df7cbb050fcbb3c64dd6ed |
| 스테이징 | 2026-11-25 18:06:47 KST, acm-stg.amoeba.site |
| 운영 | 2026-11-25 18:16:23 KST, acm.amoeba.site / acm-tpi.amoeba.site |
| 이전 운영 버전 | 7c17137 |
| DB | 신규 스키마 마이그레이션 없음 |

반응형 메뉴, 모바일 일정 목록, 수강생 탭·검색, 자료실 표/목록·전체 제목 검색, 채팅 탐색, 알림·마이페이지 개선이 반영됐다. 기존 강사 전용 메뉴, 공지 설정, 퇴원생 조회 범위, 특이사항·사용자 지정 타임존 비노출 정책은 유지한다.

## 2. Pipelines (자동 검증·배포)

| 단계 | 실행 | 결과 |
| --- | --- | --- |
| PR CI | [45566019656](https://github.com/amoeba-devops/appAcademy2/actions/runs/45566019656) | success |
| 병합 커밋 CI | [45581998784](https://github.com/amoeba-devops/appAcademy2/actions/runs/45581998784) | success |
| 스테이징 CD | [45581998844](https://github.com/amoeba-devops/appAcademy2/actions/runs/45581998844) | success |
| 운영 CD | [45583735438](https://github.com/amoeba-devops/appAcademy2/actions/runs/45583735438) | success, smoke enabled |

운영 배포는 자동 검증·스테이징 검증이 끝난 def369a를 지정하여 수동 워크플로로 실행했다. 두 운영 도메인의 스모크 테스트를 생략하지 않았다.

## 3. Browser Verification (배포 번들 화면 검증)

스테이징과 운영에 실제 배포된 번들을 사용해 세 브라우저 검증 스크립트를 실행하고 통과를 확인했다.

- portal-ui.smoke.py: 375/390/640/768/1024/1280 폭, 4개 언어, 강사·학생·학부모, 일정 필터·연도 경계·상세 복귀, 수강생 검색·퇴원생·날짜, 자료실 검색·페이지, 채팅 URL, 인라인 알림·닫기 동기화.
- portal-visibility.smoke.py: 강사 전용 캘린더, 타임존 비노출, 퇴원생 전체보기, 기존 관리자 업무 메뉴 순서·링크.
- portal-menus.smoke.py: 공지 ON/OFF 네 조합, 메뉴 저장·갱신, 직접 접근 제한, 실패 시 비노출·재시도, 특이사항 비노출.

브라우저 검증의 신원·API 응답은 가상 데이터다. 실제 고객 설정을 켜고 끈 것이 아니며 실제 사용자 로그인이나 실제 메시지 전송을 수행했다는 의미가 아니다. 운영 번들 렌더링과 실제 서비스 API 검증을 구분한다.

## 4. Read-only API Verification (실제 서비스 API 검증)

서버 내부에서 기존 활성 계정 범위의 단기 JWT를 메모리에서만 사용하고 GET 요청으로 검증했다. 원문 토큰·키·이름·연락처·학생 식별자를 출력하지 않았다. 직접 DB 조회도 SELECT만 사용했다.

| 환경·역할 | 결과 |
| --- | --- |
| 스테이징 학생 | 프로필·역할 메뉴·자료실 제목 검색·페이지 처리 통과 |
| 스테이징 강사 | 활성 계정이 없어 실제 계정 검증은 생략. 가상 강사 화면 검증은 통과 |
| 운영 강사 | 프로필·역할 메뉴·자료실 검색, 기본/전체보기 담당 범위, 퇴원생 기본 제외, 상세 특이사항 필드 비노출 통과 |
| 운영 학생 | 프로필·역할 메뉴·자료실 제목 검색·페이지 처리 통과 |

검색은 기존 허용 게시물에서 제목으로 검색되는지와, 임의의 미일치 문자열 및 퍼센트/밑줄을 보냈을 때 결과·총계가 함께 0인지 확인했다. 기존 고객 계정·설정·수업·자료를 생성·수정·삭제하지 않았다. 기존 서비스의 정상 접근·감사 로그는 보존한다.

두 운영 도메인에서 /portal/calendar는 HTTP 200, 인증 없는 /api/portal/materials 조회는 HTTP 401을 확인했다.

재사용 검증 도구: [verify-portal-ui-deployment.cjs](../../scripts/verify-portal-ui-deployment.cjs). 서버의 backend 컨테이너에서 ACM_VERIFY_PORTAL_UI=1로 실행하며, 계정이 없는 역할은 성공으로 간주하지 않고 skipped로 표시한다.

원문을 포함하지 않는 결과: [스테이징](assets/portal-ui-production-261125/runtime-staging.json), [운영](assets/portal-ui-production-261125/runtime-production.json).

## 5. Runtime and Observation (런타임·상태 관찰)

운영 프런트엔드·백엔드 모두 def369a 이미지로 실행 중이며 배포 직후 재시작 횟수는 0이다. 배포 전후 확인한 오류 표식(ERROR / QueryFailedError / UnhandledPromiseRejection / FATAL)은 0건이었다.

배포 후 15분간 두 운영 도메인의 /api/health를 관찰했고 모든 응답이 HTTP 200이었다.

| 관찰 항목 | 결과 |
| --- | --- |
| 시작 | 2026-11-25 18:17:07 KST |
| 완료 | 2026-11-25 18:32:07 KST |
| 관찰 시간 | 900초 |
| 요청 수 | 62회 |
| 비정상 응답 | 0회 |
| 응답 시간 p50 / p95 / 최대 | 0.0701 / 0.2895 / 0.7174초 |
| 마지막 컨테이너 상태 | 양쪽 def369a / running / 재시작 0 |
| 배포 후 백엔드 오류 표식 | 0 |

[관찰 원본](assets/portal-ui-production-261125/health-monitor.json) · [마지막 런타임 상태](assets/portal-ui-production-261125/runtime-final.json). 모니터링 기준에 해당하는 장애가 없어 복구를 실행하지 않았다.

## 6. Screens (운영 번들 검증 캡처)

다음 캡처는 운영 배포 번들에 가상 데이터를 적용한 화면이다.

| 화면 | 캡처 |
| --- | --- |
| 수업일정 | [데스크톱](assets/portal-ui-production-261125/calendar-desktop.png) |
| 수강생 | [데스크톱](assets/portal-ui-production-261125/students-desktop.png) / [모바일](assets/portal-ui-production-261125/students-mobile.png) |
| 자료실 | [모바일](assets/portal-ui-production-261125/materials-mobile.png) |
| 채팅 | [모바일](assets/portal-ui-production-261125/chat-mobile.png) |
| 내 정보 | [데스크톱](assets/portal-ui-production-261125/profile-desktop.png) |

## 7. Rollback (복구 기준)

배포 후 지속적인 5xx·헬스 실패·재시작 증가·역할 또는 검색 범위 회귀가 있으면 운영 워크플로에서 이전 이미지 7c17137을 지정해 복귀한다. 데이터 스키마 변경이 없으므로 UI 복구를 위해 고객 데이터를 삭제하거나 설정을 초기화하지 않는다.

이번 배포에서는 신규 알림 예약·다음 수업 집계·포털 일정 추가를 활성화하지 않는다. 원 계획의 선택 확장으로 별도 유지한다.

- [구현 내용·로컬 검증](RPT-261125-portal-ui-improvement.md)
- [릴리스 메타데이터](assets/portal-ui-production-261125/release.json)
