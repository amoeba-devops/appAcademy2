---
document_id: FIX-260624-classroom-hooks-310
version: 1.0.0
status: fixed
created: 2026-06-24
authors:
  - gray.kim@amoeba.group
severity: high (production crash)
area: frontend-acm / web / classroom launcher
---

# FIX-260624 — Classroom launcher crashes with React #310 (Rendered more hooks)

## 1. Symptom (증상)
`/web/classroom/:evtId?autoStart=1` 접속 시 화면 전체가 흰 에러로 대체됨:

```
Unexpected Application Error!
Minified React error #310; (Rendered more hooks than during the previous render)
  … Object.useRef … at WebClassroomPage
```

- 교사가 즉시강의 `autoStart=1` 링크로 진입할 때 재현.
- 인증/쿼리 상태가 전이되는 순간(미인증→인증, 로딩→완료) 발생.

## 2. Root cause (원인)
[web-classroom-page.tsx](../../frontend-acm/src/modules/web/pages/web-classroom-page.tsx) `WebClassroomPage` 에서
**Rules of Hooks 위반**. `useSearchParamsCompat()`(내부적으로 `useSearchParams()` hook 호출)가
조건부 early return (`!acmUser` / `isLoading` / `isError`) **아래**에서 호출되고 있었음.

- 첫 렌더(미인증·로딩)에서 early return → `useSearchParams` 미실행 → hook 5개
- 데이터 로드 후 렌더에서 끝까지 진행 → `useSearchParams` 실행 → hook 6개
- 렌더 간 hook 개수 불일치 → React #310

`useSearchParamsCompat` 라는 래퍼 indirection 때문에 hook 호출이 컴포넌트 본문 중간에
숨어 있었고, 해당 레포에 `react-hooks/rules-of-hooks` lint 가 강제되지 않아 빌드에서 걸러지지 못함.

## 3. Fix (수정)
모든 hook 호출을 컴포넌트 최상단(early return 이전)으로 이동.

```diff
  const acmUser = useAuthStore((s) => s.user);
+ // Rules of Hooks: must run on every render, before any early return below.
+ const [search] = useSearchParamsCompat();
  const lang = i18n.language === 'en' ? 'en' : 'ko';
  …
  const ctx = ctxQuery.data!;
- const [search] = useSearchParamsCompat();
  const autoStart = search.get('autoStart') === '1' && ctx.userType === 11;
```

## 4. Verification (검증)
- `tsc --noEmit` clean.
- Hook 호출 순서가 모든 렌더에서 동일(useTranslation → useParams → useAuthStore →
  useSearchParamsCompat → useBodaLaunchContext → useBodaRoomStatus) 후 early return.
- staging/production 배포 후 `/web/classroom/:id?autoStart=1` 정상 로드 확인.

## 5. Follow-up (후속, 선택)
- `react-hooks/rules-of-hooks` 를 frontend-acm lint 에 활성화하면 동종 회귀를 빌드에서 차단 가능.
