---
document_id: GUIDE-260721-enrollment-to-classroom
version: 1.0.0
status: active
created: 2026-07-21
authors:
  - Claude (Opus 4.8)
audience: 학원 운영자/관리자(ADMIN·STAFF) + 학생·학부모(포털 이용자)
source_of_truth:
  - backend/src/modules/acm-auth/application/portal-account.service.ts (포털계정 발급·로그인ID·임시비번)
  - backend/src/modules/acm-csl/application/csl-enrollment-registration.service.ts (CLASS_STARTED 자동등록)
  - backend/src/modules/acm-cls/application/dto/class.dto.ts (수업 생성·명단·반복)
  - backend/src/modules/acm-cal/application/cal-event.service.ts (수업→캘린더 이벤트·BODA 룸 발급)
  - backend/src/modules/acm-cal/application/boda-launch-context.service.ts (포털 입장 인가·시간창)
  - frontend-acm/src/modules/portal-app/pages/portal-cal-event-detail-page.tsx (학생 BODA 입장)
related:
  - docs/manual/GUIDE-260721-consultation-process.md (가이드 1 — 상담 진행)
  - docs/manual/MANUAL-260714-user-onboarding-and-roles.md (계정·역할 전체)
  - docs/reference/GUIDE-260611-teacher-boda-classroom.md (강사용 BODA)
  - docs/report/체크리스트-보다스쿨-설정.md (BODA webhook 미연동 blocker)
---

# 가이드 2 — 수강등록 이후: 포털계정 → 수업 배정 → 보다스쿨 강의실 입장

> **[가이드 1](GUIDE-260721-consultation-process.md)** 에서 상담이 **6. 수강등록**에 도달한 뒤부터를 다룹니다.
> 학생·학부모의 **포털 계정 생성** → 관리자의 **수업일정 등록·강의실 배정** → 학생의 **보다스쿨 강의실 입장**까지
> 전 과정을 실제 화면·경로 기준으로 정리합니다.

---

## 0. 전체 흐름 한눈에 (End-to-end)

```
[가이드 1: 상담 6.수강등록 진입]
        │  (학생·학부모 레코드 + 포털계정 자동 준비)
        ▼
① 포털계정 확정          ② 수업일정 등록·배정            ③ 학생 포털              ④ 보다스쿨 입장
학생=이메일 로그인ID  ─▶  /admin/cls 수업생성       ─▶  /portal/calendar   ─▶  이벤트 상세 → BODA
(이메일 없으면 관리자      + 학생 명단(roster)             수업일정 열람            앱(bodaJoin) 또는
 가 입력 후 발급)         + 캘린더 이벤트 = 강의실 배정                            브라우저 새 탭 입장
```

**핵심 규칙 3줄**
- 학생 포털 로그인 아이디 = **본인 이메일**. 이메일이 없으면 계정 발급 불가 → 관리자가 이메일 입력 후 발급.
- 학생의 "수업강의실 배정" = 관리자가 만든 **수업(class)의 명단(roster)** 에 학생이 들어 있고, 그 수업이 **캘린더 이벤트(보다스쿨)** 로 열리는 것.
- 학생 입장은 **강사가 강의실을 열어야** 실제 입장까지 완결됩니다(강사 개설 전에는 대기).

---

## 1. ① 포털 계정 생성 (Portal account)

### 1.1 두 계정 체계 (먼저 구분)
| 구분 | 운영 콘솔 | 포털 |
|---|---|---|
| 로그인 | `/admin/login` | `/portal/login` |
| 테이블 | `amb_acm_user` | `amb_acm_portal_account` |
| 대상 | ADMIN·TEACHER·STAFF | **STUDENT·PARENT**·TEACHER |

이 가이드의 학생·학부모는 **포털 계정**만 사용합니다.

### 1.2 자동 준비 (수강등록 시점)
상담이 **6. 수강등록(CLASS_STARTED)** 에 진입하면 학생·학부모 포털 계정이 **자동 준비**됩니다.
- **학부모**: 자동 생성 아이디(예: `p8k3m9`)로 **즉시 발급**됩니다.
- **학생**: **이메일이 있어야** 발급됩니다. 상담에서 자동 생성된 학생은 이메일이 없어 **조용히 건너뜁니다** → 관리자가 이메일 입력 후 수동 발급(1.3).

