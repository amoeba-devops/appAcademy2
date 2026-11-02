---
document_id: PLN-261102
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-02 v1.1.0 — implemented
  - 2026-11-02 v1.0.0 — initial plan
---

# PLN-261102 Monthly list quick amount & paid-in-full — Work Plan (작업 계획)

## 1. Screen Layout (화면 구성안)
```
◀ 2026-09 ▶ [이번 달] [전체 사이트 ▼]        ← 미지정 학생 없음
[학생 검색] [범위▼] [상태▼] [엑셀]
│번호│학생이름│사이트│…│   청구액 │할인액│실납부액│ 미납금│환불금│ 상태                               │ 청구 │
│ 1 │김하늘  │TPI  │…│  450,000 │    0│      0│450,000│    0│ 미납 [완납]                         │[청구]│
│   │        │     │ │          │     │       │       │     │  → 450,000 [11-02] [계좌▼] [완납 처리] [취소]  │
│ 2 │박서윤  │TRIN.│…│ [400000▮]│    —│      —│      —│    —│ 미청구 [청구액 입력]                 │[청구]│  ← 금액 칸 클릭 = 입력칸, Enter 저장
```

## 2. Implementation (구현)
| # | File | 변경 |
|---|------|------|
| 1 | backend `acm-pay/application/monthly-pay.ts` | `siteMatches` ALL=사이트 있는 기록, 사이트별 표에서 UNASSIGNED 제거 + 단위 테스트. |
| 2 | `pay/monthly-quick.tsx`(신규) | `QuickAmount`(청구액 입력·저장), `PayInFull`(미납액 수납 기록). |
| 3 | `pay/monthly-payment-view.tsx` | 월별 목록 행에 위 컴포넌트, 마지막 열 [청구]. |
| 4 | i18n 4 locale | 청구액 입력·완납 문구. |

## 3. Result (결과) — 2026-11-02
- 단위 테스트 15·통합 테스트 8 통과.
- 로컬(빈 DB + sql/acm 전체, 9월): 사이트 없는 학생 목록 제외, 박서윤 [청구액 입력] 400,000 Enter → 청구 생성·미납, 김하늘 [완납] → [완납 처리] → 실납부 450,000·완납.
- 마이그레이션 없음.
