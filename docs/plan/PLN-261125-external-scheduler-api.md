---
document_id: SCHEDULER-PLN-1.1.0
version: 1.1.0
status: implemented_pending_deployment
date: 2026-11-25
change_log:
  - 2026-11-25 v1.1.0 서비스 설정 API 사용안내 3개 탭·파라미터 사전·테넌트 API 사용 설정으로 화면 및 작업 범위 보강
  - 2026-11-25 v1.0.0 화면 구성안·구현 순서·검증 기준 작성
---

# External Scheduler API Work Plan (외부 스케줄 API 작업 계획)

## 1. References (참조)

- [Requirements (요구사항)](../analysis/REQ-261125-external-scheduler-api.md)
- [Proposed API Guide (API 사용 문서 초안)](../integration/external-scheduler-api.md)
- 사용자가 구현 및 스테이징·프로덕션 배포를 승인했다. 구현된 경로·스키마·계약을 기존 표준과 통합해 검증한다.

## 2. UI Layout (화면 구성안)

`/admin/config` 서비스 설정의 기존 카드 목록에 **API 사용안내** 카드 추가 → `/admin/config/api`. 기존 제안의 `/admin/config/scheduler` 전용 화면을 이 통합 화면으로 대체한다. 안내 열람은 기존 서비스 설정 접근 정책, 사용 설정 변경·키 관리는 동일 테넌트 마스터 권한으로 제어한다.

```text
서비스 설정 > API 사용안내
[외부 오픈 API] [API 연동] [API 사용 설정]

외부 오픈 API 탭
API 종류 [전체 ▼]           [강사/수업일정 API 검색________]
API 주소: https://acm.amoeba.site/api/integrations/v1   [복사]
[OpenAPI 다운로드]     버전 v1 / 제공 상태: 제공 중 또는 예정
강사 목록 조회  GET /teachers                  [상세 펼치기]
수업일정 조회   GET /lessons                   [상세 펼치기]
수업 등록·수정  PUT /lessons/external/{externalId}
수업 삭제      DELETE /lessons/external/{externalId}
  위치   파라미터       필수  타입       값/예제              설명
  query  email          선택 string     teacher@example.com   정확 일치
  body   deliveryMode   필수 enum       ONSITE / ONLINE       수업 방식
  [요청 예제 JSON/curl] [응답 예제] [오류 코드] [복사]

API 연동 탭
1. API 사용 켜기 → 2. 앱/키 발급 → 3. 서버 환경변수 등록
4. 강사 이메일 매칭 → 5. 기간 조회 → 6. 배정 등록/수정/삭제
인증 / 시간대 / 페이지 조회 / 충돌 / 멱등·재시도 / 키 교체

API 사용 설정 탭 (동일 테넌트 마스터)
외부 API 사용 [OFF/ON]  (최초 OFF)
제공 API [✓] 강사 조회 [✓] 일정 조회 [✓] 일정 등록·수정·삭제
                                                   [저장]
안내: OFF로 저장하면 기존 키의 API 호출도 차단됩니다.
연동 앱 관리                                      [연동 앱 추가]

연동 앱: 내부 스케줄 앱                          [사용 중지]
  키 이름       권한                       만료일    최근 사용    상태
  운영 서버     강사조회·일정조회·일정쓰기   2027-02-23  5분 전     활성 [폐기]
  교체 서버     강사조회·일정조회·일정쓰기   2027-02-23  미사용     활성 [폐기]
                                             [이 앱의 새 키 발급]

발급 창
앱 선택 [내부 스케줄 앱 ▼]  키 이름 [운영 서버________]
권한 [✓] 강사 조회  [✓] 일정 조회  [✓] 일정 등록·수정·삭제
만료일 [2027-02-23] (기본 90일, 관리자 선택)
                                             [취소] [발급]

발급 완료 — 이 창을 닫으면 키 원문을 다시 볼 수 없습니다.
[acm_sk_<식별자>_<비밀값>________________] [복사]
서버 환경변수에 보관하세요.                  [확인]

폐기 창: 이 키를 사용하는 연동 요청이 즉시 중단됩니다. [취소] [폐기]
```

기존 CAL 상세에 `외부 연동 · 내부 스케줄 앱`, 대면/비대면, 학생 표시 이름을 보여준다. 원문 키·외부 인증 정보를 노출하지 않는다. 등록된 학생은 기존 참석자 연결을 유지하고, 미등록 데모 이름은 초대 대상과 구분한다. 모바일에서는 키 목록을 카드로 전환하고 키 원문은 줄바꿈한다. 4개 locale에 같은 의미의 문구를 추가한다.

## 3. Architecture and Data (구조·데이터)

