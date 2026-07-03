---
document_id: APP-ACADEMY-LISTING-1.0.0
version: 1.0.0
status: Draft
created: 2026-04-27
audience: AMA App Store submission team
---

# AMA App Store — `app-academy` Listing Metadata (등재 자료)

S5-6 산출물. AMA App Store 마켓 팀에 제출하는 등재 자료 마스터.

---

## 1. App Identity (앱 정보)

| Field | Value |
|-------|-------|
| **App ID** | `app-academy` |
| **Display Name (KR)** | 학원관리앱 |
| **Display Name (EN)** | app-academy |
| **Vendor** | Amoeba |
| **Version** | 1.0.0 |
| **Category** | 교육 / 학원 운영 |
| **Pricing Model** | 월 구독 (`basic` / `pro`) — 가격은 AMA 측 결정 |
| **Tenant Domain Pattern** | `app-academy.amoeba.site` (단일 호스트, 학원별 멤버십) |
| **Required Permissions** | AMA 사용자 프로필 (email, name, role), 교사 마스터 read |
| **Webhook Endpoint** | `POST https://app-academy.amoeba.site/api/webhooks/ama/subscription` |
| **SSO Token Exchange** | `POST https://app-academy.amoeba.site/api/acm/auth/ama-exchange` (HS256 JWT passthrough) |

---

## 2. Tagline (한 줄 소개)

- **KR**: 상담부터 결제까지 — 학원 운영 한 곳에서.
- **EN**: From counseling to payment — academy ops in one place.

## 3. Description (상세 설명)

### KR (300자)
중·고등부 학원의 일상 운영을 디지털화하는 다중 테넌트 SaaS입니다. AMA App Store에서 클릭 한 번으로 학원을 등록하면, 학부모 상담 접수부터 수강 등록·시간표·MAP 평가·Toss 결제·세금계산서 발행까지 한 콘솔에서 처리할 수 있습니다. 교사 마스터는 AMA와 자동 동기화되며, 알림은 AmoebaTalk으로 발송됩니다. 환불 규정은 학원법 제18조 4단계 정책이 기본 적용됩니다.

### EN (300 chars)
A multi-tenant SaaS that digitizes day-to-day academy operations. Provision your academy from the AMA App Store with one click, then manage parent intake, enrollments, timetables, MAP assessments, Toss Payments, and tax invoices from a single console. Teacher rosters sync automatically with AMA; notifications go out via AmoebaTalk. The Korean Academy Act §18 four-tier refund policy is preset out of the box.

## 4. Feature Bullets (5개)

1. **AMA SSO 한 번 로그인** — 클라이언트(교사) 마스터와 자동 연동
2. **상담→등록→수업→결제 단일 워크플로우** — 엑셀 의존 0
3. **Toss Payments PG 직결** — 환불·영수증·세금계산서 자동화
4. **MAP 문제은행 + 자동 채점** — Passage / Item / TestSet 3계층
5. **멀티테넌트 안전 격리** — `acd_id` 기반 행 단위 데이터 차단

## 5. Screenshots (필수 5종)

> 각 1920×1200 PNG, 한국어 UI. `docs/appstore/screenshots/` 에 저장.

| # | Filename | Caption (KR) |
|---|----------|--------------|
| 1 | `01-dashboard.png` | 운영 대시보드 — 등록·수강·미수금 KPI |
| 2 | `02-consultations.png` | 상담 접수 → 방문 → 등록 전환 |
| 3 | `03-enrollments.png` | 수강 등록 / 환불 정책 4단계 |
| 4 | `04-timetable.png` | 시간표 자동 생성 / 충돌 검증 |
| 5 | `05-payments.png` | Toss 결제 + 영수증 발행 |

## 6. Demo Account (심사용 계정)

| Field | Value |
|-------|-------|
| URL | https://acm-stg.amoeba.site/admin/login |
| ID | `reviewer@amoeba.site` |
| Password | (별도 안전 채널로 전달) |
| Tenant | "Trinity Academy (Demo)" — 읽기 전용 시연 데이터 |

> 데모 데이터는 [scripts/export-demo-seed.sh](../../scripts/export-demo-seed.sh)로 매주 갱신. 결제·세금계산서는 Toss 샌드박스만 호출됨.

## 7. Support (지원)

| Channel | Value |
|---------|-------|
| Support Email | support@amoeba.site |
| Documentation | https://app-academy.amoeba.site/docs (출시 후 공개) |
| Status Page | https://status.amoeba.site (예정) |
| SLA | Business-hour response (KST 09–18, Mon–Fri) |

## 8. Legal (법적 고지)

| Document | URL |
|----------|-----|
| Terms of Service | https://app-academy.amoeba.site/legal/terms |
| Privacy Policy | https://app-academy.amoeba.site/legal/privacy |
| Subprocessors | https://app-academy.amoeba.site/legal/subprocessors |
| Business Operator | (사업자등록증 사본 별첨) |

> ToS / Privacy / Subprocessors 본문은 [docs/appstore/legal/](legal/) 에 마스터 보관.

---

## 9. Submission Checklist (제출 전 점검)

- [ ] §1 App Identity 모든 URL이 production DNS 적용 후 200 응답
- [ ] §5 스크린샷 5종 캡션 + 워터마크 (학원명 가린 demo 데이터)
- [ ] §6 데모 계정 생성 + reviewer 권한이 OWNER가 아닌 ADMIN 이하
- [ ] §8 ToS / Privacy / Subprocessors 본문 법무 검토 완료
- [ ] AMA Ops 측 Webhook 시크릿 + Custom App SSO HS256 JWT 시크릿 발급 완료
- [ ] [docs/test/UAT-CHECKLIST.md](../test/UAT-CHECKLIST.md) 전 항목 PASS
