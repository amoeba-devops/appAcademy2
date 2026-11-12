---
document_id: PLN-261112M
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-12 v1.1.0 — 사용자 확인(운영 배포까지), 구현
  - 2026-11-12 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261112M Hide tenant master from lists (테넌트 마스터 목록 비노출)

Related: [REQ-261112M](../analysis/REQ-261112M-hide-tenant-master.md)

## 1. Screen Layout (화면 구성안)
```
관리자 관리 (다른 관리자가 볼 때)          관리자 관리 (admin@tpi.co.kr 본인이 볼 때)
┌ 이름      이메일            ┐           ┌ 이름       이메일             ┐
│ 홍길동    a@tpi.co.kr       │           │ ACM Admin  admin@tpi.co.kr    │ ← 본인만 보임
│ 김직원    b@tpi.co.kr       │           │ 홍길동     a@tpi.co.kr        │
└─────────────────────────────┘           └───────────────────────────────┘
(ACM Admin 행 없음) — 등록 사용자·담당자 선택·채팅 후보도 동일
```

## 2. Implementation (구현)
공통 조건: `(NOT EXISTS(TENANT_MASTER 권한) OR usr_id = 본인)`
| # | 위치 | 변경 |
|---|------|------|
| 1 | `admin-user.service.list` + controller | 본인 id 전달, 조건 추가 |
| 2 | `registered-user.service.list` (목록·건수) + controller | 동일 |
| 3 | `project.service.people` | 동일 |
| 4 | `talk.service.listCandidates` + controller | 동일 |

## 3. Verification (검증)
- 통합: 다른 관리자 기준 4곳에서 마스터 제외, 마스터 본인 기준 포함, 건수 일치
- tsc

## 4. Result (결과, 2026-11-12)
- 4곳 쿼리에 공통 조건 추가(하위 쿼리 컬럼 혼동 방지를 위해 테이블 별칭 사용)
- 통합 5개 스펙 70건 통과(등록 사용자: 다른 사람 기준 제외·건수 일치·본인 기준 포함, 프로젝트 people: 다른 사람 기준 제외·본인 포함), 단위 99건, tsc 통과
- 채팅 후보는 같은 조건, 통합 테스트 없음(로컬 DB 권한 테이블 부재로 수동 확인 불가)
