---
document_id: SCHEDULER-API-1.1.0
version: 1.1.0
status: deployed
date: 2026-11-25
change_log:
  - 2026-11-25 v1.1.0 서비스 설정 API 사용안내 경로·3개 탭·사용 설정·파라미터 타입 및 값 사전 추가
  - 2026-11-25 v1.0.0 외부 스케줄 앱용 요청·응답 계약 초안
---

# External Scheduler API Guide (외부 스케줄 앱 API 사용 문서)

## 1. Status and Authentication (상태·인증)

**스테이징·프로덕션 배포 및 검증 완료 문서다. 예제 키·UUID는 실제 값이 아니다.** 서비스 설정의 API 사용안내와 OpenAPI 다운로드에서 같은 계약을 확인할 수 있다.

Base URL: `https://acm.amoeba.site/api/integrations/v1`

테넌트 마스터가 **서비스 설정(`/admin/config`) → API 사용안내(`/admin/config/api`) → API 사용 설정**에서 외부 API 사용을 켜고 허용할 API를 선택·저장한 뒤 앱을 만들고 키를 발급한다. 발급 시 한 번 보이는 원문을 스케줄 앱 서버의 `ACM_SCHEDULER_API_KEY` 같은 비밀 환경변수에 보관한다. 기본 만료 90일; 발급 화면에서 만료일 선택. 필요한 권한만 부여한다.

```http
Authorization: Bearer <ACM_SCHEDULER_API_KEY>
Content-Type: application/json
```

키는 한 테넌트에만 속하며 테넌트 ID 헤더/본문은 받지 않는다. 교체 시 같은 앱에서 새 키 발급 → 서버 비밀값 교체 → 정상 호출 확인 → 이전 키 폐기. 앱을 새로 만들면 소유권이 달라져 기존 externalId 수업을 수정할 수 없다.

## 2. Endpoints (주소·권한)

| Method | Path | 권한 | 기능 |
| --- | --- | --- | --- |
| GET | `/teachers` | teachers:read | 이름·이메일·재직 상태·ID 조회 |
| GET | `/lessons` | lessons:read | 해당 테넌트의 기존 수업일정/점유 일정 조회 |
| GET | `/lessons/external/{externalId}` | lessons:read | 이 연동 앱의 단일 수업·현재 버전 조회 |
| PUT | `/lessons/external/{externalId}` | lessons:write | 등록 또는 기존 외부 수업 전체 수정 |
| DELETE | `/lessons/external/{externalId}` | lessons:write | 이 연동 앱 수업 삭제(soft delete) |

externalId는 스케줄 앱의 영구 수업 식별자이며 앱 안에서 유일해야 한다. 1~128자 영문·숫자·`_`·`-`·`.`만 허용한다. 반복 수업은 회차별 ID를 사용한다. 조회 목록에는 수동 일정도 나오지만 수정·삭제는 이 앱이 만든 수업만 가능하다.

## 3. Teachers (강사 목록)

```http
GET /teachers?email=teacher%40example.com&limit=100
```

email은 trim 후 대소문자 무시 정확 일치. status 선택 값은 `ACTIVE`(재직), `LEAVE`(휴직), `RESIGNED`(퇴직), 생략하면 전체. 이메일 없는 강사도 목록에는 `email:null`로 반환된다. 결과가 0명 또는 2명 이상이면 이메일로 자동 배정하지 않는다.

```json
{"success":true,"data":[{"id":"11111111-1111-4111-8111-111111111111","name":"김강사","email":"teacher@example.com","status":"ACTIVE"}],"meta":{"nextCursor":null,"limit":100}}
```

후속 요청은 응답 `nextCursor`를 URL 인코딩하여 `cursor`로 전달한다. limit 기본 100, 최대 200. 마지막 페이지는 nextCursor:null. 전화번호·생년월일·메모는 제공하지 않는다.

## 4. Range Query (기간별·강사별 조회)

```http
GET /lessons?from=2026-12-01T00%3A00%3A00%2B09%3A00&to=2026-12-08T00%3A00%3A00%2B09%3A00&teacherId=11111111-1111-4111-8111-111111111111&limit=100
```

