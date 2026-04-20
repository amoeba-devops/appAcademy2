# Trinity Academy 관리 솔루션 — v1.3.0 문서 요약

> **문서 버전**: v1.3.0
> **작성일**: 2026-04-19
> **작성자**: 김익용 (fremdung@gmail.com)
> **목적**: v1.0 → v1.3 진화 과정과 현재 완성된 설계 문서를 개념·설계 관점에서 정리

---

## 1. 프로젝트 개요

**Trinity Academy**(트리니티 아카데미)는 중·고등부 영어·수학 대상 학원의 운영 전반을 디지털화하기 위한 관리 솔루션이다. 기존 imweb(`trinityacademy.imweb.me`) 기반 홍보 사이트와 엑셀(TPI 학생 정보, 수업 확인표)에 분산되어 있던 업무 데이터를 하나의 관리 솔루션으로 통합하고, AMA(아메바) 플랫폼의 교사 마스터·AmoebaTalk 알림 기능과 연계한다.

### 1.1 브랜드 아이덴티티

방패형 Heraldic 문장(T+cross, 왕관, 3성, 페넌트)과 라틴어 표어 **OMNIBUS OMNIA**(모든 이에게 모든 것이 되다 — 고린도전서 9:22)를 중심으로 한다. 팔레트는 Navy `#0E1E3A`, Heraldic Gold `#C9A656`, Cream `#FAF7EE`, Deep Ink `#0B0D14`를 기본으로 하며, AMA 연동 구간에만 Accent `#6F4DB8`을 사용한다. 서체는 디스플레이에 Cormorant Garamond + Noto Serif KR, 본문에 Inter + Pretendard을 조합한다.

### 1.2 기술 스택

프런트엔드는 React 18 + Next.js 14 App Router 단일 모노레포 구조로, `(portal)`·`(admin)` 라우트 그룹으로 학부모 대면 사이트와 내부 관리 화면을 분리한다. 스타일은 Tailwind + shadcn/ui를 사용하고, 디자인 토큰은 Trinity Heraldic Brand System을 따른다. 백엔드는 Next.js Route Handlers(Node 20) + MySQL 8 + RabbitMQ + Redis, 스토리지는 S3 호환 객체 스토리지(MAP 지문·영수증·세금계산서 PDF)를 쓴다. 전 모듈은 Amoeba 표준 SDLC 이중언어(EN/KR) 문서 규칙을 따른다.

---

## 2. 버전 진화 요약

| Version | 날짜 | 핵심 변화 |
|---------|------|-----------|
| v1.0 | 초기 | 프로그램·학생·교사·상담 등 기본 모듈 범위 정의 |
| v1.1 | — | MAP 문제은행·수업시간표 모듈 편입 |
| v1.2 | 2026-04-19 | **Trinity Pay 자체 내재화**(C-003 reverse) — PG 직결, AMA 미경유 |
| **v1.3** | **2026-04-19** | **Q-014/015/018 확정** — Toss Payments + 학원법 수업일 기준 환불 + NTS eTax 자체 발행 |

### 2.1 v1.2 → v1.3 핵심 결정

| Q | 결정 | 문서화된 근거 |
|---|------|---------------|
| **Q-014** — PG 선정 | **Toss Payments** 확정 | FR-040, A-011, FN-100/101, Scenario 10 |
| **Q-015** — 환불 규정 | **수업일(회차) 기준** + 학원법 시행령 제18조 3단계 | FR-041, FR-047, A-012, FN-102/107, PRC-075, Scenario 12 |
| **Q-018** — 세금계산서 | **국세청 홈택스 eTax API 자체 발급** | FR-048, A-013, NFR-013, FN-106, PRC-076, Scenario 13 |

---

## 3. 문서 구성 (v1.3.0 완성본)

프로젝트의 설계 문서는 Amoeba SDLC 규칙에 따라 분석 · 설계 · 구현 · 테스트 단계로 분리되며, 현재 분석·설계 단계까지 완성되어 있다.

