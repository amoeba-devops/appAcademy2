---
document_id: CSL-PLN-260903G
version: 1.1.0
status: DONE (2026-09-03 구현 완료)
date: 2026-09-03
depends_on: docs/analysis/REQ-260903G-external-intake-api.md
change_log:
  - 2026-09-03 v1.1.0 구현 완료 — 로컬 e2e 5시나리오(정상 접수/401/403/honeypot 미저장/consent 400) 통과, 1010 멱등 재실행 확인, acm-csl spec 전건 + 신규 컨트롤러 spec 8건 통과, frontend build 통과
  - 2026-09-03 v1.0.0 최초 작성 (Claude Code)
---

# PLN-260903G — 외부 사이트 상담접수 API 작업 계획 / Work Plan

## 1. UI Layout (화면 구성안)

### 1.1 아임웹 `/contact2` 커스텀 폼 (코드 위젯 — 3사이트 공통 골격, 사이트 키·상담희망 옵션만 상이)

```
┌─ 상담 신청 ─────────────────────────────────┐
│ 학생 이름*      [____________]               │
│ 학부모 성함     [____________]               │
│ 연락처*        [010-____-____]               │
│ 학교 / 학년     [__________] [학년 ▼]        │
│ 상담희망 항목*  ☐ MAP 테스트 대비            │  ← 사이트별 옵션 상이
│                ☐ ISEE 대비                  │     (TPI/TRINITY/SANTACROCE
│                ☐ 국제학교 준비               │      각각의 라벨 세트)
│                ☐ 기타: [____________]        │
│ 문의 내용       [________________________]   │
│                [________________________]   │
│ ☐ 개인정보 수집·이용 동의* (보기)            │
│         [ 상담 신청하기 ]                    │
│  ✓ 접수되었습니다. 확인 후 연락드리겠습니다.  │  ← 성공/실패 인라인 안내
└─────────────────────────────────────────────┘
(숨김) website [honeypot], siteKey 는 JS 상수
```

### 1.2 콘솔 상담 목록 — 출처 표시 (frontend-acm `/admin` 상담관리)

```
│ #124 김민준  중2  010-****-1234  [웹·TPI]      INTAKE │
│ #123 이서연  고1  010-****-5678  [웹·산타크로체] INTAKE │
│ #122 박지훈  중3  010-****-9012  [홈페이지]     MAP_TEST │
                      ↑ 유입경로 뱃지: WEB_EXTERNAL 은 사이트명 병기
상세 패널: 유입경로 "외부 웹 (TPI)" · 상담희망(미매핑 항목은 '기타'에 원문 표시)
```

## 2. DB (sql/acm/1010-csl-external-intake.sql)

| # | 내용 |
|---|------|
| D1 | `inq_inflow_type` CHECK 재생성 — `WEB_EXTERNAL` 추가 (DROP CONSTRAINT + ADD, 멱등 `IF EXISTS` 패턴) |
| D2 | `ADD COLUMN IF NOT EXISTS inq_source_site VARCHAR(20)` (nullable — 기존 행 NULL 유지) |

※ csl 테이블은 `inq_` 접두어·공용 `created_at` — cls 계열(`cls_created_at`) 함정과 무관. 로컬 db_acm 은 수동 적용, staging/prod 는 CD 자동 적용.

## 3. Backend (acm-csl)

