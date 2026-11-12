---
document_id: PLN-261112J
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현. ICS 가져오기 소유자는 완전삭제 거부(409) 추가
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112J Console user delete (콘솔 사용자 삭제)

Related: [REQ-261112J](../analysis/REQ-261112J-user-delete.md)

## 1. Screen Layout (화면 구성안)
```
/admin/config/admins  관리자 관리
[검색][역할▾][인증▾][상태: 사용 중 ▾ | 삭제됨]
┌ 이름      이메일          역할   인증  상태 ──────┐
│ 홍길동    a@tpi.co.kr     ADMIN  AMA   사용        │ → 행 클릭 → 상세 패널
└──────────────────────────────────────────────────┘
상세 패널 맨 아래:
┌ 계정 삭제 ─────────────────────────────────────────┐
│ 삭제하면 로그인할 수 없고 담당자·채팅 목록에서        │
│ 빠집니다. '삭제됨'에서 복구할 수 있습니다. [삭제]     │
└──────────────────────────────────────────────────┘
(삭제됨 보기) 행: 홍길동 (삭제됨 2026-11-12)  [복구]

/system/tenants/{entId}  테넌트 사용자
┌ 이메일        이름    역할   상태          ──────┐
│ a@tpi.co.kr   홍길동  ADMIN  사용          [삭제] │
│ b@tpi.co.kr   김철수  STAFF  삭제됨(소프트) [삭제] │
└──────────────────────────────────────────────────┘
[삭제] → 확인 창: "완전삭제는 되돌릴 수 없습니다. 이슈·일정 기록은 남고
 작성자 이름은 비어 보입니다. 확인하려면 이메일을 입력하세요 [______] [완전삭제]"
```

## 2. Implementation (구현)
| # | 위치 | 변경 |
|---|------|------|
| 1 | `sql/acm/1064-acm-user-soft-delete.sql` | `usr_deleted_at`, `usr_deleted_by`; `uq_acm_user_ent_email` → 부분 유니크 `WHERE usr_deleted_at IS NULL` |
| 2 | `admin-user.service/controller` | `DELETE :id`(소프트), `POST :id/restore`, 목록 `status=DELETED` 필터·기본 제외 |
| 3 | `system-user.service/controller` | `DELETE :id`(완전) — 트랜잭션으로 개인 데이터 삭제 후 사용자 삭제 |
| 4 | `acm-auth.service` | SSO: 삭제 사용자 매칭 시 403 `ACCOUNT_DELETED`, 이메일 매칭은 삭제 제외 |
| 5 | invite / create | 이메일 중복 검사에서 삭제 사용자 제외 |
| 6 | `project.service` people·멤버, `talk.service` 후보 | `usr_locked_at IS NULL` 추가, 멤버 목록 삭제 제외 |
| 7 | 화면 2개 + i18n 4개 | 삭제·복구·완전삭제 확인 창 |

## 3. Verification (검증)
- 단위/통합 테스트: 소프트삭제→로그인 거부·목록 제외·복구·이메일 재등록·복구 충돌 409, 완전삭제 개인 데이터 정리, 자기 자신 삭제 거부
- 로컬 SQL 트랜잭션 적용, build/tsc, Playwright 목 화면

## 4. Result (결과, 2026-11-12)
- 추가 결정: ICS 가져오기 소유자(`amb_acm_cal_ics_source.owner_user_id` NOT NULL FK, 반복 일정 생성에 사용)는 완전삭제 409 `USER_OWNS_ICS_SOURCES` → 관리자 관리에서 소프트삭제 안내
- 세션: JWT 검증이 매 요청 ACTIVE 확인 → 소프트삭제 즉시 기존 세션 무효
- 통합 테스트: 소프트삭제·목록 제외·수정 409·복구, SSO 403→복구 후 동일 계정, 이메일 재등록·복구 409, 완전삭제(푸시 구독 정리)·ICS 소유자 409, 선택 목록 잠금/삭제 제외·멤버 목록 삭제 제외 — 7개 스펙 76건 통과
- 단위 테스트 203건, backend tsc, frontend tsc·build 통과
