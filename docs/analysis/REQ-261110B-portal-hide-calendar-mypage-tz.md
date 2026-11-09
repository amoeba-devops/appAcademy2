---
document_id: REQ-261110B
version: 1.0.0
status: IMPLEMENTED
change_log:
  - 2026-11-10 v1.0.0 — 요청·결정(사용자 선택) 기록 및 구현
---

# REQ-261110B Portal: hide calendar menu, custom time zone, schedule button (포털 수업일정 메뉴 숨김·사용자 지정 타임존·일정보기)

## 1. Request (요청)
`https://acm.amoeba.site/portal/calendar`
1. 학원 포털 좌측 메뉴에서 **수업일정** 숨김 — 좌측 메뉴에서만 삭제.
2. 마이페이지 타임존 — **학원 기준 타임존** 아래 **사용자 지정 타임존** 추가.
3. 타임존 아래 **[일정보기]** 버튼 추가.

(같은 날 요청된 '구글 미트 링크 형식 검사 생략'은 취소 — 기존 유지.)

## 2. Decisions (결정, 2026-11-10 — 사용자 선택)
| # | 질문 | 결정 |
|---|------|------|
| Q1 | 사용자 지정 타임존 모양 | 두 줄로 분리 — 학원 기준(표시만) / 사용자 지정(기존 9개 목록 + '사용 안 함') |
| Q2 | 메뉴 숨김 대상 | 학생·학부모·강사 모두 |
| Q3 | [일정보기] 위치 | 포털 마이페이지만 → `/portal/calendar` |

## 3. Requirements (요구사항)
| ID | 내용 | 파일 |
|----|------|------|
| FR-1 | 포털 좌측 메뉴에서 수업일정 항목 제거. `/portal/calendar`·`/portal/calendar/:evtId` 경로와 화면은 유지. 포털 첫 화면은 기존대로 공지사항. | `frontend-acm/src/modules/portal-app/components/portal-shell.tsx` |
| FR-2 | 타임존 영역: '학원 기준 타임존' = `tzLabel(tenantTimezone)` 표시, '사용자 지정 타임존' 선택(첫 항목 '사용 안 함 (학원 기준과 동일)' = null). 저장 API·미리보기는 그대로. 콘솔 마이페이지도 같은 컴포넌트라 같은 모양. | `frontend-acm/src/modules/me/my-profile-page.tsx` |
| FR-3 | 포털 모드에서만 타임존 영역 아래 [일정보기] 버튼(`/portal/calendar`). | 동일 |
| FR-4 | i18n: `myPage.tenantTimezone`·`userTimezone`·`noUserTimezone`·`viewCalendar` 4개 언어, 쓰지 않게 된 `myPage.followTenant` 제거. | `i18n/locales/{ko,en,vi,zh-CN}/common.json` |

## 4. Verification (확인)
- `tsc` · `vite build` 통과.
- 로컬 빌드 + API 목 응답(Playwright, 1280px·390px): 좌측 메뉴 = 공지사항·수업링크·문서/자료실·마이페이지, 타임존 두 줄, [일정보기] → `/portal/calendar`.
