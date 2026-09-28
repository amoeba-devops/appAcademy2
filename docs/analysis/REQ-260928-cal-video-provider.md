---
document_id: ACM-CAL-VIDEO-PROVIDER-REQ-1.0.0
version: 1.1.0
status: Implemented
created: 2026-09-28
updated: 2026-09-28
change_log:
  - version: 1.1.0
    date: 2026-09-28
    description: Implement approved provider settings, Google Meet entry and BODA policy; verify local tests
  - version: 1.0.0
    date: 2026-09-28
    description: Define tenant video provider selection and Google Meet class links
---

# Video Provider Selection — Requirements (화상강의 종류 선택 요구사항)

## 1. Overview (개요)

수업일정 `/admin/cal`에서 보다에듀 외에 Google Meet 링크로 수업을 진행한다. 설정에서 학원별 화상강의 종류를 **구글미트 / 보다에듀** 중 선택하며, 구글 선택 시 사용자 화면에서 보다에듀 기능을 노출하지 않는다.

본 문서는 사용자 요청과 로컬 소스 기준 분석이다. 운영 URL은 조회 도구에서 접근하지 못하여 운영 화면과 배포 버전은 확인하지 못했다. `/memories/`, `/memories/session/`, `/memories/repo/`는 현재 환경에 존재하지 않는다.

## 2. Current Behavior (현재 동작)

| Source | Finding (확인 내용) |
|---|---|
| `frontend-acm/src/modules/cal/components/cal-event-modal.tsx` | 정규·체험수업을 `isBodaCategory`로 분류하여 `BODASCHOOL`을 강제하며 링크 입력을 제외한다. |
| `frontend-acm/src/modules/cal/types.ts`, backend CAL DTO/entity | `GOOGLE_MEET`, `BODASCHOOL`, `NONE`, `OTHER` 및 일정별 URL 저장 기반이 이미 있다. |
| `backend/src/modules/acm-cal/application/cal-event.service.ts` | BODA 일정 저장 시 런처를 생성한다. 현재 일반 링크 검증은 HTTP(S) 접두어 수준이다. |
| `frontend-acm/src/modules/cfg/pages/config-landing-page.tsx` | 보다 전용 설정 진입점 `/admin/config/boda`가 있다. |
| `backend/src/modules/acm-cal/presentation/boda-config.controller.ts` | 보다 설정 조회·변경은 ADMIN 전용이므로 일반 사용자 공통 설정 조회에 그대로 사용할 수 없다. |
| CAL 목록·상세, portal-app 일정, web-classroom | 입장 버튼·룸 상태·녹화·출결·런처의 보다 의존 분기를 함께 점검해야 한다. |
| `amb_acm_cls_video_config` | 반별 제공사 설정이 존재한다. 학원 전체 설정과 구별하고 우선순위를 명시해야 한다. |

## 3. Functional Requirements (기능 요구사항)

| ID | Requirement (요구사항) |
|---|---|
| FR-01 | 관리자 설정에 중립 명칭인 ‘화상강의 설정’을 제공하고 학원별로 `GOOGLE_MEET` / `BODASCHOOL` 하나를 저장한다. |
| FR-02 | 구글 선택 후 신규 정규·체험수업 등록 시 Google Meet 링크 입력을 표시하고 필수로 검증한다. 저장된 링크로 강사·학생 등 권한 있는 참여자가 입장한다. |
| FR-03 | 보다 선택 시 기존 자동 강의실 생성, 1:1/1:N 선택, 입장·녹화·출결 연동을 유지한다. |
| FR-04 | 구글 선택 시 관리자·강사·학생·학부모의 관련 화면에서 보다 전용 설정 상세, 자동생성 안내, 룸 유형, 입장/즉시강의/고정강의실, 설치·체험 안내, 녹화·출결 재동기화·강제종료 기능을 숨긴다. 설정 종류 선택기의 ‘보다에듀’ 옵션은 재선택을 위해 유지한다. |
| FR-05 | 일반 일정, 수동 출결, 수업 피드백, 첨부파일 등 제공사와 무관한 기능은 유지한다. Google Meet 출결·녹화를 보다처럼 자동 수집하는 것으로 표시하지 않는다. |
| FR-06 | 구글 모드에서 보다 관련 화면 조회를 시작하지 않으며 직접 런처 URL/API 접근도 서버 정책으로 차단한다. 일반 사용자는 자격증명 없이 제공사·사용 가능 기능만 조회한다. |
| FR-07 | 설정은 `ent_id`별로 격리하고 ADMIN만 변경한다. 저장 후 관련 캐시를 갱신하고, 설정 조회 중/실패 시 보다 화면이 잠시 나타나지 않게 한다. |

