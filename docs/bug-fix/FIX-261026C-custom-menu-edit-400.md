---
document_id: FIX-261026C
version: 1.0.0
status: FIXED
change_log:
  - 2026-10-26 v1.0.0 — custom menu edit always failed (400)
---

# FIX-261026C Custom menu edit always fails — role visibility not saved (사용자 메뉴 수정 400 — 노출 등급 지정 오류)

## 1. Symptom (증상)
테넌트 설정 > 메뉴 관리 > 사용자 메뉴(북마크)에서 항목을 **수정**하면 저장이 실패("저장하지 못했습니다")했다.
노출 등급을 바꿔도 반영되지 않아 "노출 등급 지정 오류"로 보고됨.

운영 감사 로그(2026-10-26 13:52 UTC): `PATCH /acm/tenant/custom-menus/660fdceb…` → **400** ×2,
요청 필드 `id,name,url,newTab,roles,group,openMode`.

## 2. Root Cause (원인)
수정 다이얼로그가 편집 대상(`CustomMenu`, `id` 포함)을 그대로 form 상태로 쓰고 `{ ...form, name, url }` 를 보냈다.
백엔드 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` 가 DTO 에 없는 `id` 를 거부 → 400.
등록은 form 에 `id` 가 없어 정상(등록 시 지정한 노출 등급은 저장됨).

## 3. Fix (수정)
- `frontend-acm/src/modules/cfg/components/custom-menu-section.tsx` — 저장 시 보낼 필드
  (`name, url, newTab, roles, group, openMode`)만 골라 전송.

## 4. Verification (검증)
로컬(빈 DB + sql/acm 전체):
- 등록: 노출 등급 관리자만 → 저장 `{ADMIN}`, 목록 "관리자".
- 수정: 강사 추가 → 저장 성공 `{ADMIN,TEACHER}` (수정 전 코드에서는 400).
- 강사 계정 `/api/acm/me/menus` → 강사 포함 시 표시, 제외 시 미표시.

## 5. Note (참고)
테넌트 마스터는 노출 등급과 관계없이 모든 사용자 메뉴가 보인다(설계, 다이얼로그 안내 문구 있음).
