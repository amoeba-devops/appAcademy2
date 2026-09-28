---
document_id: ACM-CAL-VIDEO-PROVIDER-PLN-1.0.0
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
    description: Plan provider settings, Google Meet entry, and BODA visibility controls
---

# Video Provider Selection — Work Plan (화상강의 종류 선택 작업계획)

## 1. Scope (범위)

[요구사항 분석서](../analysis/REQ-260928-cal-video-provider.md)의 정책안을 기준으로 작성한 승인 후 구현한 작업 문서다. 변경 대상은 `frontend-acm`, PostgreSQL `ACM_DS`, backend ACM 모듈이다.

## 2. Screen Layout (화면 구성안)

### 2.1 Settings (설정)

```text
설정
┌──────────────────────────────────────────┐
│ 화상강의                                 │
│ 수업에서 사용할 화상강의 서비스를 설정합니다. │
│                                     [열기]│
└──────────────────────────────────────────┘

← 설정 목록                  화상강의 설정
화상강의 종류   (●) 구글미트   ( ) 보다에듀
Google Meet에서 만든 링크를 수업일정에 입력합니다.
                                  [저장]
```

보다 선택 시 종류 선택기 아래에 기존 보다 연결 설정을 표시한다. 구글 선택 시 보다 설정 상세는 숨기고 종류 선택기는 항상 유지한다. `/admin/config/video`를 중립 경로로 추가하고 기존 `/admin/config/boda` 진입은 이 페이지로 연결한다. 선택 미저장 상태는 설정 폼에만 반영하며 다른 화면은 저장된 값을 사용한다.

### 2.2 Create / Edit Class (수업 등록·수정)

```text
수업일정 등록
일정 종류    [정규수업 ▼]     제목 [                  ]
담당 강사    [선택 ▼]        참여 학생 [선택          ]
시작         [날짜 / 시간]    종료 [날짜 / 시간         ]
화상강의     구글미트
Google Meet 링크 *
[https://meet.google.com/xxx-xxxx-xxx                  ]
Google Meet에서 만든 회의 링크를 붙여넣으세요.
                                      [취소] [저장]
```

보다 모드에서는 기존 자동 링크·수업 유형 UI를 유지한다. 기존 보다 일정 편집 중 구글 모드이면 ‘현재 설정으로 변경’ 동작을 표시하고 이를 선택했을 때 링크 입력을 요구한다. 일반 필드 수정과 제공사 전환을 구분한다. 레벨테스트와 일반 일정의 기존 동작은 유지한다.

### 2.3 Class Detail / Participant View (상세·참여자 화면)

```text
정규수업 · 영어
9월 28일 18:00–19:00    담당 강사 / 참여 학생
화상강의  구글미트              [구글미트 입장 ↗]
──────────────────────────────────────────────
수업 정보 / 피드백 / 첨부파일 / 기존 공통 출결
```

캘린더의 빠른 입장도 동일하게 제공사에 맞춰 동작한다. 구글 모드에서는 보다 녹화·룸 상태·재동기화·강제종료·설치 안내 섹션을 렌더링하지 않는다. 작은 화면은 입력 필드를 한 열로 배치한다.

## 3. Data and API Design (데이터·API 설계안)

- 학원별 중립 설정 `amb_acm_cal_video_config`를 신설한다. UUID `vdc_id`, unique `ent_id`, `vdc_provider` CHECK(`GOOGLE_MEET`, `BODASCHOOL`), `created_at`, `updated_at` 및 표준 trigger를 적용한다. 기존 보다 비밀키 테이블과 분리한다.
- 설정 미등록 학원은 서버에서 `BODASCHOOL`로 해석한다. 기존 CAL의 `evt_meeting_provider` / `evt_meeting_url`를 재사용한다.
- ADMIN 전용 GET/PUT `/api/admin/cal/video/config`와 권한 있는 일반 사용자용 안전한 제공사/기능 조회 계약을 추가한다. 포털은 기존 인증·학생 연결 범위에서 이 계약을 소비한다.
- 공통 서버 정책에서 저장된 학원 설정, 일정 제공사, 권한을 평가한다. 클라이언트가 임의로 `BODASCHOOL`을 전송하여 구글 설정을 우회할 수 없게 한다.
- 구글 모드의 기존 보다 일정 일반 수정은 허용하되 신규 생성·입장·보다 동작은 제한한다. 명시적 전환 시 URL 교체와 수정 이력을 한 흐름으로 저장한다.
- 전환 저장과 룸 개설이 경합하지 않게 학원 단위 잠금/트랜잭션 경계를 설계한다. 진행 중 룸이 있으면 409와 종료 후 재시도 안내를 반환한다.
- 기존 공개 런처는 접근 가능한 이벤트/룸의 테넌트 정책만 서버에서 확인한다. 보다 비밀 설정을 공개하거나 임의 `ent_id` 조회 API를 만들지 않는다.

