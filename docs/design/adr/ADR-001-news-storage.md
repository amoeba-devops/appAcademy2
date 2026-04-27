---
document_id: NEWS-ADR-1.0.0
version: 1.0.0
status: Accepted
date: 2026-04-27
deciders: app-academy core team
related_question: Q-017 (CLAUDE.md §12)
supersedes: —
---

# ADR-001 — News 콘텐츠 저장소: 자체 DB vs 헤드리스 CMS

## 1. Context (배경)

`/news`, `/news/[slug]` 포털 라우트는 학원이 학부모에게 공지·소식·이벤트를
게시하는 통로다. v1.4.0 시점에서 **자체 DB(`tac_posts` 테이블)** 기반으로
이미 구현되어 있다.

- DB: [sql/010-academy-management-schema.sql](../../../sql/010-academy-management-schema.sql) L780 — `tac_posts(pst_id, acd_id, pst_slug, pst_title, pst_body_md, pst_cover_image_url, pst_author_user_id, pst_published_at, pst_status)`
- API: [backend/src/presentation/controllers/portal-news.controller.ts](../../../backend/src/presentation/controllers/portal-news.controller.ts) — `GET /api/portal/news`, `GET /api/portal/news/:slug`
- Entity / Use case: `PostEntity`, `GetPostsUseCase`
- Frontend: [frontend/src/app/(portal)/news/page.tsx](../../../frontend/src/app/(portal)/news/page.tsx)

**결정 시점 트리거**: AMA App Store Pivot(v1.4.0) 직후, 멀티테넌트 SaaS로
범용화되면서 "테넌트별 콘텐츠 모델을 외부 CMS(Strapi/Contentful/Sanity)로
빼야 하는가"라는 의문이 제기됨 (CLAUDE.md Open Question Q-017).

## 2. Decision (결정)

**자체 DB(`tac_posts`) 방식을 v2.x까지 유지한다.** 헤드리스 CMS는 도입하지 않는다.

향후 콘텐츠 모델 복잡도가 임계치를 넘으면 (§5 트리거 조건) 재평가한다.

## 3. Options Considered (대안)

| # | 옵션 | 요약 |
|---|------|------|
| A | **자체 DB (`tac_posts`)** ✅ 선택 | 현 구현 유지. NestJS + TypeORM + MySQL, Markdown 본문 |
| B | Strapi (self-hosted) | OSS 헤드리스 CMS. 별도 컨테이너, Postgres 필요 |
| C | Contentful (SaaS) | 외부 호스팅, GraphQL/REST, 무료 플랜 25k entries |
| D | Sanity (SaaS) | 외부 호스팅, GROQ, 무료 3 users |
| E | Markdown in Git | `/content/news/*.md` 정적 파일, 빌드 시 SSG | 

## 4. Rationale (근거)

### 4.1 멀티테넌트 격리 (가장 결정적)
- 모든 테넌트 데이터는 `acd_id` 컬럼으로 격리된다 (NFR-004).
- 외부 CMS 도입 시 **테넌트별 space/project/dataset**을 프로비저닝해야 함 →
  AMA Webhook으로 자동화된 SUSPEND/CANCEL/DEPROVISION 라이프사이클을
  CMS 측 API와 다시 동기화해야 하는 추가 통합 부담.
- 자체 DB는 기존 `acd_id` + `tac_subscription_events` 사이클에 자연스럽게 편승.

### 4.2 콘텐츠 모델 복잡도가 낮음
- News는 본문 1개 + 커버 이미지 + 카테고리. 이미지/비디오 갤러리, 다국어
  variant, 작성자 워크플로(승인 단계) 같은 CMS 강점 기능이 현재 SPEC에 없음.
- Markdown 본문 + S3 업로드 이미지로 충분.

### 4.3 운영 비용 / 외부 의존성
- Contentful Free: 25k entries / 5 spaces — **테넌트=space 모델이면 5개 학원 한도**.
  유료 플랜은 $300+/mo부터 시작 → SaaS 마진 압박.
- Strapi self-hosted: 별도 Postgres + 컨테이너 + 백업/모니터링 추가 운영 부담.
- 자체 DB: 0 추가 비용, 기존 백업(`scripts/backup-db.sh`)에 자동 포함.

### 4.4 운영자 UX
- 학원 관리자가 익숙한 곳은 **app-academy 관리자 콘솔**. CMS 별도 로그인은
  학습 비용 + UX 분절.
- 향후 `/admin/posts` 관리 화면에서 작성/발행/삭제 가능 (TODO).

### 4.5 SaaS 제3자 데이터 처리
- Contentful/Sanity에 학원 콘텐츠를 보내면 **개인정보보호법 위탁처리 계약**
  대상이 됨 (학부모 후기, 학생 사진 포함될 가능성).
- 자체 DB는 이미 PIPA 준수 범위 내.

### 4.6 단점 수용
- 자체 DB의 단점(에디터 UX 부재, 미디어 라이브러리 부재, 미리보기/비교 기능 없음)은
  현 단계에서 비치명적. 운영 콘솔에 React Markdown 에디터(예: `react-markdown` +
  `react-mde`)를 단순 통합하는 수준으로 충당.

## 5. Reconsider Triggers (재평가 트리거)

다음 중 **둘 이상**이 동시에 발생하면 ADR-001을 재검토한다:

1. 단일 테넌트 게시물이 1,000건 초과 또는 본문 평균 길이가 10KB 초과
2. **다국어 콘텐츠 variant** 요구 (KR/EN/VI/ZH 본문 분리)
3. 작성자 워크플로 — 초안→리뷰→승인→발행 다단계 요구
4. 미디어 라이브러리(이미지·비디오·PDF 통합 관리) 요구
5. 비-개발자 마케터가 **개발자 손 안 빌리고** 페이지 구조 자체를 편집해야 하는
   요구 (랜딩 섹션 빌더 등)
6. 콘텐츠 SEO 최적화 — 자동 sitemap, OG 태그, JSON-LD 풍부화 자동 생성 필요

## 6. Consequences (결과)

### 6.1 따라야 할 후속 작업
- [ ] `/admin/posts` 관리 화면 신설 — 작성/발행/삭제 (별도 작업, 우선순위 ⭐)
- [ ] `tac_posts` 에 `pst_category` 컬럼 추가 (현재 frontend는 `NEWS_CATEGORY`
  enum을 가지나 백엔드 schema에는 컬럼 없음 — 필터 동작이 mock 수준)
- [ ] 이미지 업로드: S3 presigned URL 흐름 표준화 (이미 `infrastructure/external/storage` 존재)
- [ ] Markdown XSS 방어: 백엔드는 그대로 저장, 프런트 렌더링 시 `rehype-sanitize` 강제

### 6.2 영향받지 않음
- AMA 라이프사이클: `acd_id` 기반 cascade DELETE로 DEPROVISION 시 자동 정리됨.
- 백업/복구: 기존 `mysqldump --where='acd_id=X'` 흐름에 자연 포함.
- API 호환성: 변경 없음.

### 6.3 위험
- **위험 R-1**: 미래 다국어 본문 요구 발생 시 schema 마이그레이션 필요. 완화책:
  `pst_body_md` 단일 컬럼 → `tac_post_translations(pst_id, locale, title, body_md)`
  분리 마이그레이션은 1회성, 기술적으로 단순.
- **위험 R-2**: 마케터가 직접 편집 못해 개발자 의존성. 완화책: 6개월 내
  `/admin/posts` 에디터(Markdown + 이미지 업로드 + 미리보기) 구현.

## 7. Change Log

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0.0 | 2026-04-27 | core | 초안 — Q-017 결정 |
