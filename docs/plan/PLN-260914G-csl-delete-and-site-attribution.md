---
document_id: CSL-PLN-260914G
version: 1.0.0
status: IMPLEMENTED (미배포)
date: 2026-09-14
depends_on: docs/analysis/REQ-260914G-csl-delete-and-site-attribution.md
change_log:
  - 2026-09-14 v1.0.0 구현 완료 (Claude Code)
---

# PLN-260914G — 상담 삭제 · 대시보드 사이트 귀속 / Implementation Plan

## 1. 구성

```
삭제        콘솔 UI(목록·상세, AMA 계정에만 노출)
            → DELETE /acm/csl/inquiries/:id   [AcmJwtAuthGuard → AmaAccountGuard]
            → soft delete (deleted_at)
            → '삭제 목록 보기' = GET /acm/csl/inquiries?deletedOnly=true
            → POST /acm/csl/inquiries/:id/restore

사이트 귀속  목록 셀렉트 → PATCH /acm/csl/inquiries/:id { siteOverride }
            → InquiryService.update 가 변경 감지
            → emit 'acm.csl.site_attribution.changed' { entId, date }
            → acm-dsh CslSiteAttributionListener → DailyKpiService.recomputeDay
```

## 2. 변경 내역

| # | 작업 | 파일 |
|---|---|---|
| 1 | `auth_source` 를 세션·로그인 응답에 노출 | `acm-auth.service.ts`, `acm-jwt.strategy.ts`, `current-user.decorator.ts` |
| 2 | `AmaAccountGuard` 신설 + 삭제/복구에 적용 | `acm-common/guards/ama-account.guard.ts`, `inquiry.controller.ts` |
| 3 | 목록 `deletedOnly` 필터 (`withDeleted()` + `deleted_at IS NOT NULL`) | `inquiry.service.ts`, `inquiry.controller.ts` |
| 4 | 사이트 귀속 변경 시 이벤트 발행 (등록일 변경 시 이전·새 날짜 모두) | `inquiry.service.ts` |
| 5 | 재계산 리스너 — 실패는 삼킨다(야간 배치가 수렴) | `acm-dsh/application/csl-site-attribution.listener.ts` |
| 6 | 목록: `대시보드 사이트` 열 + 삭제/복구 열 + '삭제 목록 보기' 토글 | `csl-list-page.tsx` |
| 7 | 상세: 헤더 [삭제] | `csl-detail-page.tsx` |
| 8 | 스토어에 `authSource` | `stores/auth.store.ts` |
| 9 | i18n ko/en/vi/zh-CN | `i18n/locales/*/csl.json` |
| 10 | 테스트 6건 | `ama-account.guard.spec.ts`, `csl-site-attribution.listener.spec.ts` |

## 3. 설계 메모

- **행 클릭과의 충돌** — 목록 행은 클릭 시 상세로 이동한다. 사이트 셀렉트·삭제
  버튼 셀은 `stopPropagation` 으로 상세 이동을 막는다.
- **역할 제한 없음** — 요구가 "AMA 접속 사용자" 였으므로 role 은 보지 않는다.
  따라서 AMA 연동 TEACHER 계정도 삭제할 수 있다. 소프트 삭제라 복구 가능하지만,
  운영 정책상 좁히려면 `@Roles('ADMIN','STAFF')` 를 한 줄 추가하면 된다.
- **재계산 실패 처리** — 상담 수정 트랜잭션을 되돌리지 않는다. 다음 야간 배치가
  같은 날짜를 다시 계산한다.

## 4. 검증

| 항목 | 결과 |
|---|---|
| backend `tsc` + `jest` | ✅ 512 passed (신규 6) |
| frontend `tsc` + `vite build` | ✅ |

## 5. 배포 후 확인

1. **AMA 계정**으로 로그인 → 목록·상세에 [삭제] 노출 / 로컬 계정에는 미노출
2. 삭제 → 목록에서 사라짐 → [삭제 목록 보기] → [복구] → 원복
3. 목록에서 사이트 지정 → 대시보드 해당 날짜 상담건수가 **즉시** 이동