### 1.3 학생 포털 계정 수동 발급 (`/admin/std/:id`)
학생 상세화면의 **"포털 계정" 패널**에서 발급합니다.

1. 학생 상세(`/admin/std/:id`)로 이동 → **이메일**을 먼저 입력·저장.
   - 이메일이 비어 있으면 발급 버튼이 비활성이고, 안내가 뜹니다: *"학생 이메일을 등록해야 포털계정을 발급할 수 있습니다."* (시도 시 `422 STUDENT_EMAIL_REQUIRED`)
   - 같은 학원 내 이메일 중복 불가(`409 LOGIN_ID_TAKEN`).
2. **[발급]** 클릭 → **로그인 아이디 = 학생 이메일(소문자)** 로 계정 생성.
   - 비밀번호는 비우면 **임시 비밀번호(10자, 영문+숫자)가 자동 생성**되고, **1회만 화면에 표시**됩니다 → 복사해 학생/학부모에게 전달.
   - 필요 시 비밀번호를 직접 지정할 수도 있습니다.
3. 비밀번호 분실 시 **[재설정]** — 새 임시 비밀번호 발급 + 계정 잠금 해제.

> ℹ️ **최초 로그인 시 비밀번호 강제 변경은 현재 없습니다**(단순 로그인, PLN-260716). `mustChangePassword=false`로 발급됩니다. (기존 MANUAL-260714 §6.2의 "강제 변경" 서술은 구버전 기준)
> 발급 권한: **ADMIN / APP_ADMIN**. 같은 포털 계정 패널이 강사 등록 폼에도 있습니다.

### 1.4 포털 로그인 (`/portal/login`) — 학생·학부모 공통
로그인에는 **학원 코드 + 아이디 + 비밀번호** 3가지가 필요합니다(멀티테넌트 격리).
- **학원 코드**: 예) 트리니티 = `tpi`. 관리자가 배포하는 `…/portal/login?t=tpi` 링크를 쓰면 자동 채움.
- **아이디**: 학생 = **본인 이메일** / 학부모 = **발급된 임의 아이디**.
- **비밀번호**: 발급된 임시 비밀번호.
- 보안상 학원코드·아이디·비밀번호 오류는 **모두 동일한 오류 메시지**(`401`)로 처리됩니다.

---

## 2. ② 수업일정 등록 · 수업강의실 배정 (Class & schedule)

### 2.1 수업 생성 (`/admin/cls`)
수업은 **강사 + 과목 + 학생 명단 + 일정**을 묶은 단위입니다. (API: `POST /api/acm/cls/classes`)

수업 생성 다이얼로그 입력:
- **과목/코스** (`subjectType`)
- **담당 강사** — 강사 마스터(`tch`) 기준으로 선택(`teacherTchId`). *(수업생성 개선 PLN-260719 D — 강사=tch 마스터 기준)*
- **개강일/종강일 · 교재·메모 · 시급(선택)**
- **학생 명단(roster)** — **최소 1명 필수**. 여러 명 선택 시 그룹 수업으로 자동 표시(`is_group`), 대표/그룹peer 역할 지정.
- **일정** — **날짜 지정(기본)** 또는 **주간 반복**(요일/시작시각/수업시간(분)/수업방식). *(PLN-260719 D — 반복은 선택, 날짜지정이 기본)*
- **화상 방식** — `GOOGLE_MEET` 또는 **`BODASCHOOL`**.

저장하면 수업이 만들어지고 **세션(회차)이 자동 생성**됩니다(기본 35일치, `.../sessions/generate?horizonDays=35`). 같은 강사/학생의 **시간 겹침은 자동 차단**됩니다.

> ⚠️ **명단은 수업 생성 시 확정**됩니다 — 기존 수업에 학생을 나중에 추가하는 버튼은 현재 없습니다. 명단 변경이 필요하면 신규 수업으로 구성하거나 수강신청(승인) 경로를 사용하세요.
> **명단(roster) vs 수강신청(enrollment)** 구분: 명단은 실제 수업을 듣는 학생(출석·정산 기준, `amb_acm_cls_class_students`), 수강신청은 학부모 신청→관리자 승인 경로(`/admin/enrollments`)로 별개입니다.

### 2.2 강의실 배정 = 캘린더 이벤트 + BODA 룸
학생이 실제로 입장하는 "강의실"은 수업 세션이 아니라 **캘린더 이벤트(`amb_acm_cal_event`)** 입니다.

