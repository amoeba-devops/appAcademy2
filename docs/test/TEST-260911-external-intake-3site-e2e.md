---
document_id: CSL-TEST-260911
version: 1.0.0
status: DONE
date: 2026-09-11
related: docs/implementation/GUIDE-260903G-imweb-apply.md, docs/bug-fix/FIX-260911-external-intake-site-key-empty-env.md, PR #193, PR #205, PR #206
change_log:
  - 2026-09-11 v1.0.0 3사이트 실제 제출 → ACM 콘솔 등록 검증 결과 (Claude Code)
---

# TEST-260911 — 아임웹 3사이트 접수 → ACM 등록 E2E 검증 / External Intake 3-Site E2E Test Report

## 1. Scope (범위)

GUIDE-260903G 3.3절 "제출 테스트"의 실행 결과. 아임웹 3사이트에 게시된 코드 위젯 폼에서 시크릿 창으로 실제 제출하고, 운영 ACM 콘솔(https://acm.amoeba.site/admin/csl)에 정상 등록되는지 확인한 뒤 테스트 행을 상담종료 처리했다.

| 항목 | 값 |
|---|---|
| 운영 backend | PR #205 (2b698f6) — cd-production 2026-09-11 16:33Z (FIX-260911 반영) |
| 제출 환경 | Chrome 시크릿 창, macOS, 2026-09-11 (KST 자정 전후) |
| 콘솔 확인 | ACM 콘솔 로그인 후 상담 목록·상세 화면 (Orca 접근성 트리 기준) |
| DB 직접 조회 | 미실시 (운영 SSH 미허용) — 콘솔 화면에 표시된 값 기준으로 판정 |

## 2. Pre-check (선행 프로브 — 행 생성 없이 키/오리진 검증)

| 요청 | 기대 | 결과 |
|---|---|---|
| `tpi-8c094fefd4fd2314` + `Origin: https://not-allowed.example` | 403 origin not allowed | ✅ 403 |
| `trinity-51c0c40bd70ba964` + 동일 | 403 | ✅ 403 |
| `santacroce-93d05af5a571f33a` + 동일 | 403 | ✅ 403 |
| `dev-intake-tpi` (dev 기본 키) | 401 invalid site key | ✅ 401 |
| CORS preflight `https://trinityacademy.kr`, `http://www.tpi.co.kr` | ACAO 반영 | ✅ 반영 |

## 3. Submission → Console Result (제출 → 콘솔 등록 결과)

입력값(공통): 연락처 `010-0000-0000`, 문의 내용 `ACM 외부접수 연동 테스트(<사이트>) - 확인 후 상담종료 처리`, 개인정보 동의 체크, 상담희망은 첫 항목 + 마지막 항목 선택.

| 사이트 / 페이지 | 폼 응답 | 콘솔 No. | 유입(Source) | 학생 / 학년 / 학부모 | 상담희망 (코드 매핑) | 단계 | 처리 |
|---|---|---|---|---|---|---|---|
| TPI `www.tpi.co.kr/contact2` | 접수되었습니다 | #19 | External Web (TPI) / school `TPI 웹 접수` | 테스트_ACM연동_TPI / 중2 / 테스트학부모 | MAP Test Tutoring, Advanced courses | 1. Intake | 상담종료(단순문의종료) ✅ |
| TPI (재제출 — 주석 1) | 접수되었습니다 | #20 | External Web (TPI) | 테스트_ACM연동_TRINITY / 중2 / 테스트학부모 | MAP Test Tutoring, Advanced courses | 1. Intake | 상담종료 ✅ |
| TRINITY `trinityacademy.kr/contact2` | 접수되었습니다 | #21 | External Web (Trinity) / school `트리니티 웹 접수` | 테스트_ACM연동_TRINITY / 중2 / — (폼에 학부모 항목 없음) | Intl./foreign school admission prep (인가 국제학교 → `INTL_SCHOOL_PREP`) | 1. Intake | 상담종료 ✅ |
| SANTACROCE `santacroce.co.kr/consult` | 접수되었습니다 | #22 | External Web (Santa Croce) / school `산타크로체 웹 접수` | 테스트_ACM연동_SANTACROCE / — / — (폼에 학년·학부모 항목 없음) | Intl./foreign school admission prep (외국인·국제학교 컨설팅) | 1. Intake | 상담종료 ✅ |

주석 1: 테스트 드라이버의 페이지 이동 실패로 TPI 폼에 TRINITY 라벨 데이터가 한 번 더 제출됨(#20). 정상 등록 자체는 확인되므로 결과에 포함하고 종료 처리했다.

검증 통과 항목:
- 폼 인라인 검증(이름 미입력 → "이름을 입력해 주세요.", 동의 미체크 → "개인정보 수집·이용 동의가 필요합니다.") 동작 확인.
- 4건 모두 `inflowType=WEB_EXTERNAL` + `sourceSite` 로 저장되어 목록·상세에 "External Web (사이트명)" 표시, 연락처 `(Provided)`, 등록일 9/11/2026, 단계 `1. Intake`.
- 표준 코드 매핑: TPI 5항목 중 선택 2개, TRINITY 인가 국제학교, SANTACROCE 외국인·국제학교 → 기대 코드로 체크 표시.
- 상담종료: 상세 "End consultation" → 기본 사유 "Simple inquiry closed" → 타임라인 `1. Intake → Completed (CANCEL)`, Reactivate 버튼 노출.

## 4. Findings (발견 사항)

| # | 구분 | 내용 | 영향 | 제안 |
|---|---|---|---|---|
| F-1 | 콘솔 UI 갭 | **미매핑 상담희망 원문(`applyPurposeOther`)이 콘솔 어디에도 표시되지 않는다.** backend view 는 `applyPurposeOther` 를 반환하지만 `frontend-acm/src` 에 참조가 없음. TRINITY "All in One 입학 준비 컨설팅…", SANTACROCE "교육 대리인 서비스" 는 화면상 유실처럼 보인다 (GUIDE 1절 "상세 화면에서 확인" 과 불일치). | 운영자가 비표준 상담희망을 볼 수 없음 | `intake-stage-panel.tsx` Apply purposes 블록 아래에 "기타(원문)" 행 추가 + 목록 Apply purpose 셀에 병기 |
| F-2 | 콘솔 UI 갭 | **문의 내용(`followupMemo`)이 Intake 단계 화면에 표시되지 않는다.** `class-status-summary-panel` 에서만 렌더. 상세 Activity timeline 은 "No activity yet." | 접수 시 학부모가 쓴 문의 내용을 상담 단계에서 못 봄 | Intake 패널에 "문의 내용" 행 추가 (또는 timeline 첫 항목으로 노출) |
| F-3 | 미검증 | 실시간 알림 토스트(GUIDE 3.3-8)는 제출 시점에 콘솔 로그인 상태가 아니어서 확인 못 함 | — | 다음 실제 접수 시 확인 |
| F-4 | 운영 | 3사이트 새 페이지가 상단 메뉴에 노출 중. 기존 폼 페이지와의 메뉴 교체(3.4절)는 미실시 | 잠시 두 폼 병존 | 오픈 판단 후 교체 |
| F-5 | 운영 | `tpi.co.kr`, `trinityacademy.kr` 은 imweb HTTPS 강제가 꺼져 있음 (코드에서 http origin 허용으로 보완) | — | imweb 도메인/SSL 설정에서 HTTPS 강제 ON 권장 |

## 5. Verdict (판정)

**PASS** — 3사이트 폼 제출이 운영 ACM 상담테이블에 출처·학생·연락처·표준 상담희망 코드까지 정상 등록된다. 단, F-1/F-2 는 저장은 되나 콘솔에서 보이지 않는 표시 결함이므로 별도 수정 작업(REQ)을 권고한다.

## 6. Reproduce (재현 방법)

1. 행 생성 없이: 유효 키 + `Origin: https://not-allowed.example` POST → 403 이면 키/배포 정상.
2. 시크릿 창에서 각 페이지 제출 → 콘솔 `/admin/csl` 목록에서 유입 "External Web" 필터 → 상세 확인 → End consultation(Simple inquiry closed).