from/to 필수, UTC offset 필수, 최대 31일, from < to. 반복 일정 생성 범위를 제한하기 위해 to는 현재로부터 최대 2년 후까지 허용한다. `teacherId` 선택; 생략하면 해당 테넌트 전체. 강사 담당·참석자·연결 콘솔 소유자 일정을 포함한다. 기간과 조금이라도 겹치는 일정을 반환하며 종료=from 또는 시작=to인 일정은 제외한다. 삭제 일정 제외. 반환 시각은 UTC `Z` 표준화. cursor/limit 규칙은 강사 조회와 동일하며 후속 페이지에 동일한 필터를 유지한다.

```json
{"success":true,"data":[{"id":"22222222-2222-4222-8222-222222222222","externalId":"slot-20261201-001","managedByClient":true,"teacherId":"11111111-1111-4111-8111-111111111111","teacherName":"김강사","students":[{"studentId":null,"name":"홍학생"}],"startsAt":"2026-12-01T01:00:00Z","endsAt":"2026-12-01T01:50:00Z","category":"DEMO_CLASS","deliveryMode":"ONSITE","version":1}],"meta":{"nextCursor":null,"limit":100}}
```

타 연동·수동 일정은 managedByClient:false, externalId:null, version:null. 강사 연관성이 여러 개면 필터로 매칭된 강사와 담당 강사를 혼동하지 않도록 응답에 teacherIds 배열을 함께 제공한다. 기존 일정의 deliveryMode를 판단할 수 없으면 null. 조회는 점유 확인을 위해 모든 카테고리를 포함하므로 MEETING/LEVEL_TEST/OTHER 및 정규수업으로 정규화한 과거 CLASS도 올 수 있다. 학생 이름은 허용된 일정 조회의 최소 표시 정보만 제공한다.

페이지 조회 도중 일정이 바뀔 수 있다. 저장 요청이 최종 충돌을 검사하므로 조회 결과만으로 배정을 확정하지 않는다.

## 5. Create and Update (등록·수정)

```http
PUT /lessons/external/slot-20261201-001
Idempotency-Key: slot-20261201-001-create-v1
If-None-Match: *
```

```json
{
  "teacherEmail": "teacher@example.com",
  "students": [{"name": "홍학생"}],
  "startsAt": "2026-12-01T10:00:00+09:00",
  "endsAt": "2026-12-01T10:50:00+09:00",
  "category": "DEMO_CLASS",
  "deliveryMode": "ONSITE",
  "location": "2강의실"
}
```

- teacherId 또는 teacherEmail 중 정확히 하나 필수. teacherId 사용 시 동일 테넌트·재직 상태를 검사한다.
- students: 1~200명, name 필수. studentId를 알면 함께 전달; 이름만 보내면 정확히 한 명의 활성 학생과 일치할 때 연결한다. 동명이인은 422 STUDENT_AMBIGUOUS. 미등록 데모 학생은 이름으로 등록할 수 있도록 사용자 확인을 완료했다. 이 경우 학생 계정 생성·초대 없이 표시 이름만 저장한다. 정규수업은 미등록 이름만으로 등록할 수 없다.
- category는 `DEMO_CLASS` 또는 `REGULAR_CLASS`, deliveryMode는 `ONSITE` 또는 `ONLINE`.
- ONSITE는 화상 제공자 NONE으로 저장, 화상방/접속 링크 생성 없음. ONLINE은 테넌트 화상 설정 사용. Google Meet에서 필요한 meetingUrl은 HTTPS 제공자 정책을 만족해야 하며 BODA는 기존 자동 생성 정책을 적용한다. 설정 오류는 명시적 422로 반환한다.
- 시간 offset 필수, endsAt > startsAt. 날짜만 또는 시간만 전송하지 않는다.
- 신규 등록은 `If-None-Match:*`, 수정은 GET 응답 `ETag` 값을 `If-Match`로 전달한다. 조건 헤더 누락은 428. 다른 곳에서 수정했으면 412 후 재조회한다.
- PUT은 전체 교체다. 수정에도 필수 필드를 모두 보낸다. location/meetingUrl 등 선택 필드는 생략 시 초기화되므로 원하는 값을 다시 전송한다.
- 수정은 `reason` 선택, 삭제는 필수. 외부 요청은 참석자 메일을 자동 발송하지 않는다.

