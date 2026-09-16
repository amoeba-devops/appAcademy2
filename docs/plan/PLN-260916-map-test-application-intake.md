---
document_id: CSL-PLN-260916
version: 0.1.0
status: DRAFT (사용자 확인 대기 — CLAUDE.md §9.2)
date: 2026-09-16
depends_on: docs/analysis/REQ-260916-map-test-application-intake.md
change_log:
  - 2026-09-16 v0.1.0 초안 — `/test2` 스니펫 + 맵테스트 신청 구조화 저장 + `/admin/test` 목록·상세 구현 계획 (Claude Code)
---

# PLN-260916 — 맵테스트 신청 접수 구현 계획 / Implementation Plan

## 1. Approach (설계 방향)

**핵심 결정: 별도 테이블이 아니라 "상담 1건 + 맵테스트 신청서 1:1 부속 레코드"로 저장한다.**

| 후보 | 장점 | 단점 | 채택 |
|------|------|------|------|
| A. 독립 테이블 `amb_acm_map_application` | 도메인 분리 | PII 암호화 로직 중복, 상담 파이프라인·대시보드 집계에서 누락, 나중에 등록 전환 시 수동 연결 | ✖ |
| **B. `amb_acm_csl_inquiry` + 1:1 부속 테이블 `amb_acm_csl_map_apply`** | 단계·사이트 귀속·대시보드가 그대로 동작, 암호화 재사용, 신청 원본은 구조화 보존 | 조인 1회 | **✔** |

`/admin/test` 는 "부속 레코드가 있는 상담"만 보여주는 전용 화면이므로 상담 목록(`/admin/csl`)과 화면이 섞이지 않는다 (REQ Q2 기본값).

## 2. Data Model (`sql/acm/1014-csl-map-apply.sql`, 멱등)

```sql
-- 1014 — CSL-PLN-260916: 맵테스트 신청서 원본 항목 (아임웹 /test2 접수)
-- 상담(amb_acm_csl_inquiry) 1건과 1:1. 신청 폼 항목을 구조화 보존한다. Idempotent.

CREATE TABLE IF NOT EXISTS amb_acm_csl_map_apply (
  mpa_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id                UUID NOT NULL,
  inq_id                UUID NOT NULL,
  mpa_student_name_en   VARCHAR(120),            -- 영문 이름 (평문: 검색·리포트용)
  mpa_birthdate         DATE,                    -- 생년월일 (YYYYMMDD 입력 → DATE 정규화)
  mpa_birthdate_raw     VARCHAR(20),             -- 정규화 실패 시 원문 보존
  mpa_gender            VARCHAR(10),             -- 'M' | 'F'
  mpa_exam_location     VARCHAR(200),            -- 응시 국가/도시
  mpa_preferred_slot    VARCHAR(60),             -- 희망 요일/시간 (TPI 전용, TRINITY 는 NULL)
  mpa_source_site       VARCHAR(20) NOT NULL,    -- TPI | TRINITY | SANTACROCE
  mpa_raw_payload       JSONB,                   -- 접수 원문 (필드 추가 시 유실 방지)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_acm_csl_map_apply_inq UNIQUE (inq_id),
  CONSTRAINT chk_acm_csl_map_apply_gender CHECK (mpa_gender IS NULL OR mpa_gender IN ('M','F')),
  CONSTRAINT chk_acm_csl_map_apply_site  CHECK (mpa_source_site IN ('TPI','TRINITY','SANTACROCE'))
);

CREATE INDEX IF NOT EXISTS idx_acm_csl_map_apply_ent_created ON amb_acm_csl_map_apply (ent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acm_csl_map_apply_site        ON amb_acm_csl_map_apply (ent_id, mpa_source_site);

DROP TRIGGER IF EXISTS trg_acm_csl_map_apply_updated_at ON amb_acm_csl_map_apply;
CREATE TRIGGER trg_acm_csl_map_apply_updated_at
  BEFORE UPDATE ON amb_acm_csl_map_apply
  FOR EACH ROW EXECUTE FUNCTION set_acm_updated_at();
```

- 학생 한글이름·연락처·학부모 이메일·학년은 **상담 레코드(`amb_acm_csl_inquiry`)** 에 기존 방식 그대로 저장(암호화 포함) → 중복 저장하지 않는다.
- `mpa_raw_payload` 는 아임웹 폼에 항목이 추가돼도 유실 없이 받아두기 위한 안전망.

