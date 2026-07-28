---
document_id: FIX-260728D-admin-post-create-400
version: 2.0.0
status: fixed
created: 2026-07-28
severity: High (공지 작성 불가)
scope: /admin/posts/new — 공지(게시글) 생성 400
---

# 진단 보고 — 공지 작성 `POST /api/admin/posts` 400

> **요청**: 원인 파악 우선. 본 문서는 원인 분석이며, 수정은 확인 후 진행.

## 1. 증상
`/admin/posts/new` 에서 저장 시 `POST /api/admin/posts` → **400 Bad Request** (`Failed to load resource: 400`). 화면에는 일반 오류 토스트만 표시.

## 2. 결론 (Root cause) — 한 줄
**`slug`(URL 슬러그) 입력값이 백엔드의 엄격한 형식 검증을 통과하지 못해서** 400 이 발생한다.
- 백엔드 `CreateAdminPostDto.slug` 제약: `@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` — **영소문자·숫자·하이픈(-)** 만 허용.
- 프론트 편집기의 `slug` 는 **자동 생성/클라이언트 검증 없이 자유 입력 필수 필드**.
- 한국어 운영자가 자연스럽게 **한글/대문자/공백/언더스코어(_)/끝하이픈** 등을 입력 → 정규식 위반 → `class-validator` 400.

## 3. 근거
- DTO: [admin-post.dto.ts:40-44](../../backend/src/modules/acm-posts/application/dto/admin-post.dto.ts#L40-L44) — `slug` `@IsString @MaxLength(200) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)`.
- 편집기: [post-editor-page.tsx:186-195](../../frontend-acm/src/modules/posts/pages/post-editor-page.tsx#L186-L195) — `slug` 는 수동 입력(required)만, 자동 생성·검증·안내 없음. 제출 시 `form.slug.trim()` 그대로 전송([:91](../../frontend-acm/src/modules/posts/pages/post-editor-page.tsx#L91)).
- 요청 경로: `POST /api/admin/posts` (컨트롤러 도달 = 400 은 검증 실패, 404 아님). 전역 `ValidationPipe { whitelist, forbidNonWhitelisted, transform }` (main.ts:26-29).
- 예: slug 에 `공지사항`, `Notice-1`(대문자 N), `hello world`(공백), `hello_world`(_), `hello-`(끝하이픈) → 모두 400.

## 4. 부차 요인
- **`coverImageUrl`** 를 입력했는데 URL 형식이 아니면 `@IsUrl` 로 **동일하게 400**([:50-54](../../backend/src/modules/acm-posts/application/dto/admin-post.dto.ts#L50-L54)). (빈 값이면 `undefined` 전송이라 문제 없음)
- 프론트가 **필드별 검증 메시지를 노출하지 않아** 운영자가 어느 값이 문제인지 알 수 없다(진단 난이도 ↑).

## 5. 배제
- 404/경로 오류 아님(400 = 핸들러 도달). 추가필드 화이트리스트 400 아님(payload = DTO 필드와 정확히 일치). `title`/`bodyMd` 는 빈 문자열도 통과(원인 아님).

## 6. 해결 방향 (제안 — 결정 대기)
| # | 방향 | 성격 |
|---|---|---|
| **A (권장)** | 제목에서 **slug 자동 생성**(입력 시 미입력이면 자동) + 클라이언트 정규화(소문자화·공백→하이픈·허용문자만) + 서버 규칙과 일치 | FE(+선택 BE) |
| B | slug 필드에 **실시간 검증·안내문**(형식 예시) + 저장 전 차단, 400 시 필드 메시지 노출 | FE |
| C | 한글 slug 허용이 필요하면 **서버 정규식 완화**(예: URL 인코딩 허용) — URL 가독성 저하 감수 | BE |
| D | `coverImageUrl` 유효성 안내/빈값 처리 강화 | FE |

> 권장: **A + B** — 운영자는 제목만 쓰면 slug 자동 생성(수정 가능), 잘못된 값은 저장 전 안내. 서버 규칙 유지.

## 7. 해결 (Resolution — 2026-07-28, 권장안 A+B, PLN-260728D)

- **slug 자동생성**: `modules/posts/lib/slugify.ts` — 제목 입력 시 `slugify`(소문자·공백→하이픈·허용문자만·앞뒤하이픈 제거) 자동 반영(사용자 직접 수정 전까지). 한글 전용 제목이면 fallback `post-<yyyymmddHHmm>`.
- **클라이언트 검증**: slug 형식 위반 시 필드 안내(빨강) + 저장 전 차단. `coverImageUrl` URL 형식 검증.
- **오류 노출**: 서버 400 응답의 class-validator 메시지를 토스트로 노출(원인 파악 가능).
- **부수 발견·수정(i18n)**: `admin` 네임스페이스(admin.json)가 4 locale 모두 부재해 posts·notifications 페이지가 영어 폴백이었음 → `admin.json` ×4 신설 + `i18n/index.ts` 등록 + 하드코딩 옵션 라벨(Draft/Notice…) t() 전환.

**검증**: FE `tsc`+`vite build` clean, admin.json 4 locale 유효.
서버 slug 규칙(정규식)은 유지(완화 불필요).
</content>
