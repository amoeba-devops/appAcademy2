# RPT-260506-acm-tch-stf-cal — Teacher / Staff / Calendar 모듈 작업 완료 보고서

- Document ID: `RPT-260506-acm-tch-stf-cal`
- Version: 1.0.0
- Status: Implemented (pending staging deploy)
- Linked Docs: [REQ-260506-acm-tch-stf-cal](../analysis/REQ-260506-acm-tch-stf-cal.md), [PLN-260506-acm-tch-stf-cal](../plan/PLN-260506-acm-tch-stf-cal.md)

---

## 1. Summary (요약)

교사·직원·캘린더 3개 모듈을 ACM (Academy Management) 백엔드 + 프런트엔드에 추가하였다.
사용자 결정 사항을 모두 반영했다 — 화상미팅 URL 수동 입력, 초대 이메일 v2 지연, 어드민이 교사/직원의 ID/PW 직접 등록.

## 2. Changed Files (변경 파일)

### SQL (4)
- [sql/acm/140-migration-user-role.sql](../../sql/acm/140-migration-user-role.sql)
- [sql/acm/800-acm-tch-teacher.sql](../../sql/acm/800-acm-tch-teacher.sql)
- [sql/acm/810-acm-stf-staff.sql](../../sql/acm/810-acm-stf-staff.sql)
- [sql/acm/820-acm-cal-event.sql](../../sql/acm/820-acm-cal-event.sql)

### Backend — Auth/role propagation
- [backend/src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity.ts](../../backend/src/modules/acm-auth/infrastructure/typeorm/acm-user.typeorm-entity.ts) — `usr_role` 컬럼
- [backend/src/modules/acm-auth/application/acm-auth.service.ts](../../backend/src/modules/acm-auth/application/acm-auth.service.ts) — `createUserWithPassword` / `updateUserPassword` / `assertPasswordPolicy` + JWT payload role
- [backend/src/modules/acm-auth/application/dto/acm-auth.dto.ts](../../backend/src/modules/acm-auth/application/dto/acm-auth.dto.ts)
- [backend/src/modules/acm-auth/jwt/acm-jwt.strategy.ts](../../backend/src/modules/acm-auth/jwt/acm-jwt.strategy.ts)
- [backend/src/modules/acm-common/decorators/current-user.decorator.ts](../../backend/src/modules/acm-common/decorators/current-user.decorator.ts)
- [backend/src/modules/acm-common/decorators/roles.decorator.ts](../../backend/src/modules/acm-common/decorators/roles.decorator.ts)
- [backend/src/modules/acm-common/guards/roles.guard.ts](../../backend/src/modules/acm-common/guards/roles.guard.ts)
- [backend/src/modules/acm.module.ts](../../backend/src/modules/acm.module.ts)

### Backend — 신규 모듈
- `backend/src/modules/acm-tch/` — 교사 CRUD + 옵션 계정 발급 + 비밀번호 재설정 (관리자 전용)
- `backend/src/modules/acm-stf/` — 직원 CRUD + 동일 패턴 (관리자 전용)
- `backend/src/modules/acm-cal/` — 캘린더 이벤트 CRUD, 역할 기반 가시성, MANUAL 소스만 편집/삭제 허용

### Frontend
- 모듈: `frontend-acm/src/modules/{tch,stf,cal}/` — types, hooks, pages, components
- i18n 신규 파일 12개: `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/{tch,stf,cal}.json`
- 공통 i18n 갱신: `common.json` 4개 파일에 `nav.tch / nav.stf / nav.cal` 키 추가
- [frontend-acm/src/i18n/index.ts](../../frontend-acm/src/i18n/index.ts) — 3개 namespace 등록
- [frontend-acm/src/components/layout/app-shell.tsx](../../frontend-acm/src/components/layout/app-shell.tsx) — 사이드바 NAV 3개 추가 (UserCog/Briefcase/CalendarDays)
- [frontend-acm/src/routes/router.tsx](../../frontend-acm/src/routes/router.tsx) — `/admin/{tch,stf,cal}` 라우트 추가

## 3. Test Results (테스트 결과)