신규 201 / 수정 200. 단일 조회·쓰기 성공은 `ETag: "1"` 같은 불투명 버전 문자열과 아래 형태의 data를 반환한다(필드는 기간 조회와 동일; 단일 data는 객체).

```json
{"success":true,"data":{"id":"22222222-2222-4222-8222-222222222222","externalId":"slot-20261201-001","version":1,"startsAt":"2026-12-01T01:00:00Z","endsAt":"2026-12-01T01:50:00Z","category":"DEMO_CLASS","deliveryMode":"ONSITE"}}
```

기존 수동 수정도 버전을 변경해야 한다. If-Match에는 마지막 성공 또는 GET의 ETag를 그대로 사용하고 값을 직접 계산하지 않는다.

## 6. Delete (삭제)

```http
DELETE /lessons/external/slot-20261201-001
Idempotency-Key: slot-20261201-001-delete-v2
If-Match: "2"
Content-Type: application/json

{"reason":"스케줄 앱에서 수업 배정 취소"}
```

성공 200 `{"success":true,"data":{"externalId":"slot-20261201-001","deleted":true}}`. 삭제 사유는 2~500자. 동일 멱등 키로 재시도하면 같은 결과. 삭제한 externalId를 새 수업에 재사용하면 409 EXTERNAL_ID_RETIRED.

## 7. Errors and Retries (오류·재시도)

외부 API 오류 계약은 `{"success":false,"error":{"code":"SCHEDULE_CONFLICT","message":"SCHEDULE_CONFLICT","details":{"eventIds":["…"]}}}`. 기존 전역 필터와 충돌하지 않도록 이 경계에서 명시적으로 매핑하고 OpenAPI 계약 테스트로 검증한다.

| HTTP | 대표 코드 | 대응 |
| --- | --- | --- |
| 400 | INVALID_RANGE / VALIDATION_ERROR | 형식·시간 범위 수정 |
| 401 | INVALID_API_KEY | 키·만료·폐기 상태 확인 |
| 403 | INSUFFICIENT_SCOPE / INTEGRATION_DISABLED | 권한·연동 상태 확인 |
| 404 | LESSON_NOT_FOUND | 해당 앱의 externalId 확인; 다른 테넌트 존재는 공개하지 않음 |
| 409 | SCHEDULE_CONFLICT | eventIds로 충돌 확인 후 다른 시간 배정 |
| 409 | IDEMPOTENCY_KEY_REUSED / EXTERNAL_ID_RETIRED | 새 요청은 새 멱등 키, 새 수업은 새 외부 ID 사용 |
| 412 | VERSION_MISMATCH | 재조회 후 사람/앱 정책으로 변경 재검토 |
| 422 | TEACHER_NOT_FOUND / TEACHER_AMBIGUOUS / TEACHER_NOT_ACTIVE / STUDENT_AMBIGUOUS / STUDENT_NOT_FOUND / VIDEO_CONFIG_INVALID | 매칭·등록·화상 설정 해결; 후보 학생 개인정보를 오류에 포함하지 않음 |
| 428 | PRECONDITION_REQUIRED | 신규/수정 조건 헤더 추가 |
| 429 | RATE_LIMITED | Retry-After 이후 재시도 |
| 5xx | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 같은 멱등 키로 간격을 늘려 재시도 |

모든 쓰기에 Idempotency-Key 필수(1~128자). 범위는 tenant + client이며 키 교체에도 유지된다. 같은 키·메서드·경로·본문·조건 헤더이면 최초 성공 결과를 24시간 재생하고 버전 조건보다 먼저 판정한다. JSON 속성 순서는 달라도 같은 요청으로 처리한다. 같은 키에 다른 요청은 409. 실패/네트워크 단절 후 결과가 불명확하면 동일 키로 재시도한다. 24시간이 지난 불명확 요청은 먼저 externalId로 조회하여 상태를 확인한다. 새 수정 작업은 반드시 새 멱등 키를 사용한다.

