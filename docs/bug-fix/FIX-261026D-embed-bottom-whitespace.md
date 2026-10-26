---
document_id: FIX-261026D
version: 1.0.0
status: FIXED
change_log:
  - 2026-10-26 v1.0.0 — minimize bottom whitespace under embedded Google Sheet
---

# FIX-261026D Embedded sheet bottom whitespace (업무목록 구글시트 하단 여백 최소화)

## 1. Symptom (증상)
`/admin/embed/:id`(업무목록 구글 시트) 화면 아래에 빈 공간이 남았다.

## 2. Cause (원인)
1. iframe 아래 안내 문구 한 줄
2. 본문(main) 아래 padding(p-3/p-4/p-6 = 12~24px)
3. 공통 셸: `.admin-shell`(min-h-screen) 안의 main `mt-header` 가 바깥으로 겹쳐(margin collapse)
   모든 관리 화면이 56px 더 스크롤됨

## 3. Fix (수정)
- 안내 문구 → 상단 ⓘ 아이콘 툴팁(`title`·`aria-label`)
- embed 페이지: 위 padding 만 빼고 높이 계산, 아래 padding 은 음수 margin 으로 상쇄 → iframe 이 화면 맨 아래까지
- `app-shell.tsx` 래퍼에 `flow-root` — margin collapse 제거(모든 관리 화면의 불필요한 56px 스크롤 제거)

## 4. Verification (검증)
로컬 1321×505: iframe bottom = innerHeight(하단 여백 0), scrollHeight = innerHeight(추가 스크롤 없음).
상담 목록·채팅·테넌트 설정(긴 페이지 끝까지 스크롤, 마지막 섹션 아래 padding 24px) 정상.
