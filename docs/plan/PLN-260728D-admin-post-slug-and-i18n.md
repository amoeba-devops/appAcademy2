---
document_id: PLN-260728D-admin-post-slug-and-i18n
version: 1.0.0
status: draft
created: 2026-07-28
basis:
  - docs/bug-fix/FIX-260728D-admin-post-create-400.md (slug 400 원인)
scope: /admin/posts (공지 작성) slug 자동생성·검증 + admin 네임스페이스 i18n(posts·notifications)
---

# 작업계획서 — 공지 작성 slug 수정(권장안 A+B) + posts·notifications i18n

> 두 작업을 함께 정리한다.
> **① slug 400 해결(권장안 A+B)** — 제목 기반 slug 자동생성 + 클라이언트 정규화·검증 + 오류 노출.
> **② i18n 누락 수정** — `admin` 네임스페이스(=admin.json) 부재로 posts·notifications 페이지가 영어 기본값으로 폴백. admin.json 신설·등록.

---

## 0. 배경 (확정된 사실)
- **slug**: 백엔드 `CreateAdminPostDto.slug` = `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`. 프론트는 자유입력·검증 없음 → 한글/대문자/공백 입력 시 **400** ([FIX-260728D](../bug-fix/FIX-260728D-admin-post-create-400.md)).
- **i18n**: `frontend-acm/src/i18n/index.ts` 의 `ns` 배열에 **`admin` 없음**, `locales/*/admin.json` **파일 없음**. `useTranslation('admin')` 사용 페이지 = **posts(목록·편집), notifications, enrollments** → 전부 영어 기본값 폴백. post-editor 의 상태/분류 옵션 라벨은 **t() 미사용 하드코딩**('Draft'·'Notice'…).

---

## 1. 트랙 개요

| 트랙 | 범위 | 산출물 |
|:--:|------|--------|
| **T1** | slug 자동생성 유틸 + 편집기 배선(A) | `slugify` + post-editor 연동 |
| **T2** | 클라이언트 검증·정규화·오류 노출(B) | 필드 검증 + 400 메시지 표시 |
| **T3** | `admin` 네임스페이스 신설·등록 | admin.json ×4 + i18n/index.ts |
| **T4** | posts·notifications 문자열 키화 | 하드코딩 옵션 라벨 t() 전환 |
| **T5** | 빌드/타입체크 + JSON 유효성 | — |

> 범위: 사용자 요청대로 **posts·notifications** 중심. `enrollments` 도 admin ns 사용이라 admin.json 에 최소 키를 포함(공용 네임스페이스 반쪽 방지)하되, 상세 전환은 후속.

---

## 2. 트랙 상세

### T1 — slug 자동생성 (권장안 A)
- 유틸 `slugify(title): string`:
  - 소문자화 → 공백/언더스코어 → 하이픈 → 허용문자(`[a-z0-9-]`) 외 제거 → 하이픈 연속 축약 → 앞뒤 하이픈 제거.
  - 결과가 비면(한글 전용 제목 등) **fallback**: `post-<yyyymmddHHmm>` (충돌 시 서버 409 로 안내).
- 편집기 동작:
  - slug 를 사용자가 **직접 수정하기 전까지는** 제목 입력에 따라 자동 반영(“자동” 상태 플래그).
  - 사용자가 slug 를 손대면 자동반영 중지(수동 유지).
- ✅ 한글 제목만 입력해도 유효 slug 로 저장 성공.

### T2 — 클라이언트 검증·정규화·오류 노출 (권장안 B)
- slug onBlur/onChange 시 `slugify` 로 정규화, 형식 위반이면 **필드 하단 안내**(“영소문자·숫자·하이픈만 가능”).
- 저장 전 가드: slug 형식 불일치 시 제출 차단 + 안내.
- `coverImageUrl`: 값이 있는데 URL 형식이 아니면 안내(빈 값은 전송 안 함 — 현행 유지).
- 서버 400 응답의 메시지를 **토스트에 코드/사유 포함** 노출(현재는 일반 메시지).
- ✅ 잘못된 값은 저장 전 차단, 400 시 원인 파악 가능.

### T3 — `admin` 네임스페이스 신설·등록 (i18n)
- `locales/{ko,en,vi,zh-CN}/admin.json` 신설. 최상위 키: `posts`, `notifications`(+ 공용 `actions`, `filters`, `toast`, 필요 시 `enrollments`).
- `i18n/index.ts`: `ns` 배열에 `'admin'` 추가 + 4 locale 번들 import·resources 등록.
- ✅ posts·notifications 페이지가 ko/vi/zh-CN 에서 번역됨(영어 폴백 해소).

### T4 — 하드코딩 문자열 키화
- post-editor `STATUS_OPTIONS`/`CATEGORY_OPTIONS` 라벨을 t() 키로 전환(`posts.status.*`, `posts.category.*`).
- posts-list·notifications 의 `t('key','English')` 기본값을 admin.json 키로 실제 채움(기본값은 유지 — 폴백 안전망).
- ✅ 4 locale 동시 반영, 누락 0.

### T5 — 검증
- FE `tsc --noEmit` + `vite build`, JSON 4 locale 유효성.

---

## 3. 화면 목업 (§9.2)

### 3.1 slug 자동생성/검증 (post-editor)
```
제목 [ 7월 학사일정 안내                    ]
URL slug [ post-202607281530            ] (자동)
  └ 영소문자·숫자·하이픈(-)만 가능. 제목 입력 시 자동 생성되며 수정할 수 있어요.
표지 이미지 URL [ https://...            ]  (선택 · URL 형식)
본문(Markdown) [ ...                     ]
                                   [ 공지 작성 ]
```
- 잘못된 slug(예: `공지 사항`) 입력 시:
```
URL slug [ 공지 사항 ]  ⚠ 영소문자·숫자·하이픈만 가능합니다 (예: notice-2026-07)
```

---

## 4. 변경 파일(예정)
**FE**: `modules/posts/lib/slugify.ts`(신규) · `modules/posts/pages/post-editor-page.tsx` · `modules/posts/pages/posts-list-page.tsx` · `modules/notifications/pages/notifications-list-page.tsx` · `i18n/index.ts` · `i18n/locales/{ko,en,vi,zh-CN}/admin.json`(신규)
**BE**: 없음(서버 slug 규칙 유지).

---

## 5. 미결(결정 필요)
| ID | 질문 | 기본안 |
|---|---|---|
| P-1 | slug fallback 형식 | `post-<yyyymmddHHmm>` (권장) |
| P-2 | enrollments 키를 이번에 포함? | admin.json 에 최소만, 상세 전환은 후속 |
| P-3 | 서버 slug 규칙 완화(한글 허용) 필요? | 불필요(자동생성으로 해결), 유지 |

---

## 6. Sign-off
- 본 PLN 은 **draft**. 승인 시 T1 착수. FE 전용·무배포영향(런타임)·마이그레이션 없음.
</content>
