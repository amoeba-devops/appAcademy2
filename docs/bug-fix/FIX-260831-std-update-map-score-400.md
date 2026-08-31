---
document_id: STD-FIX-260831
version: 1.0.0
status: DONE
date: 2026-08-31
change_log:
  - 2026-08-31 v1.0.0 최초 작성 (Claude Code)
---

# FIX-260831 — 학생 수정 저장 400 (범위 밖 MAP 점수 round-trip) / Student Update 400 on Out-of-range MAP Score

## 1. Symptom (증상)

- `/admin/std/9d1347d0-…` 학생 상세에서 **이메일 추가 후 저장 시 400** 발생.
- 모달에는 구체적 원인 없이 "저장에 실패했습니다"만 표시.
- 콘솔: `PUT /api/acm/std/students/:id → 400`.

## 2. Root Cause (원인)

1. **범위 밖 레거시 데이터 round-trip**: 해당 학생의 `std_map_math = 12`.
   `UpdateStudentDto.stdMapMath`는 `@Min(100) @Max(350)` (MAP RIT 범위).
   수정 폼은 기존 값을 전부 되돌려 보내므로, **어떤 필드를 고치든**
   class-validator가 `stdMapMath must not be less than 100` 으로 요청 전체를
   400 거부. 이메일 추가와 무관한 필드가 실제 원인이었다.
   (prod 전수조사: 267명 중 범위 밖 MAP 값 보유 학생은 이 1명뿐)
2. **오류 메시지 미표시**: `GlobalExceptionFilter` 응답은
   `{ error: { code: 'HTTP_400', message } }` 인데 모달은
   `data.error.code`(도메인 코드 기대)와 `data.message`(없음)만 읽어
   항상 generic 메시지로 fallback → 운영자가 원인을 알 수 없었음.

## 3. Fix (수정 내용) — frontend-acm

| File | Change |
|------|--------|
| `std-form-modal.tsx` | MAP 3개 입력(reading/math/language)에 폼 선검증 추가 — 빈 값 허용, 100~350 벗어나면 해당 필드에 `form.error.mapRange` 오류 표시 (서버 DTO와 동일 범위) |
| `std-form-modal.tsx` | 서버 오류 파싱 수정 — `error.message`(string/array) 읽기, `HTTP_400/409` 코드일 때 message에서 도메인 코드(EMAIL_REQUIRED/EMAIL_DUPLICATE) 매칭, fallback으로 서버 검증 메시지 원문 표시 |
| `i18n locales (ko/en/vi/zh-CN) std.json` | `form.error.mapRange` 신규 키 4개 로케일 동시 추가 |

- 백엔드 DTO 제약(100~350)은 의도된 MAP RIT 범위이므로 유지.
- 데이터(12)는 임의 수정하지 않음 — 배포 후 운영자가 수정 모달에서 해당
  필드 오류를 보고 올바른 점수로 수정(또는 비움)하면 저장 가능.

## 4. Verification (검증)

- ts-node + class-validator 재현: `stdMapMath: 12` → `min` 위반 확인.
- prod DB 조회(read-only)로 대상 학생 `std_map_math=12` 및 영향 범위(1/267) 확인.
- `npx tsc --noEmit` 통과. i18n 4 locale 키 추가 확인.