### 3.1 분석 단계

**`docs/analysis/academy-management-requirements.md`** (v1.3.0)
기능 요구사항 FR-001 ~ FR-048, 비기능 요구사항 NFR-001 ~ NFR-013, 가정 A-001 ~ A-013, 미결 질문 Q-001 ~ Q-021을 담는다. v1.3에서 신규 편입된 항목은 FR-047(환불 정책 관리), FR-048(세금계산서 자체 발행), NFR-013(학원법·전자세금계산서법 준수)이다.

### 3.2 설계 단계

**`docs/design/academy-management-func-definition.md`** (v1.3.0)
기능 정의서. FN-001 ~ FN-115 범위에서 Trinity Pay 영역이 v1.3에 전면 재작성되었다. FN-100(주문 생성 + refund policy snapshot), FN-101(Toss Confirm + Webhook v2 이중 경로), FN-102(수업일 기준 환불 계산), FN-106(세금계산서 발행, HSM 서명), FN-107(환불 정책 관리자)가 v1.3 신규·재작성분이다.

**`docs/design/academy-management-erd.md`** (v1.3.0)
Entity-Relationship 설계. 총 28+ 개 엔티티 중 Trinity Pay 영역은 v1.3 기준 6 테이블(`payment_orders`, `payment_ledger`, `receipts`, `refund_policies`, `refund_policy_tiers`, `tax_invoices`)로 확장되었다. `payment_orders.refund_policy_version_id`는 주문 시점 정책 snapshot을 보장한다.

**`sql/academy-management-schema.sql`** (v1.3.0)
MySQL 8 DDL. 신규 3 테이블(`refund_policies`, `refund_policy_tiers`, `tax_invoices`)과 학원법 시행령 제18조 기본 4단계 seed(pre-start 100%, 0~1/3 66.67%, 1/3~1/2 50%, 1/2 초과 0%)를 포함한다. `pg_payment_key VARCHAR(200)`, `idempotency_key` unique, `CHECK(total_amount = supply_amount + tax_amount)` 등의 제약을 명시한다.

**`docs/design/academy-management-process.md`** (v1.3.0)
업무 프로세스 문서. PRC-001 ~ PRC-076 범위. 결제·세무 관련은 PRC-070(Toss 11 step 결제 플로우), PRC-075(수업일 기준 환불 계산), PRC-076(NTS eTax 발행 + 익월 10일 시한 배치)로 세분화되었다.

**`docs/design/academy-management-sequence.md`** (v1.3.0)
시퀀스 다이어그램 문서. 13 scenario 구성. Scenario 10(Toss Confirm + Webhook v2 이중 reconciliation), Scenario 12(수업일 기준 환불, tier 산출·Toss 취소·원장 기록), Scenario 13(NTS eTax 발급 + 승인/거절 분기)이 Trinity Pay 영역을 담당한다. **세 scenario 모두 AMA 액터가 등장하지 않는다** — 결제·세무는 AMA 미경유 원칙의 구조적 보장.

**`docs/design/trinity-academy-concept.html`** (v0.2)
시각적 컨셉 구성안. Heraldic Brand System을 적용한 디자인 시안.

---

## 4. 모듈 스코프

v1.3 기준 모듈 8개가 In-scope이다.

1. **Trinity Academy Main Portal** — 학부모 대면, SSG+ISR. 기존 imweb 대체.
2. **프로그램 관리** — Program / Program Setting / Class 3계층.
3. **상담 관리** — Portal intake → Consultation 승격, Visit Record, Conversion.
4. **학생·학부모 등록** — Student + TPI 필드, Parent 1:N Student(`primary_parent_id`) + M:N(`student_guardians`).
5. **교사 등록** — AMA Client 1:1 참조(로컬 중복 저장 금지).
6. **문제은행 MAP** — Passage / Item / TestSet / Assignment / Grading. RC·Math·Language × G2~G5 × Basic/Intermediate/Advanced.
7. **수업시간표** — Class + `class_sessions` 파생 뷰.
8. **Trinity Pay** — 결제·환불·원장·영수증·**세금계산서** 자체 내재화. **PG(Toss) 직결, AMA 미경유.**