## 8. Example Workflow (연동 순서)

1. 관리자가 서비스 설정 > API 사용안내 > API 사용 설정에서 전체 사용 및 필요한 API 종류를 켜고 저장한 뒤 앱·키를 발급하고 연동 앱 서버 환경변수에 저장한다.
2. 강사 목록에서 이메일을 매칭해 teacherId를 캐시한다. 상태 변경을 반영하도록 주기적으로 갱신한다.
3. 배정 기간/강사의 모든 일정 페이지를 조회한다.
4. 앱의 고유 externalId로 PUT 등록. 409이면 재배정; 성공한 eventId/ETag를 보관한다.
5. 변경은 GET으로 최신 상태 확인 후 If-Match와 새 멱등 키로 PUT. 취소는 DELETE.
6. 키는 같은 앱 안에서 교체하고 이전 키를 폐기한다.

```sh
curl --fail-with-body --get \
  'https://acm.amoeba.site/api/integrations/v1/teachers' \
  --header "Authorization: Bearer ${ACM_SCHEDULER_API_KEY}" \
  --data-urlencode 'email=teacher@example.com' \
  --data-urlencode 'limit=100'
```

실제 키를 코드·문서·스크린샷에 넣지 않는다. 배포 결과는 별도 배포 보고서에서 확인한다. 멱등 결과는 24시간 뒤 재생하지 않으며 만료 행은 매시간 정리한다. 기존 서비스의 IP별 요청 제한도 함께 적용될 수 있다. 강사 목록과 새 배정은 강사 구분(`tch_is_instructor=true`)인 마스터를 대상으로 한다.

## 9. API Guide and Settings Screens (사용안내·설정 화면)

서비스 설정의 **API 사용안내**는 다음 3개 탭으로 구성한다.

| 탭 | 제공 내용 |
| --- | --- |
| 외부 오픈 API | 제공 API 종류·제공 상태·버전·주소·메서드·필요 권한·파라미터/값(타입)·요청/응답·오류·예제 복사·OpenAPI 다운로드 |
| API 연동 | 키 발급부터 서버 보관·강사 매칭·일정 반영·재시도·키 교체까지 단계별 사용방식 |
| API 사용 설정 | 테넌트 전체 사용 ON/OFF, API 종류별 허용, 앱 사용/중지, 키 발급·권한·만료·교체·폐기·최근 사용 |

최초 외부 API 사용은 OFF이며 관리자 설정 저장 후 사용한다. 전체 또는 해당 API 종류를 OFF로 저장하면 기존 키도 해당 API를 호출할 수 없고 403 INTEGRATION_DISABLED로 거부한다. OFF는 키·수업을 삭제하지 않는다. 다시 ON으로 저장하면 만료·폐기되지 않은 기존 키를 사용할 수 있다. 앱 중지 및 키 scope도 함께 검사한다. 설정 변경·키 관리는 동일 테넌트 마스터 전용이다. 외부 API 설정은 관리자·포털 내부 API 사용 여부에 영향을 주지 않는다.

API 카탈로그는 배포된 API만 제공 중으로 표시한다. 예정된 API와 예제는 실제 호출 가능 상태와 구분한다. 화면의 복사 버튼·안내 예제는 실데이터 API 호출을 실행하지 않는다.

## 10. Parameter and Value Reference (파라미터·값·타입 사전)

화면에서는 각 엔드포인트에 해당하는 항목만 표시한다. 아래는 초기 제공 API 계약을 위한 통합 사전이다. 모든 UUID·이름·이메일·시간 예제는 가상 값이다.