## 4. Implementation Tasks (구현 작업)

| Step | Work (작업) |
|---|---|
| 1 | 요구사항·정책·목업 확인 후 기존 모든 BODA 진입점 및 CLS 반별 설정 사용처를 목록화한다. |
| 2 | PG migration, 설정 entity/DTO/service/controller, 안전한 기능 조회 및 변경 감사 기록을 추가한다. |
| 3 | CAL 생성·수정 검증과 구글 URL 검증을 적용하고 BODA 생성·입장·즉시/고정 룸 경로에 공통 정책을 적용한다. |
| 4 | 설정 카드·중립 설정 페이지·라우트 별칭 및 테넌트별 query key/cache 갱신을 구현한다. |
| 5 | `cal-event-modal.tsx`의 수업=BODA 강제 분기를 제거하고 신규/기존 일정 편집 정책을 구분한다. |
| 6 | CAL 목록/상세, portal-app 일정 목록/상세, web-classroom 및 발견된 다른 보다 진입점에 기능 정책과 Google 입장을 반영한다. |
| 7 | 설정 전환 후 초대/알림 링크 생성 경로도 점검하여 구글 수업에 보다 링크가 생성되지 않게 한다. 자동 외부 발송 테스트는 하지 않는다. |
| 8 | ko/en/vi/zh-CN 번역, 회귀 검증, 구현 보고서와 표준 문서 갱신을 완료한다. |

## 5. Verification (검증 계획)

- 서버: 설정 기본값, ADMIN 권한, 테넌트 격리, URL 검증, 구글 모드 BODA 우회 차단, 기록 보존, 명시적 전환, 진행 중 룸/설정 저장 경합을 검증한다.
- 기능: 구글·보다 × 신규·기존 정규/체험수업 × 관리자·강사·학생/학부모 권한 조합을 확인한다.
- UI: 등록→저장→재조회→입장, 필수 링크 오류, 저장 실패·조회 중 상태, 캐시 갱신, 직접 URL 진입, 모바일을 확인한다.
- 회귀: 일반 일정/레벨테스트, 보다 룸 유형·녹화·출결, 기존 구글 일정, 늦은 보다 webhook 기록 처리를 확인한다.
- 구글 모드에서는 보다 UI가 없고 브라우저에서 보다 전용 query가 실행되지 않는지 검증한다. 일반 피드백·첨부·수동 출결은 유지한다.
- 변경 모듈 중심 테스트와 frontend/backend type-check·build를 실행한다. 운영 설정 변경은 문서 작성 범위에 포함하지 않는다.

## 6. Delivery and Rollback (배포·복구)

1. 하위 호환 migration → backend 정책/API → frontend 순서로 적용한다.
2. 검증 환경에서 구글 수업 등록·입장과 보다 회귀를 확인한 뒤 운영 배포한다.
3. 기존 학원은 보다 기본값을 유지한다. 관리자가 설정을 저장할 때만 전환한다.
4. 구글 일정이 만들어진 이후에는 BODA 강제 처리가 있는 구버전 프론트로 단순 롤백하지 않는다. 데이터 보존 및 제공사 호환 버전을 기준으로 복구한다.

## 7. Approval Gate (구현 확인)

`AGENTS.md` §9.2: “요구사항 분석서 + 작업 계획서 작성 후 반드시 사용자 확인을 받은 후 구현으로 진행한다.”

사용자가 2026-09-28 “구현”으로 승인했다. 구현과 로컬 검증을 완료했으며 운영 DB migration·배포·학원 설정 변경은 아직 수행하지 않았다. 결과는 [구현 보고서](../report/RPT-260928-cal-video-provider.md)를 참조한다.