### 4.1 AMA 연동 범위

| 항목 | 연동 | 비고 |
|------|------|------|
| 교사 마스터 | ✅ Client 1:1 참조 | 로컬 복제 금지 |
| AmoebaTalk 알림 | ✅ 상담 접수 / 결제 완료 / 환불 완료 / MAP 성적 / 세금계산서 승인 | 발송 채널 한정 |
| **결제·환불·세무 트랜잭션** | ❌ | **AMA 미경유** (C-003 revised @ v1.2, 유지 @ v1.3) |

---

## 5. Trinity Pay 설계 요약 (v1.3 핵심)

### 5.1 결제 플로우

Toss Payments Widget SDK(`@tosspayments/payment-widget-sdk`, v2)를 프런트에 탑재하고, 성공 리다이렉트 시 서버가 `POST /v1/payments/confirm`(Basic Auth + secretKey)으로 승인을 호출한다. 동시에 Toss Payment Webhook v2(HMAC `TossPayments-Signature`)를 reconciliation 채널로 받아 금액 drift·상태 불일치를 감지한다. 멱등성은 `idempotency_key` unique constraint + `payment_orders` FOR UPDATE 락으로 DB 레벨에서 보장한다.

상태 enum은 Toss 규격을 그대로 미러링한다 — `READY / IN_PROGRESS / DONE / CANCELED / PARTIAL_CANCELED / ABORTED / EXPIRED`.

### 5.2 환불 계산

환불은 **수업일(회차) 기준**으로만 계산한다.

```
elapsed_ratio = held_session_count / total_session_count
    where held_session_count = COUNT(class_sessions WHERE status='HELD' AND ended_at ≤ NOW)
```

기본 정책은 **학원법 시행령 제18조 3단계**:

| 단계 | 조건 | 환불율 |
|------|------|--------|
| 0 | 수업 시작 전 | **100%** |
| 1 | `elapsed_ratio ≤ 1/3` | **66.67%** |
| 2 | `1/3 < elapsed_ratio ≤ 1/2` | **50%** |
| 3 | `elapsed_ratio > 1/2` | **0%** |

정책은 `refund_policies`(version) + `refund_policy_tiers`(tier_order)로 버전 관리되고, `payment_orders.refund_policy_version_id`가 주문 시점 snapshot을 고정한다 — **정책 개정은 소급 적용되지 않는다.**

환불 금액은 `FLOOR(payment_amount × refund_rate)`로 산출되며, Toss `POST /v1/payments/{paymentKey}/cancel`로 실제 취소 후 `payment_ledger`에 `refund_tier_id`·`elapsed_ratio_at_refund`를 감사 필드로 남긴다.

### 5.3 세금계산서 발행

국세청 홈택스 **전자세금계산서 발급 API** 직결 방식으로, 팝빌·바로빌 등 중계 SaaS는 채택하지 않는다. XMLDSig 서명용 공동인증서는 서버 HSM/KMS에 보관하고, 만료 30일 전 알림(NFR-013)을 의무화한다.

`tax_invoices` 테이블은 DRAFT → SUBMITTED → APPROVED / REJECTED 생명주기를 추적하며, NTS 24-char `nts_issue_no`와 XML/PDF S3 URL을 저장한다. 공급 익월 10일 법정 시한을 놓치지 않도록 익월 5일 시점에 배치 경고가 발송된다.

### 5.4 Receipt vs Tax Invoice 분리

`receipts` 테이블은 **간이·현금영수증** 전용으로 범위를 축소했고, 개인정보보호를 위해 `buyer_identifier`는 `VARBINARY(128)` 암호화 저장한다. 전자세금계산서는 별도 `tax_invoices` 테이블로 분리되었는데, NTS 생명주기(XML payload, 제출·승인 타임스탬프, 거절 코드/메시지)가 단순 영수증 모델과 맞지 않기 때문이다.