## 3. Backend

| # | File | Change |
|---|------|--------|
| B1 | `acm-csl/infrastructure/typeorm/map-apply.typeorm-entity.ts` (신규) | `MapApplyTypeormEntity` — 위 컬럼 매핑 |
| B2 | `acm-csl/presentation/external-intake.config.ts` | 변경 없음 — 기존 3사이트 키·오리진 재사용 |
| B3 | `acm-csl/presentation/external-intake.controller.ts` | `POST /api/web/external-intake/map-test` 추가. DTO `ExternalMapTestIntakeDto`: `studentName*`, `studentNameEn*`, `birthdate*`, `grade*`, `gender?`, `parentPhone*`, `parentEmail?`, `examLocation*`, `preferredSlot?`, `consent*`, `website?`. 검증 순서·응답(`{success, seqNo}`)·레이트리밋은 기존 상담 접수와 동일 |
| B4 | `acm-csl/application/map-apply.service.ts` (신규) | `createFromIntake()` — 상담 생성(`applyType:'EXAM_ONLY'`, `inflowType:'WEB_EXTERNAL'`, `applyPurposes:['MAP_TEST_TUTORING']`, `sourceSite`) 후 부속 레코드 insert (한 트랜잭션). 생년월일 `YYYYMMDD`/`YYYY-MM-DD` 정규화, 실패 시 `mpa_birthdate_raw` 로 보존 |
| B5 | `acm-csl/application/map-apply.service.ts` | `list(entId, query)` — 상담 INNER JOIN 부속. 필터 `q`(학생명/영문명/연락처 끝4자리), `site`, `stage`, `from`,`to`, `page`,`limit`(기본 20). 복호화 후 반환 |
| B6 | `acm-csl/application/map-apply.service.ts` | `detail(entId, id)` — 신청 원본 + 상담 요약(단계·담당·메모·seqNo) 반환. `update(entId, id, dto)` — 신청 원본 항목 보정(영문명·생년월일·성별·응시지·희망슬롯) |
| B7 | `acm-csl/presentation/map-apply.controller.ts` (신규) | `@Controller('acm/csl/map-applications')` + `AcmJwtAuthGuard, OwnEntityGuard`. `GET /`, `GET /:id`, `PATCH /:id`, `GET /export.csv` |
| B8 | `acm-csl/presentation/web-inquiry.controller.ts` | 기존 `POST /api/web/test` 도 부속 레코드를 쓰도록 `MapApplyService` 경유로 변경 (하위 호환 유지, `sourceSite` 는 `TPI` 기본) |
| B9 | `acm-csl.module.ts` | 엔티티·서비스·컨트롤러 등록 |
| B10 | `map-apply.service.spec.ts` (신규) | 생년월일 정규화(`20100914`/`2010-09-14`/`잘못된값`), 사이트 매핑, 목록 필터 조립 단위 테스트 |

## 4. Frontend (`frontend-acm`)

| # | File | Change |
|---|------|--------|
| F1 | `modules/csl/hooks/use-map-applications.ts` (신규) | react-query `['mapApply', ...]` — list/detail/update/export |
| F2 | `modules/csl/pages/map-apply-list-page.tsx` (신규) | `/admin/test` 목록 (§5 목업) |
| F3 | `modules/csl/pages/map-apply-detail-page.tsx` (신규) | `/admin/test/:id` 상세 (§5 목업) |
| F4 | `routes/router.tsx` | `{ path: 'test', element: <MapApplyListPage /> }`, `{ path: 'test/:id', element: <MapApplyDetailPage /> }` |
| F5 | `components/layout/app-shell.tsx` | `NAV` 에 `{ to: '/admin/test', icon: ClipboardList, key: 'mapApply' }` 추가 (csl 아래) |
| F6 | `lib/admin-menu-keys.ts` + `backend/.../admin-menu-keys.ts` | `mapApply` 키 등록 (두 파일 수동 동기) |
| F7 | i18n `csl.json` (`mapApply.*`) + `common.json` (`nav.mapApply`) × ko/en/vi/zh-CN | 목록/상세/필터/항목 라벨 |

## 5. UI Mockup (화면 구성안)

### 5.1 `/admin/test` — 맵테스트 신청 목록