| # | 항목 | 내용 |
|---|------|------|
| B1 | env/설정 | `ACM_INTAKE_SITE_KEYS` = `TPI:<key>,TRINITY:<key>,SANTACROCE:<key>`, `ACM_INTAKE_ORIGINS` = 3도메인 CSV. 파서+사이트 정의(코드·표시명·origin·상담희망 라벨→코드 매핑)는 `external-intake.config.ts` 상수 |
| B2 | DTO | `ExternalIntakeDto` — name*, phone*, parentName?, schoolFreetext?, grade?, applyPurposeLabels?[] (원문 라벨), message?, consent* (boolean, `@Equals(true)`), website? (honeypot). `forbidNonWhitelisted` 대응 완결 정의 |
| B3 | Controller | `external-intake.controller.ts` — `@Controller('web')` `@Post('external-intake')`, 가드 없음, `@Throttle 10/min`. 검증 순서: honeypot(채워짐→ 즉시 200, 저장 skip) → `X-ACM-Site-Key` 매핑(실패 401, 존재 비노출) → Origin 화이트리스트(실패 403) → 라벨 매핑(매핑→`applyPurposes` 코드, 미매핑→`applyPurposeOther` 원문 join) → `InquiryService.create(DEFAULT_ENT_ID, { inflowType:'WEB_EXTERNAL', sourceSite, applyType:'COUNSELING_ONLY', schoolFreetext: 입력값∥사이트표시명, followupMemo: message, … })` |
| B4 | Service/Entity | `InquiryTypeormEntity` + DTO 에 `sourceSite` 필드 추가, `InquiryService.create` 저장·응답 매핑 1줄씩. inflow 허용값 검증에 `WEB_EXTERNAL` 반영 |
| B5 | CORS | main.ts `origin: [FRONTEND_URL, ...ACM_INTAKE_ORIGINS]` 배열화 (credentials 정책 현행 유지) |
| B6 | 알림 | 추가 작업 없음 — `acm.csl.created` 이벤트 경유 콘솔 SSE 토스트 자동 |

## 4. Frontend (frontend-acm — 콘솔)

| # | 항목 | 내용 |
|---|------|------|
| F1 | 유입경로 표시 | csl 목록/칸반/상세의 inflow 라벨 맵에 `WEB_EXTERNAL` 추가, `sourceSite` 있으면 사이트명 병기 뱃지 |
| F2 | i18n | `csl.json` 4 locale — `inflow.WEB_EXTERNAL`, 사이트명(`sourceSite.TPI` 등) 키 추가 |

## 5. imweb 폼 (deliverable — 코드 위젯 삽입용)

| # | 항목 | 내용 |
|---|------|------|
| W1 | 템플릿 | `docs/implementation/snippets/external-intake-form-{tpi,trinity,santacroce}.html` — 단일 파일(HTML+CSS+JS), `fetch POST` + 성공/실패 인라인 메시지, 연락처 형식 검사, 이중 제출 방지 |
| W2 | 적용 안내 | 아임웹 관리자에서 `/contact2` 페이지 생성 → 코드 위젯 붙여넣기 절차를 스니펫 상단 주석으로 포함 |

## 6. Order & Verification (순서·검증)

1. D1–D2 로컬 적용 → B1–B5 → `tsc` + acm-csl spec (+ 컨트롤러 신규 spec: 키/Origin/honeypot/consent 4분기)
2. 로컬 e2e: `curl` 로 정상 접수 → 콘솔 목록 `[웹·TPI]` 표시·SSE 토스트 수신 확인 / 키 오류 401 / Origin 위반 403 / honeypot 200-미저장 / 미매핑 라벨 → 기타 보존 확인
3. F1–F2 → build → 콘솔 표시 확인 → PR
4. 배포 후: 실사이트 3곳 코드 위젯 삽입(운영자 작업, W2 안내) → 사이트당 실제 제출 1건 스모크

리스크: ① 공개 엔드포인트 스팸 — 스로틀+honeypot+consent 로 1차 방어, 실측 발생 시 reCAPTCHA 후속(REQ NFR-2) ② CORS 배열화가 기존 프론트 요청에 영향 없도록 FRONTEND_URL 을 배열 첫 요소로 유지 ③ 아임웹 코드 위젯은 아임웹 미지원 영역(자체 책임) — 폼 JS 는 외부 라이브러리 없이 vanilla 로 작성. 예상 규모: SQL 1 · 백엔드 ~6파일 · 프론트 ~4파일 · 스니펫 3.