---

## 6. 데이터 모델 (v1.3 Trinity Pay 기준)

| Table | 역할 | 핵심 컬럼 |
|-------|------|-----------|
| `payment_orders` | 결제 주문(주문번호·상태·Toss paymentKey·정책 snapshot) | `order_no`, `pg_provider='TOSS'`, `pg_payment_key VARCHAR(200)`, `status`, `refund_policy_version_id` FK, `canceled_at` |
| `payment_ledger` | 결제·환불 원장 분개 | `ledger_type`, `amount`, `refund_tier_id` FK, `elapsed_ratio_at_refund` |
| `refund_policies` | 환불 정책 버전 | `version`, `basis='SESSION'`, `effective_from/to`, `is_default_template` |
| `refund_policy_tiers` | 정책 단계 | `tier_order`, `elapsed_ratio_min/max`, `refund_rate` (CHECK min<max, rate ∈[0,1]) |
| `receipts` | 간이·현금영수증 | `receipt_type`, `cash_receipt_no`, `buyer_identifier VARBINARY(128)` |
| `tax_invoices` | 전자세금계산서 | `invoice_no`, `nts_issue_no`, `supplier/buyer_biz_no`, `supply_amount`, `tax_amount`, `status`, `xml_payload_url`, `pdf_url` |

---

## 7. 준수 요건 (NFR)

| NFR | 요건 | 구현 지점 |
|-----|------|-----------|
| NFR-011 | **PCI-DSS SAQ-A** — 카드 PAN·CVC 저장 금지, Toss 토큰만 보관 | `pg_payment_key`만 저장, 카드 필드 미존재 |
| NFR-013 | **학원법·전자세금계산서법 준수** — 기본 정책이 학원법 하한 미달 불가, 공급 익월 10일 시한 경고, 공동인증서 만료 30일 전 알림 | FN-107 validation, PRC-076 batch, HSM 운영 |

---

## 8. 미결 사안 (다음 세션에서 결정)

| Q | 주제 | 논점 |
|---|------|------|
| **Q-019** | **Toss Brandpay 자동결제** | 월납 정기결제용 Brandpay 도입 여부. 현재는 수동 결제 가정. |
| **Q-020** | **위약금(cancellation fee)** | 부과 여부·산식. 학원법은 상한만 규정하고, 학원 자율 정책 영역. |
| **Q-021** | **공동인증서 보관 방식** | HSM 온프레 / AWS KMS / CloudHSM 중 택1. NFR-013 만료 알림 주기와 함께 결정. |

---

## 9. 참조 자료 (운영 실무 grounding)

설계는 추상적 요구사항이 아닌 실제 운영 파일의 필드·관행에 grounding 되어 있다.

- `TPI 학생 정보.xlsx` — 학생 마스터, 4 시트(활성 / 종료 / 구버전 / 상담).
- `수업 확인표.xlsx` — 월별 15 시트, 교사별 수업 회차 기록. 색상 규약: 초록=진행, 빨강=결강.
- `[기출] MAP RC G2-5_Basic_저용답.pdf` + `_Answers.pdf` — Passage 1/2, 복수 정답, Part A-B 구조.
- `trinityacademy.kr` — 기존 imweb 포털, v1.2 이후 Next.js 자체 호스팅으로 대체 예정.

---

## 10. 다음 단계

1. **미결 Q-019/020/021 결정** — Brandpay, 위약금 정책, 공동인증서 보관 방식.
2. **구현 단계 진입** — WBS 작성, GitHub Projects 연동, 스프린트 0 플래닝.
3. **테스트 시나리오 확장** — 수업일 기준 환불·세금계산서 REJECTED 재시도·Webhook drift 등 엣지 케이스.
4. **브랜드 시스템 확정** — Heraldic 문장 베타 버전을 최종 디자인으로 승격.
