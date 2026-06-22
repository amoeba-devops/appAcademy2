---
document_id: FIX-260622-csl-enrollment-tuition-paid-403
version: 1.0.0
status: fixed
created: 2026-06-22
authors:
  - gray.kim@amoeba.group
---

# 버그 수정 — CSL enrollment 수납완료 403 (FIX-260622)

## 1. 증상 (Symptom)
`PUT /api/acm/csl/inquiries/:inqId/enrollment` 요청 시 **403 Forbidden**
(예: `b65e7844-41d7-4e48-8226-feeaef7e5488`). 요청 본문에 `tuitionPaid` 변경이 포함될 때 발생.

## 2. 원인 (Root cause)
`InquiryController.upsertEnrollment` 가 senior-manager 여부를 잘못된 필드로 계산:

```ts
// before
const isSeniorManager =
  user.roles?.includes('senior_manager') || user.roles?.includes('admin') || false;
```

- `user.roles`(복수, deprecated 배열)는 ACM JWT/`AcmCurrentUser` 에 **채워지지 않는다**(현재는 `role` 단수만 존재).
- 비교값도 소문자 `'admin'` 인데 실제 role 은 대문자 `'ADMIN'`.

→ `isSeniorManager` 가 **항상 false** → [inquiry.service.ts](../../backend/src/modules/acm-csl/application/inquiry.service.ts) `upsertEnrollment` 의 BR-CSL-012 가드가 `tuitionPaid` 변경을 전부 403 으로 거부.

REQ-260621(APP_ADMIN) 작업은 `role` 단수만 확장했고 이 로직/`roles` 배열은 건드리지 않았으므로 **이전부터 존재하던 버그**다(수납 토글 사용 빈도가 낮아 미발견).

## 3. 수정 (Fix)
`role`(단수, 대문자)로 판정. 운영 결정(2026-06-22): **ADMIN + APP_ADMIN** 이 수납 완료 표시 가능.

```ts
// after
const isSeniorManager = user.role === 'ADMIN' || user.role === 'APP_ADMIN';
```

파일: [backend/src/modules/acm-csl/presentation/inquiry.controller.ts](../../backend/src/modules/acm-csl/presentation/inquiry.controller.ts)

**동일 버그 2건 동시 수정** (같은 컨트롤러):
- `upsertEnrollment` (수납 완료, BR-CSL-012) — line ~220.
- `backward` 전이 (`POST :inqId/transitions/backward`, "Backward transition requires admin role") — line ~151. `isAdmin = user.roles?.includes('admin')` 도 항상 false 였음 → 관리자 역방향 전이 불가. 동일하게 `user.role === 'ADMIN' || 'APP_ADMIN'` 로 수정.

## 4. 영향 / 배포
- DB 마이그레이션 없음 — 코드 전용 수정.
- 빌드: `nest build` clean.
- 배포: commit → PR → cd-staging → cd-production (DB 작업 불필요).

## 5. 후속 (Follow-up, optional)
- 다른 컨트롤러에 남아있을 수 있는 `user.roles?.includes('...')`(소문자) 패턴 전수 점검 → 동일 버그 가능성. 별도 정리 PR 후보.