- 관리자가 `/admin/cal`(수업일정 캘린더)에서 이벤트를 만들거나, 수업(class)에서 파생된 이벤트가 생깁니다. 이벤트는 **`evt_cls_id`** 로 수업(→명단)에 연결됩니다.
- 이벤트의 **화상 방식 = 보다스쿨(BODASCHOOL)** 이면, 저장 시 **BODA 룸이 자동 발급(PENDING)** 되고 **입장 런처 URL** 이 `evt_meeting_url` 에 기록됩니다.
  - 이때 `meetKey = tac-{evt_id}` 가 생성되고, 룸 상태는 `PENDING → OPEN → STARTED → (PAUSED) → ENDED → CLOSED` 로 전이합니다.
- **학생의 "강의실 좌석"** = 이벤트의 `evt_cls_id` 가 가리키는 수업 **명단(roster)에 소속**되어 있고 **탈퇴 안 함(`cst_left_at` 없음)** 인 것. (명시적 초대행이 있어도 인가됩니다.)

---

## 3. ③ 학생 포털에서 수업 확인 (Timetable)

- 학생이 포털 로그인 후 **수업일정** 메뉴(`/portal/calendar`) 진입 → 본인 수업이 캘린더로 보입니다. (API: `GET /api/portal/cal/events?from=&to=`)
- **노출 범위**: 명시적 초대행이 있거나, 이벤트에 연결된 수업 명단에 **활성 소속(`cst_left_at` 없음)** 인 이벤트만. 탈퇴한 학생은 제외됩니다.
- 이벤트를 클릭하면 **상세(`/portal/calendar/:evtId`)** 로 이동합니다.

---

## 4. ④ 보다스쿨 강의실 입장 (BODA entry — 학생)

### 4.1 사전 준비
- **보다스쿨 데스크톱 앱 설치** 권장(앱 입장 경로). 미설치 시 안내 링크(`https://bodaedu.kr`)로 이동. 앱 없이 **브라우저 입장**도 가능(4.3).

### 4.2 입장 화면 (이벤트 상세 → BODA)
이벤트 상세에서 화상 방식이 보다스쿨이면 **입장 카드**가 나타납니다. (API: `GET /api/portal/cal/boda/launch-context?evtId=&lang=`)

| 룸 상태 | 학생 화면 |
|---|---|
| **PENDING**(강사 미개설) | 입장 카드 노출 + 소프트 안내 *"강사가 강의실을 열면 입장할 수 있어요. (수업 시작 전)"* — **15초마다 자동 갱신**되어 강사가 열면 즉시 입장 가능으로 전환 |
| **OPEN/STARTED** | 입장 버튼 활성 |
| **ENDED/CLOSED** | *"종료된 수업입니다."* |

- **입장 가능 시간창**: 시작 **10분 전 ~ 종료 15분 후**. 밖이면 *"아직 입장 가능한 시간이 아닙니다."*(`BODA_LAUNCH_OUT_OF_WINDOW`).
- **공유 링크**: *"보다스쿨 강의실 링크"* = `…/portal/classroom/{evtId}` (복사 가능, 사용자 무관 공용 진입).

### 4.3 앱 입장 vs 브라우저 입장
- **앱으로 입장(기본)**: 입장 버튼 → 보다스쿨 앱의 **`bodaJoin`**(학생, `meetKey`+`meetIdx`) 호출. 앱 미설치면 `BODA-NOT_INSTALLED` 안내.
- **브라우저 새 탭으로 열기(대체)**: `webBrowserUrl` 을 새 탭으로 오픈(설치 불필요). 테넌트 WebRTC URL 미설정이면 비활성.

### 4.4 ⚠️ 중요 — 학생 입장의 실제 조건
학생이 실제로 방에 들어가려면 **`meetIdx`가 필요**하고, `meetIdx`는 **강사가 강의실을 연 뒤 벤더가 발급**해 **webhook으로 우리 서버에 전달**되어야 채워집니다.
- 즉 **강사가 강의실을 열기 전**에는 학생 입장이 완결되지 않습니다(대기 카드).
- 현재 프로덕션은 **벤더 webhook이 미연동 상태**라, 강사가 열어도 우리 서버가 이를 인지하지 못하는 문제가 있습니다 — 상세·조치는 **[체크리스트-보다스쿨-설정](../report/체크리스트-보다스쿨-설정.md)** 참조. (컷오버 항목 A1·A2·A4 회신·webhook URL 등록이 선결)