```text
스케줄 앱 서버 -- API key --> 외부 API Guard (tenant/client/scopes)
  --> Scheduling use case (이메일 매칭·권한·멱등·버전·충돌)
  --> 공통 CAL 저장 경계 (일정·참석자·외부 매핑·감사)
  --> PostgreSQL db_acm / ACM_DS --> 기존 관리자·강사 캘린더

테넌트 마스터 -- 기존 JWT --> 키 발급/폐기 관리 API
```

신규 `acm-integration` 모듈은 외부 인증·외부 요청 계약을 담당하고 CAL/강사 도메인을 호출한다. 외부 키로 관리자 역할을 가장하거나 기존 관리자 컨트롤러를 직접 통과시키지 않는다. 감사 작성자는 발급 시 설정한 동일 테넌트 관리 계정과 clientId/keyId를 함께 기록한다. 발급자 비활성 시 쓰기를 중지하고 마스터가 유효한 작성 계정을 재지정할 수 있게 한다.

카탈로그는 외부 API의 DTO·OpenAPI 메타데이터와 연결된 단일 계약 원본을 사용한다. 타입/enum/예제/제공 상태가 UI 안내와 Markdown·OpenAPI에서 어긋나지 않도록 계약 검증한다. UI 예제의 복사·문서 다운로드는 조회 기능으로 구현하고 실데이터에 쓰기를 실행하는 콘솔은 포함하지 않는다.

| 변경 | 내용 |
| --- | --- |
| `amb_acm_int_config` | ent_id별 단일 설정, 전체 사용 여부 기본 false, 허용 scope 목록, 변경자·timestamps. 신규 테넌트는 명시적 활성화 전 호출 불가 |
| `amb_acm_int_client` | 클라이언트 UUID, ent_id, 이름, 상태, 감사 작성 계정, 공통 timestamps |
| `amb_acm_int_api_key` | 키 UUID, ent_id/client FK, 공개 식별자·해시, scopes, 만료·폐기·최근 사용 시각; 원문 저장 금지 |
| `amb_acm_int_lesson_link` | ent_id/client/externalId UNIQUE, event FK, 버전, 삭제 tombstone, 학생 이름 스냅샷/연결 ID. 같은 이벤트의 중복 연결 제한 |
| `amb_acm_int_request` | ent_id/client/멱등 키 UNIQUE, 메서드·경로·payload 해시, 결과·상태·만료; 성공 결과 24시간 보존, 삭제 정리 |
| CAL delivery mode | `evt_delivery_mode` nullable 추가; 신규 외부 요청은 ONSITE/ONLINE 필수, 기존 일정은 NULL 허용하여 소급 오분류 방지 |
| CAL source | EXTERNAL source 허용 CHECK·타입 추가, 기존 MANUAL/CLS_SESSION/INSTANT 보존 |

SQL 마이그레이션은 `1072-external-scheduler-api.sql`이다. 신규 테이블은 UUID/ent_id/PG 명명·복합 테넌트 FK/공통 updated_at trigger 규칙을 적용한다. 동명이인 이름 스냅샷은 학생 계정 연결을 대신하지 않는다.

구현 결정: CAL event/invitee의 BEFORE STATEMENT DB 트리거와 외부 트랜잭션이 공통 advisory lock `(1072,1)`을 사용한다. 기존 SQL·반복·ICS·CLS 쓰기까지 참여시키고 행 잠금 역전을 피한다. 초기 구현은 전체 CAL 쓰기를 직렬화하므로 고부하 시 테넌트별 잠금으로 세분화할 수 있다. 기존 일정 쓰기와 경합하는 실제 PG 테스트를 포함한다.

`acm-integration/application`, `presentation`에서 외부 계약을 구현하고 CAL의 검증·BODA pending provision·참석자·변경 이력·inbox 경계를 재사용한다. 키·설정·수업 변경은 `amb_acm_int_audit`에 client/key/actor를 기록하며 비밀값은 기록하지 않는다. 테넌트 연동 설정에도 동일 API 사용안내 화면 링크를 제공한다.

## 4. Implementation Steps (구현 순서)