| 항목 | 명령 | 결과 |
|------|------|------|
| Backend TypeScript | `npx tsc --noEmit` | ✅ no output (clean) |
| Frontend TypeScript | `npx tsc --noEmit` | ✅ no output (clean) |
| Frontend Production Build | `npm run build` | ✅ 1909 modules, 814 kB → 235 kB gzip |
| Staging deploy | `scripts/deploy-staging.sh` | ⏳ pending (별도 push 후 실행) |

자동화된 단위/통합 테스트는 본 모듈에 대해 추가하지 않았다 (PLN 4단계는 수동 검증 + smoke 테스트 의존). 후속 작업으로 backlog 등록.

## 4. Regression Impact (회귀 영향 분석)

| 영역 | 영향 | 설명 |
|------|------|------|
| 기존 운영자 로그인 | 없음 | `usr_role` DEFAULT 'ADMIN' — 기존 행 자동 ADMIN |
| 기존 JWT 토큰 | 없음 | 기존 토큰의 `role` 누락 시 strategy 가 'ADMIN' fallback |
| ACM 메뉴 | 추가 3개 — 기존 메뉴 위치/순서 유지 |
| `AcmCurrentUser.roles` | Deprecated 유지 | 기존 코드 호환을 위해 legacy 필드 보존 |

## 5. Known Limits / Follow-ups (한계 / 후속 과제)

1. **초대 이메일 — v2 backlog**: `tac-cal-evt-invitee` 테이블 + 초대 알림은 v2 에서 구현 예정.
2. **CLS 세션 자동 캘린더 노출 — v2**: 현재 `evt_cls_id` 컬럼 + `CLS_SESSION` source 만 스키마에 준비, 자동 머지 로직은 미구현.
3. **자동 화상 미팅 생성 — out of scope**: 사용자 결정에 따라 URL 수동 입력만 지원. Google/Bodaschool API 연동은 별도 ADR 후 검토.
4. **자동 테스트**: tch/stf/cal 모듈 단위/통합 테스트 미작성. 후속 백로그 — `TC-260506-acm-tch-stf-cal` 시나리오 기반 e2e 추가 권장.
5. **번들 크기 경고 (>500 kB)**: 누적 모듈 증가로 vite 가 코드 분할 권고. 별도 최적화 작업 필요.
6. **CAL 일/주 뷰**: 현재 월별 뷰만 제공. 일/주 뷰 + 드래그 리사이즈는 v2 백로그.

## 6. Memory / Document Updates

- 본 보고서가 작업 완료 기록 (메모리 추가는 불필요 — 본 변경은 표준 ACM 모듈 패턴 준수).

## 7. Deploy Procedure (배포 절차)

```bash
# 로컬에서 push 후
ssh appacademy@125.133.49.165 \
  'cd ~/app-academy && git pull --ff-only && nohup scripts/deploy-staging.sh > /tmp/deploy-tch.log 2>&1 &'

# scripts/deploy-staging.sh 가 sql/acm/*.sql 을 ent_id 별로 idempotent 적용
# 신규 4개 SQL (140, 800, 810, 820) 모두 IF NOT EXISTS / DEFAULT 로 안전
```

## 8. Acceptance (인수 기준 매핑)

| AC | 결과 |
|----|------|
| AC-TCH-01 어드민이 교사를 등록·수정·삭제할 수 있다 | ✅ |
| AC-TCH-02 어드민이 교사 계정 ID/PW를 발급할 수 있다 | ✅ (생성 시 옵션 + 편집 시 재설정) |
| AC-TCH-03 비밀번호 정책 (≥8자, 영문+숫자) | ✅ (BE/FE 양쪽) |
| AC-STF-01 어드민이 직원을 등록·수정·삭제할 수 있다 | ✅ |
| AC-STF-02 어드민이 직원 계정을 발급할 수 있다 | ✅ |
| AC-CAL-01 사용자가 캘린더에 이벤트를 등록한다 | ✅ |
| AC-CAL-02 화상 미팅 URL 을 수동 입력할 수 있다 | ✅ (Google Meet/보다스쿨/기타) |
| AC-CAL-03 본인 일정만 편집/삭제 (admin은 모두) | ✅ (CalEventService 검증) |
| AC-CAL-04 외부 소스(CLS_SESSION) 일정은 편집 불가 | ✅ (FE: 비활성, BE: 422) |
| AC-CAL-05 4개 언어 i18n 지원 | ✅ |