---

## 5. 자주 묻는 문제 (Troubleshooting)

| 증상 | 원인 / 해결 |
|---|---|
| 학생 포털계정 발급 버튼 비활성 | 학생 **이메일 미입력** — 상세에서 이메일 입력 후 발급 |
| 발급 시 "이미 사용 중인 이메일/아이디" | 같은 학원 내 중복 — 다른 이메일 사용(`409`) |
| 학생이 수업일정에 아무 수업도 안 보임 | 해당 이벤트의 수업 **명단(roster)에 미소속**이거나 탈퇴(`cst_left_at`) 상태 |
| 수업 생성 시 강사가 목록에 없음 | 강사 마스터(`tch`) 등록 여부 확인 (PLN-260719 D — 강사=tch 기준) |
| 기존 수업에 학생 추가 불가 | 명단은 **생성 시 확정** — 신규 수업 또는 수강신청 승인 경로 사용 |
| 학생 입장 카드가 계속 "수업 시작 전" | 강사가 아직 강의실 미개설, 또는 **webhook 미연동으로 meetIdx 미수신**(체크리스트 참조) |
| "아직 입장 가능한 시간이 아닙니다" | 시간창(시작 10분 전~종료 15분 후) 밖 |
| "입장 링크가 아직 준비되지 않았습니다" | BODA 룸 미발급/비-보다스쿨 이벤트 — 이벤트 화상 방식이 BODASCHOOL인지 확인 |
| 앱 입장이 안 됨(NOT_INSTALLED) | 보다스쿨 데스크톱 앱 미설치 — 설치 안내(bodaedu.kr) 또는 브라우저 입장 |
| 포털 로그인 실패(원인 불명) | 보안상 동일 메시지 — **학원 코드**와 아이디(학생=이메일) 재확인 |

---

## 6. 부록 — 경로·API·테이블 매핑 (Reference)

**주요 경로**
| 화면 | 경로 |
|---|---|
| 학생 상세(포털계정 발급) | `/admin/std/:id` |
| 수업 관리 | `/admin/cls` |
| 수업일정 캘린더(관리자) | `/admin/cal` |
| 수강신청 관리 | `/admin/enrollments` |
| 포털 로그인 | `/portal/login` (학원코드+아이디+비번) |
| 학생 수업일정 | `/portal/calendar` → 상세 `/portal/calendar/:evtId` |
| 강의실 런처(공용) | `/portal/classroom/:evtId` |

**주요 API**
- 포털계정: `POST /api/acm/portal-accounts` (발급) · `/:id/reset` (재설정) — ADMIN/APP_ADMIN
- 포털 로그인: `POST /api/portal/auth/login {tenantCode, loginId, password}`
- 수업 생성: `POST /api/acm/cls/classes` · 세션 생성 `POST /api/acm/cls/classes/:id/sessions/generate`
- 캘린더 이벤트: `POST /api/acm/cal/events` (BODASCHOOL 시 룸 자동발급)
- 학생 수업일정: `GET /api/portal/cal/events?from=&to=`
- 학생 입장 컨텍스트: `GET /api/portal/cal/boda/launch-context?evtId=&lang=`

**주요 테이블**
- `amb_acm_portal_account`(포털계정) · `amb_acm_std_student`/`_parent`/`_student_parent`(학생·학부모·연결)
- `amb_acm_cls_classes`(수업) · `amb_acm_cls_class_students`(명단, `cst_left_at` null=활성) · `amb_acm_cls_sessions`(회차)
- `amb_acm_cal_event`(강의실 이벤트, `evt_cls_id`·`evt_meeting_provider`) · `amb_acm_cal_boda_room`(BODA 룸, `bdr_meet_key`·`bdr_meet_idx`·`bdr_status`)

**BODA 사용자 타입(UTy)**: 강사 `11` · 학생 `12` · 운영자 `13`

---

_본 가이드는 2026-07-21 구현 기준입니다. 강사 측 BODA 개설은 [GUIDE-260611-teacher-boda-classroom](../reference/GUIDE-260611-teacher-boda-classroom.md), 벤더 연동 blocker는 [체크리스트-보다스쿨-설정](../report/체크리스트-보다스쿨-설정.md)을 함께 참조하세요._
</content>