1. **인증·관리·사용 설정**: 키 생성/해시 검증/권한/만료/즉시 폐기/속도 제한. TENANT_MASTER 전용 관리 API 및 UI. 테넌트 전체/종류별 API 설정 저장·재조회·즉시 차단. 클라이언트 중지·발급자 비활성·테넌트 상태 검사.
2. **읽기**: 강사 제한 필드 projection·정확 이메일 필터·페이지 조회. 기간별 CAL 조회를 기존 역할 필터와 분리해 해당 테넌트 점유 일정 전체에 적용. 반복·ICS 범위 생성 규칙을 기존 조회와 일치시킨다.
3. **공통 저장 경계**: 기존 create/update의 EntityManager 전달을 지원하도록 필요한 부분만 추출. 이벤트·참석자·매핑·요청 결과를 원자적으로 저장; 커밋 이후 알림 경계를 명확히 한다. 기존 CAL CRUD 동작 회귀 검증.
4. **충돌·버전**: 기존 쓰기 경로(수동·반복·ICS·상담·즉시 생성 및 CLS 연결 생성)를 추적하고 공유 잠금 순서를 확정. 외부 쓰기가 기존 일정과 충돌하면 409; 기존 경로의 허용 정책은 보존하되 외부 배정의 검사·커밋 중 끼어들지 않도록 직렬화. 교착/경합 테스트 후 완료 판정.
5. **외부 쓰기**: externalId upsert/soft delete, Idempotency-Key, If-Match, 이메일 매칭, 학생 처리, 외부 소유권. 대면은 NONE/화상 URL 없음, 비대면은 기존 제공자 및 URL/자동 생성 규칙 적용. 수정 시 모드 전환도 검증.
6. **화면·문서**: `/admin/config` 카드, `/admin/config/api`의 외부 오픈 API/연동 안내/사용 설정 3개 탭, 종류·엔드포인트·타입·허용값·예제·오류 설명, 설정 저장 및 키 관리, CAL 출처/학생명 표시·번역. 사용 문서와 OpenAPI 계약을 실제 HTTP 응답 기준으로 확정하고 요청 예제를 검증한다.
7. **검증·검토**: 아래 기준 통과 후 구현 보고와 PR 작성. 운영 반영은 해당 변경에 대한 배포 지시 후 수행한다.

## 5. Verification (검증)

- 실제 PG 통합: 키 정상/누락/오류/만료/폐기/권한부족/타 테넌트 접근/기능 중지. 키 원문 재조회 불가·감사 로그 비노출.
- 일정 등록→기존 CAL·강사 포털 확인→수정→삭제. 교체 키로 기존 수업 수정, 타 클라이언트·수동 일정 변경 불가.
- 이메일 trim·대소문자·미등록·중복·휴직·퇴직 및 학생 연결/동명이인/미등록 데모. 다른 테넌트의 ID는 거부.
- 경계 시각 인접 허용/1초 겹침 거부/자기 수정 제외/자정·UTC offset·DST 시각/offset 없는 값 거부.
- 동시 동일 externalId·동일 멱등 키·동일 강사 시간 쓰기, 기존 UI/반복/ICS 쓰기와 경합, 실패 주입 rollback. 성공 일정이 중복되지 않는지 DB로 확인.
- stale If-Match 412, 동일 멱등 키 다른 본문 409, 이미 삭제한 ID 재사용 409, 삭제 재시도 성공.
- 기간 조회의 기존 일정 포함/반복 생성/강사 참석자·소유자 범위/페이지 누락 방지/31일 제한/429.
- 대면 화상방 미생성, 비대면 BODA/Google Meet 정책 및 기존 화상 설정 전환·기존 수정 이력 회귀.
- 키 발급/한 번 표시/교체/폐기/오류/모바일 Playwright 확인; frontend/backend build·관련 lint·의미 있는 통합 테스트.
- 서비스 설정 진입·API 사용안내 카드·3개 탭·엔드포인트 검색·파라미터 타입/필수/enum/예제·복사·OpenAPI 다운로드·권한별 화면 검증. 안내 열람이 쓰기를 유발하지 않는지 확인.
- 최초 OFF, ON 저장 후 재접속, 종류별 OFF, 앱 중지, 키 scope의 교집합 검증. OFF 즉시 기존 키/멱등 재생 차단, ON 시 유효 키 재사용, 폐기 키는 재사용 불가. 다른 테넌트 설정 영향 없음.

## 6. Release and Rollback (배포·되돌리기)

스키마는 기존 데이터에 대한 additive migration으로 준비한다. 운영 DB 백업, CI, staging에서 실제 배포 번들·키 권한·일정 반영 검증 후 운영 배포한다. 실제 검증용 일정은 별도 테스트 테넌트에서 생성하고 정리한다. 사용자 승인 없이 실학생 수업을 변경하지 않는다. 장애 시 클라이언트/키를 중지해 외부 쓰기를 차단하고 이전 이미지로 복귀한다. EXTERNAL source/새 컬럼을 구버전이 처리하는지 사전 확인하며 스키마·생성 일정은 즉시 삭제하지 않는다.

Implementation and staging/production deployment were explicitly authorized by the user on 2026-11-25.
