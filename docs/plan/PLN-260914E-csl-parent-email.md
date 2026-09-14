---
document_id: CSL-PLN-260914E
version: 1.0.0
status: IMPLEMENTED (미배포)
date: 2026-09-14
depends_on: docs/analysis/REQ-260914E-csl-parent-email.md
change_log:
  - 2026-09-14 v1.0.0 구현 완료 — DTO·암호화 컬럼·상세 표시·스니펫 3종 (Claude Code)
---

# PLN-260914E — 상담 학부모 이메일 / Implementation Plan

## 1. 구성

```
아임웹 폼(3사이트)  ──parentEmail──▶  POST /api/web/external-intake
                                        ExternalIntakeDto (optional, @IsEmail)
                                             │
                                     InquiryService.create
                                        AES-GCM 암호화
                                             ▼
                     amb_acm_csl_inquiry.inq_parent_email_{encrypted,iv,auth_tag}
                                             │
                                     toView() 복호화
                                             ▼
                          관리자 상담 상세 · 접수 단계 패널 "학부모 이메일"
```

## 2. 변경 내역

| # | 작업 | 파일 |
|---|---|---|
| 1 | 암호화 컬럼 3종 추가 (idempotent) | `sql/acm/999n-csl-inquiry-parent-email.sql` |
| 2 | 엔티티 컬럼 매핑 | `inquiry.typeorm-entity.ts` |
| 3 | `CreateInquiryDto.parentEmail` (`@IsOptional @IsEmail @MaxLength(200)`) | `dto/inquiry.dto.ts` |
| 4 | create 암호화 저장 / update 갱신·해제 / `toView` 복호화 노출 | `inquiry.service.ts` |
| 5 | `ExternalIntakeDto.parentEmail` + create 로 전달 | `external-intake.controller.ts` |
| 6 | 통합테스트 스키마 목록에 999n 등록 (없으면 inquiry INSERT 가 깨진다) | `test/integration/acm/setup.ts` |
| 7 | 상담 상세에 `학부모 이메일` 행 | `csl/components/intake-stage-panel.tsx` |
| 8 | 콘솔 직접 등록 폼에 이메일 입력 + zod 검증 | `csl/components/csl-create-dialog.tsx` |
| 9 | i18n ko/en/vi/zh-CN | `i18n/locales/*/csl.json` |
| 10 | 스니펫 3종 — `연락처` → `전화번호` + `이메일`, 검증·payload 반영 | `docs/implementation/snippets/external-intake-form-{tpi,trinity,santacroce}.html` |

## 3. 검증

| 항목 | 결과 |
|---|---|
| backend `tsc` | ✅ |
| backend `jest` | ✅ 504 passed (신규 2건 — 이메일 전달 / 이메일 없는 사이트 하위호환) |
| frontend `tsc` + `vite build` | ✅ |
| 로컬 `db_acm` 마이그레이션 | ✅ 컬럼 3종 생성 확인 |

## 4. 배포 후 확인

1. `www.tpi.co.kr/contact2` 에서 실제 접수 → 201 확인
2. `/admin/csl` 상세에서 이메일 표시 확인
3. TRINITY / SANTACROCE 는 아임웹 폼 교체 시 저장소 스니펫을 그대로 사용
   (이메일 칸이 없는 동안에도 접수는 정상 동작 — optional)