| 적용 API / 위치 | 이름 | 필수 | 타입·허용값 | 기본값·제한 | 예제·설명 |
| --- | --- | --- | --- | --- | --- |
| 전체 / header | Authorization | 예 | string `Bearer <key>` | 원문 키 사용 | `Bearer acm_sk_<예시>`; URL에 키 전달 금지 |
| 쓰기 / header | Idempotency-Key | 예 | string | 1~128자 | `slot-001-create-v1`; 같은 작업 재시도에 동일 값 |
| 신규 PUT / header | If-None-Match | 예 | string `*` | 신규 전용 | 기존 수업 덮어쓰기 방지 |
| 수정 PUT·DELETE / header | If-Match | 예 | string ETag | 최신 GET 값 | `"2"`; 임의 계산 금지 |
| 단일 GET·PUT·DELETE / path | externalId | 예 | string `[A-Za-z0-9_.-]` | 1~128자 | `slot-20261201-001`; 연동 앱 안에서 고유 |
| 강사 GET / query | email | 아니오 | string(email) | 정확 일치·trim·대소문자 무시 | `teacher@example.com` |
| 강사 GET / query | status | 아니오 | enum ACTIVE/LEAVE/RESIGNED | 생략 시 전체 | ACTIVE=재직, LEAVE=휴직, RESIGNED=퇴직 |
| 목록 GET / query | limit | 아니오 | integer | 기본 100, 1~200 | `100` |
| 목록 GET / query | cursor | 아니오 | opaque string | 첫 조회 생략 | 이전 응답 meta.nextCursor 값 그대로 |
| 일정 GET / query | from | 예 | string(date-time with offset) | to보다 이전 | `2026-12-01T00:00:00+09:00` |
| 일정 GET / query | to | 예 | string(date-time with offset) | 기간 최대 31일 | `2026-12-08T00:00:00+09:00` |
| 일정 GET / query | teacherId | 아니오 | string(UUID) | 생략 시 테넌트 전체 | 강사 GET의 id |
| PUT / body | teacherId | 둘 중 하나 | string(UUID) | teacherEmail과 동시 지정 불가 | 강사 GET의 id |
| PUT / body | teacherEmail | 둘 중 하나 | string(email) | teacherId와 동시 지정 불가 | `teacher@example.com`; 재직 강사 한 명과 매칭 |
| PUT / body | students | 예 | array<object> | 1~200명 | `[{"name":"홍학생"}]` |
| PUT / body | students[].name | 예 | string | 빈 문자열 불가 | `홍학생`; 이름 표시 및 이름 매칭 |
| PUT / body | students[].studentId | 아니오 | string(UUID) | 동일 테넌트만 | 기존 학생 연결; 없으면 이름 처리 규칙 적용 |
| PUT / body | startsAt | 예 | string(date-time with offset) | offset 필수 | `2026-12-01T10:00:00+09:00` |
| PUT / body | endsAt | 예 | string(date-time with offset) | startsAt보다 이후 | `2026-12-01T10:50:00+09:00` |
| PUT / body | category | 예 | enum DEMO_CLASS/REGULAR_CLASS | 생략 불가 | 데모 / 정규수업 |
| PUT / body | deliveryMode | 예 | enum ONSITE/ONLINE | 생략 불가 | 대면 / 비대면 |
| PUT / body | location | 아니오 | string | 최대 200자; 생략 시 비움 | `2강의실` |
| PUT / body | meetingUrl | 조건부 | string(HTTPS URL) | 최대 500자; 화상 제공자 정책 | ONSITE는 지정 불가; ONLINE에서 제공자별 필수 여부 적용 |
| 수정 PUT / body | reason | 아니오 | string | 입력 시 2~500자 | `강사 배정 시간 변경` |
| DELETE / body | reason | 예 | string | 2~500자 | `스케줄 앱에서 수업 배정 취소` |

성공 응답의 id/studentId/teacherId는 UUID 문자열, startsAt/endsAt은 UTC date-time 문자열, version은 양의 정수(외부 관리 대상 외에는 null), managedByClient는 boolean, meta.nextCursor는 string 또는 null이다. deliveryMode/학생 연결 ID는 기존 일정 또는 미등록 데모 상황에서 null일 수 있다. 실제 OpenAPI에는 각 필드의 nullable·enum·길이 제한·응답 필수 여부를 명시하고 예제를 제공한다.

Deployment verified: 2026-11-25 12:45:52 KST, application SHA `bfd59c8`. See [deployment report](../report/RPT-261125-external-scheduler-production-deploy.md).