```
맵테스트 신청                                              [CSV 내보내기]

[검색: 학생명·영문명·연락처 뒤 4자리      ] [사이트 ▾ 전체] [단계 ▾ 전체] [기간 2026-09-01 ~ 2026-09-16]  [초기화]
                                                                                   총 12건

┌────┬──────────────┬─────────┬──────────┬──────────────┬──────┬────┬────────────┬───────────────┬──────────────┬────────┐
│ #  │ 접수일시       │ 사이트   │ 학생명    │ 영문명        │ 학년  │ 성별│ 연락처      │ 응시 국가/도시  │ 희망 요일/시간 │ 단계    │
├────┼──────────────┼─────────┼──────────┼──────────────┼──────┼────┼────────────┼───────────────┼──────────────┼────────┤
│ 74 │ 09/16 14:02  │ TPI     │ 주지호    │ Joo Jiho     │ G10  │ 남 │ 0103***779 │ 싱가포르        │ 금요일 오후 5시│ 🔵 접수 │
│ 73 │ 09/15 19:40  │ 트리니티 │ 이율호    │ Lee Yuro     │ G7   │ 남 │ 0102***114 │ 서울           │ —            │ 🟡 상담 │
│ 72 │ 09/14 11:08  │ TPI     │ 이채민    │ Daisy Lee    │ G5   │ 여 │ 0107***902 │ 하노이         │ 화요일 오전10시│ 🟢 등록 │
└────┴──────────────┴─────────┴──────────┴──────────────┴──────┴────┴────────────┴───────────────┴──────────────┴────────┘
                                                        ‹ 이전   1 / 1   다음 ›

행 클릭 → /admin/test/:id
```

- 연락처는 목록에서 가운데 마스킹, 상세에서 전체 표시(기존 상담 목록과 동일 규칙).
- 단계 뱃지는 상담 단계(접수/상담/레벨테스트/체험수업/등록/보류/종결)를 그대로 사용.

### 5.2 `/admin/test/:id` — 맵테스트 신청 상세

```
← 맵테스트 신청 목록                                   상담 상세 보기 ↗   [저장]

  맵테스트 신청 #74                          🔵 접수    TPI    2026-09-16 14:02 접수

  ┌── 신청서 원본 ─────────────────────────────────────────────────────────┐
  │ 학생 한글 이름    주지호                                                │
  │ 학생 영문 이름    [ Joo Jiho                    ]                      │
  │ 생년월일         [ 2010-09-14 ]  (원문: 20100914)                      │
  │ 학년            G10                                                    │
  │ 성별            ( ) 남  ( ) 여   [남]                                   │
  │ 연락처           01033947779                                           │
  │ 학부모 이메일     wendy.injung@gmail.com                                │
  │ 응시 국가/도시    [ 싱가포르                     ]                      │
  │ 희망 요일/시간    [ 금요일 오후 5시  ▾ ]                                 │
  │ 개인정보 동의     ✔ 2026-09-16 14:02                                    │
  └───────────────────────────────────────────────────────────────────────┘

  ┌── 운영 ──────────────────────────────────────────────────────────────┐
  │ 단계   [ 접수 ▾ ]     담당  [ 미지정 ▾ ]     팔로업일  [ 2026-09-18 ]   │
  │ 메모   [                                                          ]   │
  └───────────────────────────────────────────────────────────────────────┘

  ※ 응시료·레벨테스트·점수 등 시험 진행 정보는 [상담 상세 보기] 에서 관리합니다.
```

- "신청서 원본" 의 영문명·생년월일·성별·응시지·희망슬롯은 오기 보정을 위해 편집 가능(`PATCH`).
- 학생 한글 이름·연락처·이메일·학년은 상담 레코드 소유이므로 이 화면에서는 읽기 전용, 수정은 상담 상세에서.

### 5.3 아임웹 `/test2` 폼 (스니펫 렌더 결과)

