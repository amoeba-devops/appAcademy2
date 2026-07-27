---
document_id: RPT-260728C-cal-classroom-owner-operator-backlink-notices
version: 1.0.0
status: complete
created: 2026-07-28
scope: /portal/classroom 강의실 입장 권한 · 뒤로가기 링크 · 포털 공지 메뉴
---

# 처리 보고 — 강의실 등록자 운영자 권한 · 뒤로가기 링크 · 공지 메뉴

세 가지 요구사항 처리 결과. ①·② 코드 변경, ③ 운영 액션(코드 무변경).

## ① 등록자(AMA 유저) → 운영자(13) 입장 권한
- **결정**: 담당 강사가 방을 개설(포털 로그인 → 11), 등록자는 운영자(13)로 참관.
- **구현**: `boda-launch-context.service.ts` 콘솔 `resolveUserType` —
  - owner(등록자)이고 **담당 강사(assignee) 또는 강사 참석자가 있으면 → 운영자(13)**.
  - **즉시강의(INSTANT) 또는 개설 주체(강사)가 없으면 → 강사(11) 유지**(락아웃 방지).
- **영향**: 담당 강사 지정된 일반 수업에서 등록자는 콘솔 autoStart 자동개설 대신 운영자 참관(bodaJoin). 즉시강의·담당강사 없는 수업은 기존대로 등록자가 개설.

## ② ‘수업일정으로 돌아가기’ 링크 → /portal/login
- **구현**: `web-classroom-page.tsx` `BackLink` href `/` → `/portal/login`.

## ③ 포털 공지사항(posts) 작성 메뉴 활성화 — 운영 액션 (코드 무변경)
- 관리자 편집기(`/admin/posts`, `PostsListPage`/`PostEditorPage`), 백엔드 CRUD(`@Controller('admin/posts')`), 사이드바 항목(app-shell `posts`)이 **모두 이미 존재**.
- 안 보이는 원인: **테넌트 메뉴 가시성**에서 `posts` 가 숨김 처리됨(`GET /acm/me/menus` 의 hidden 목록).
- **조치(운영자)**: 시스템 관리자 → 테넌트 상세(`/system` tenant-detail) → 메뉴 가시성에서 **`posts`(공지/게시글)** 를 **표시**로 토글. 저장 즉시 `/admin/posts` 메뉴가 노출되어 공지 작성 가능.
- 코드/배포 불필요 — 런타임 config.

## 검증
- BE `nest build` clean, FE `tsc`+`vite build` clean.
</content>
