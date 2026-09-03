---
document_id: CSL-REQ-260903G
version: 1.1.0
status: CONFIRMED (2026-09-03 사용자 확정 "진행")
date: 2026-09-03
change_log:
  - 2026-09-03 v1.1.0 사용자 확정 반영
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code) — A안(상담테이블 직접 입력) 확정 반영
---

# REQ-260903G — 외부 사이트 상담접수 API / External-Site Consultation Intake API

## 1. Overview (개요)

TPI 테넌트는 아임웹에서 3개 사이트를 운영한다 (관리자 계정 `trinityprep103@gmail.com` 단일 소유).

| Site Code | 도메인 | 접수 페이지(신설) |
|---|---|---|
| `TPI` | www.tpi.co.kr | `/contact2` |
| `TRINITY` | trinityacademy.imweb.me | `/contact2` |
| `SANTACROCE` | santacroce.co.kr | 신규 메뉴 페이지 |

각 사이트에 **아임웹 코드 위젯 기반 커스텀 폼 페이지**를 만들고, 폼 제출 시 ACM 이 제공하는 **공개 접수 API** 로 전송하여 상담테이블(`amb_acm_csl_inquiry`)에 **직접 insert** 한다 (A안 — 스테이징 없음, 2026-09-03 사용자 확정).

- 초기 검토했던 아임웹 OpenAPI 폴링 방식(3사이트 × OAuth 토큰 관리)은 **폐기** — 사이트가 3개로 늘며 운영 부담이 커서 push 방식으로 전환.
- 아임웹 코드 위젯은 클라이언트 HTML/JS/CSS 만 지원 → 브라우저 `fetch()` 직접 전송 방식 채택 (서버사이드 불가 확인).

## 2. Current State (현행 조사 결과)

- 공개 접수 선례 존재: `POST /api/web/contact` ([web-inquiry.controller.ts](../../backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts)) — 무인증, `InquiryService.create()` 경유로 채번·PII 암호화·`acm.csl.created` 이벤트(콘솔 실시간 알림, REQ-260903C)가 자동 처리됨.
- **갭 5건**:
  1. `inq_inflow_type` CHECK 가 `HOMEPAGE|KAKAO_CHANNEL|PHONE` 3종뿐 — 외부 사이트 출처 코드 없음 (100-init:216)
  2. CORS 가 `FRONTEND_URL` 단일 origin — 아임웹 3도메인 브라우저 POST 차단됨 (main.ts:19-22)
  3. 공개 POST 보호장치가 전역 스로틀(60/min/IP)뿐 — 캡차·키 검증 전무
  4. `inq_apply_purpose` 는 유효 코드 5종(콤마 조인 TEXT, 120 마이그레이션) — 사이트별 상담희망 항목이 서로 다름
  5. 전역 ValidationPipe `forbidNonWhitelisted` — DTO 외 필드 400
- 미사용 스테이징 테이블 `amb_acm_csl_intake_form` 존재하나 A안 확정으로 **사용하지 않음** (현행 고아 상태 유지).

## 3. Requirements (요구사항)

| ID | 요구사항 |
|----|---------|
| FR-1 | **공개 접수 API 신설**: `POST /api/web/external-intake` — 무인증(JWT 없음), `X-ACM-Site-Key` 헤더로 사이트 식별. 성공 시 `amb_acm_csl_inquiry` 에 직접 insert (`InquiryService.create` 재사용 → 알림·암호화·채번 무수정 공유) |
| FR-2 | **출처 구분**: `inq_inflow_type` 에 `WEB_EXTERNAL` 추가(CHECK 확장 마이그레이션) + 신규 컬럼 `inq_source_site VARCHAR(20)` 에 사이트 코드(`TPI`/`TRINITY`/`SANTACROCE`) 저장. 콘솔 상담 목록·상세에 출처 표시 |
| FR-3 | **사이트별 상담희망 매핑**: 사이트 코드별 `항목 라벨 → apply_purpose 코드` 매핑을 서버 설정으로 관리. 매핑되는 값은 표준 코드(`inq_apply_purpose`), 미매핑 값은 원문 그대로 `inq_apply_purpose_other` 에 보존(유실 금지) |
| FR-4 | **심플 인증/스팸 방어** (사용자 요건: 최대한 심플): ① 사이트 키 헤더 검증(키→사이트 매핑, 불일치 401) ② `Origin` 화이트리스트 검증 ③ 라우트 스로틀 `10req/min/IP` ④ honeypot 필드(`website` — 채워지면 200 응답하되 저장 안 함). 브라우저 발신 특성상 키는 공개값(식별용)이며 기밀 아님을 전제 |
| FR-5 | **CORS 확장**: main.ts origin 을 배열/콜백으로 — 기존 `FRONTEND_URL` + 아임웹 3도메인(env 관리) |
| FR-6 | **필수 입력**: 학생명·연락처·개인정보 수집 동의(`consent=true` 아니면 422). school 미입력 시 `school_freetext` 에 사이트명 폴백 |
| FR-7 | **아임웹 폼 3식**: 각 사이트 코드 위젯용 HTML/JS 폼 템플릿 제공(사이트 키·상담희망 옵션만 상이). 제출 성공/실패 안내 UX 포함 |
| NFR-1 | 콘솔 신규 문자열 i18n 4 locale(ko/en/vi/zh-CN) 동시 반영. 아임웹 폼은 한국어 단일(사이트가 한국어 사이트) |
| NFR-2 | reCAPTCHA 는 범위 외 — 스팸 실측 발생 시 2단계 도입 (스키마 여지는 이미 존재) |

## 4. Out of Scope (범위 외)

- 아임웹 OpenAPI 폴링 연동 (폐기)
- 스테이징/승격(B안) 및 `amb_acm_csl_intake_form` 활성화
- reCAPTCHA v3 (후속)
- 접수 완료 학부모 회신(이메일/알림톡) — 별도 요구 시 진행