```
  MAP TEST 응시 신청

  학생의 한글 이름 *            [                    ]
  학생의 영문 이름 *            [                    ]
  학생의 생년월일 *             [ YYYYMMDD           ]   숫자 8자리
  학생의 학년 *                [ 예: G10            ]
  학생의 성별                  ( ) 남   ( ) 여
  연락 가능한 전화번호 *         [ - 없이 숫자만        ]
  학부모님의 이메일             [                    ]
  MAP TEST 응시 국가·도시 *     [                    ]
  MAP TEST 응시 희망 요일/시간   [ (선택)          ▾ ]   ← TPI 만 노출

  [x] 개인정보 수집 및 이용에 동의합니다.

  [            신 청 하 기            ]

  (전송 성공 시 모달) "맵테스트 응시 신청이 접수되었습니다. 담당자가 확인 후 연락드리겠습니다."  [확인]
```

기존 `/contact2` 스니펫과 동일한 다크 테마·검증·허니팟·완료 모달 구조를 재사용한다.

## 6. Snippet & imweb 작업

| # | 산출물 | 내용 |
|---|--------|------|
| S1 | `docs/implementation/snippets/map-test-form-tpi.html` | TPI 9항목, `SITE_KEY='tpi-8c094fefd4fd2314'` |
| S2 | `docs/implementation/snippets/map-test-form-trinity.html` | TRINITY 8항목(희망 요일/시간 제외), `SITE_KEY='trinity-51c0c40bd70ba964'` |
| S3 | `docs/implementation/GUIDE-260916-imweb-map-test.md` | 운영자 절차: 페이지 `/test2` 생성 → 코드 위젯 → 스니펫 → 게시 → 테스트 접수 → 콘솔 확인 |

아임웹 작업은 GUIDE-260903G 와 동일하게 Claude 가 브라우저 자동화로 수행하고 결과를 보고한다(사이트별 관리자 로그인 필요).

## 7. Work Breakdown (작업 순서·공수)

| # | Task | Est. |
|---|------|------|
| 1 | SQL 1014 + 엔티티 + 모듈 등록 | 0.2d |
| 2 | 접수 API(B3·B4) + 기존 `/api/web/test` 연동(B8) + 단위 테스트 | 0.4d |
| 3 | 목록·상세·수정·CSV API (B5~B7) | 0.4d |
| 4 | 콘솔 목록·상세 화면 + 메뉴 + i18n 4 locale (F1~F7) | 0.7d |
| 5 | 스니펫 2종 + 가이드 문서 | 0.3d |
| 6 | 로컬 스모크 → PR → CI → staging → production | 0.3d |
| 7 | 아임웹 `/test2` 2사이트 생성·게시·실접수 테스트·보고 | 0.3d |
| | **합계** | **약 2.6d** |

## 8. Risks (리스크)

| 리스크 | 대응 |
|--------|------|
| 생년월일 자유 입력(`20100914`, `2010.09.14`, `10년 9월` 등) 정규화 실패 | `mpa_birthdate_raw` 원문 보존 + 상세에서 보정 입력. 폼에서 숫자 8자리 안내·검증 |
| 아임웹 "중국내 접속 허용" 등으로 스니펫 스크립트가 제거될 가능성 | 해당 옵션은 2026-09-14 TPI·TRINITY 모두 해제 완료. 게시 후 실제 HTML 에서 스니펫 존재를 검증 |
| `/test` 와 `/test2` 병행 중 접수가 양쪽으로 분산 | 가이드에 메뉴 교체 시점 안내. 전환 판단은 운영자 결정 |
| 사이트 키가 코드에 평문 노출(기존 구조) | REQ-260903G 에서 수용된 리스크. 허니팟·오리진·레이트리밋으로 방어, 본 계획에서 변경 없음 |

## 9. Acceptance (검수 기준)

- [ ] `https://www.tpi.co.kr/test2`, `https://trinityacademy.kr/test2` 게시 후 스니펫 정상 렌더
- [ ] 각 사이트에서 테스트 접수 1건씩 → `/admin/test` 목록에 사이트·전 항목이 구조화되어 표시
- [ ] 상세에서 영문명·생년월일·성별·응시지·희망슬롯 수정 후 저장·재조회 유지
- [ ] 목록 검색·사이트/단계/기간 필터·CSV 내보내기 동작
- [ ] 동의 미체크 400, 허니팟 채워 전송 시 행 미생성 + 200
- [ ] 좌측 메뉴 "맵테스트 신청" 노출, 4개 로케일 라벨 정상
- [ ] 접수 건이 대시보드 사이트별 상담 집계에 반영
- [ ] 테스트 접수 건 정리(삭제) 후 보고서 작성