## 4. Approved Policies and Implementation Details (승인 정책 및 구현 세부사항)

1. **연동 범위:** Google Meet에서 만든 링크를 일정에 붙여넣는 방식이다. OAuth, 회의 자동 생성, Google Calendar 동기화, Meet 녹화·출결 API 연동은 이번 범위에서 제외한다.
2. **초기값:** 기존 학원은 `BODASCHOOL`로 유지하여 배포만으로 기존 동작이 바뀌지 않게 한다.
3. **우선순위:** 학원 설정이 신규 수업과 제공사 기능 노출의 기준이다. 반별 기존 설정은 구글 모드에서 보다 기능을 다시 활성화할 수 없다. 기존 일반 일정의 `NONE`/`OTHER`는 유지한다.
4. **기존 일정:** 설정 변경으로 과거 일정 제공사·URL·보다 기록·비밀키를 일괄 변경하거나 삭제하지 않는다. 구글 모드의 기존 보다 일정은 공통 정보만 표시하고 ‘현재 화상강의 설정과 달라 입장할 수 없습니다’라는 중립 안내를 표시한다.
5. **일정 전환:** 기존 보다 일정을 구글로 바꾸려면 편집에서 명시적으로 전환하고 Meet 링크와 수정 사유를 저장한다. 제목 등 일반 정보 수정만으로 제공사를 자동 변경하지 않는다. 열린 보다 룸이 있으면 종료 후 전환하도록 제한한다. 설정 전환도 진행 중 룸이 있으면 종료 후 저장하도록 한다.
6. **반대 전환:** 보다로 설정을 바꾸어도 기존 구글 일정 링크는 보존한다. 구글 일정은 기존 링크 입장을 허용하고 신규 수업은 보다를 사용한다.
7. **링크 검증:** 공백 정리 후 URL 파싱으로 HTTPS, 정확한 호스트 `meet.google.com`, 회의 경로 존재를 검증한다. 사용자정보 포함 URL, 다른 호스트·위장 서브도메인·비표준 포트는 거부한다. 프론트·서버 양쪽에 적용하고 새 창 입장은 `noopener noreferrer`를 사용한다.
8. **상담 연동 예외:** 상담 화면에는 Meet 링크 필드가 없으므로 구글 모드의 자동 체험수업 일정은 링크 미등록 상태로 먼저 생성한다. CAL 편집에서 링크를 입력하면 입장 가능하다. 일반 일정 등록 API의 구글 링크 필수 조건은 유지한다.
9. **전환 경합:** 사용자 입장 컨텍스트 발급 후 2분 동안 설정·기존 보다 일정 전환을 제한하여 개설 webhook 도착 전 공백을 줄인다. 잠금 대기에는 별도 최대 2개 DB 연결 풀을 사용한다. 이미 외부 서비스로 전달한 링크·자격은 소급 회수하지 않는다.
10. **지연 이벤트:** 구글 전환 이후 도착한 기존 보다 webhook은 기존 인증·테넌트 검증하에 기록 정합성을 위해 처리한다. 신규 룸 생성·입장·사용자 발신 보다 작업은 차단하며 과거 기록 처리는 구분한다.

## 5. Acceptance Criteria (인수 기준)

- 구글 선택 → 새 정규/체험수업에 유효한 Meet URL 저장 → 새로고침 → 권한 있는 사용자 화면에서 같은 링크로 입장한다.
- 링크 누락/잘못된 도메인을 클라이언트·API에서 거부하며 구글 수업 생성·수정에 보다 룸 생성이 발생하지 않는다.
- 구글 모드의 관련 화면·직접 진입에서 보다 전용 UI와 자동 API 조회가 노출되지 않는다.
- 기존 보다 일정의 일반 필드 수정은 제공사와 URL을 보존하고, 명시적 구글 전환만 이를 변경한다.
- 보다 모드의 기존 수업 생성·입장·기록 기능 및 일반 일정·레벨테스트가 회귀하지 않는다.
- 학원 A의 설정 변경이 학원 B에 영향을 주지 않으며 일반 사용자에게 보다 비밀 설정이 반환되지 않는다.
- 설정 왕복 변경 시 기존 데이터는 유지하고, 진행 중 룸 전환 제한과 지연 webhook 처리가 정상이다.

## 6. References (참조)

- [Current specification (현재 표준)](../standard/SPEC.md)
- [BODA integration requirements (기존 연동 요구사항)](REQ-260526-acm-cal-boda-integration.md)
- [Fixed classroom design (고정 강의실 설계)](../design/DSN-260721-boda-fixed-classroom-code.md)
- [Work plan and UI layout (작업계획 및 화면 구성)](../plan/PLN-260928-cal-video-provider.md)
