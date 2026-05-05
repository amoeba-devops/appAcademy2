---
document_id: ACM-PLN-STD-001
version: 1.0.0
status: Draft
created: 2026-05-05
product_code: ACM
module: STD (Student Management / 학생관리)
req_ref: ACM-REQ-STD-001
---

# ACM STD — 학생관리 모듈 작업 계획서 (Work Plan)

## 1. 목표 (Objective)

TPI Master 엑셀 2번째 시트(학생명단)를 ACM 시스템으로 이관한다.  
- 사이드바 "학생관리" 메뉴 신설  
- 학생 목록 · 상세 · 등록 · 수정 · 비활성화 (CRUD)  
- 엑셀(.xlsx) 업로드 일괄 Import  
- 엑셀 양식 템플릿 다운로드

---

## 2. 화면 구성안 (UI Layout Mockup)

### 2-1. 학생 목록 페이지 `/std`

```
┌────────────────────────────────────────────────────────────┐
│  [←] 학생관리                          [+ 학생 등록] [↑ 엑셀 업로드] │
├────────────────────────────────────────────────────────────┤
│  [이름/학교 검색_________________] [상태▼] [학교▼] [학년▼]  │
├──────┬───────────┬──────┬──────┬───────────┬───────┬──────┤
│ 번호 │ 이름(영문) │ 성별 │ 학교 │   학년    │ 담당강사│ 상태 │
├──────┼───────────┼──────┼──────┼───────────┼───────┼──────┤
│  1   │ 홍길동(James) │ M   │ Trinity MS │ G8 │ Smith │ ACTIVE │
│  2   │ 김민지(Amy)   │ F   │ Trinity ES │ G5 │ Brown │ ACTIVE │
│  …   │     …     │  …   │  …   │     …     │   …   │  …   │
├──────┴───────────┴──────┴──────┴───────────┴───────┴──────┤
│  총 42명  [ 비활성 학생 포함 □ ]        ← 1 2 3 … →       │
└────────────────────────────────────────────────────────────┘
```

- 행 클릭 → `/std/:id` 상세 페이지 이동
- 상태 필터: ACTIVE(기본) / INACTIVE / ALL
- `비활성 학생 포함` 체크 시 deleted_at=NULL AND status IN ('ACTIVE','INACTIVE')

---

### 2-2. 학생 등록 모달 (+ 학생 등록 버튼 클릭)

```
┌────────── 학생 등록 ──────────────────────────────┐
│  이름(한글)*  [_____________]  영문이름  [________] │
│  성별*  ○남  ○여              생년월일  [____-__-__]│
│  학교  [_____________]         학년  [__________]  │
│  연락처  [_____________]       거주지  [__________] │
├──── MAP 점수 ──────────────────────────────────────┤
│  Reading [___]  Math [___]  Language [___]         │
├──── 수업 정보 ─────────────────────────────────────┤
│  담당강사  [_________]        과목  [_____________] │
│  교재      [_________________________]             │
│  이동수단  [_________]        GPA  [__]            │
├──── 메모 ──────────────────────────────────────────┤
│  목표  [______________________________________________] │
│  특이사항  [__________________________________________] │
│  상태  ● ACTIVE  ○ INACTIVE   등록일  [____-__-__]  │
├───────────────────────────────────────────────────┤
│                              [취소]  [저장]         │
└───────────────────────────────────────────────────┘
```

---

### 2-3. 학생 상세/수정 페이지 `/std/:id`

```
┌─────────────────────────────────────────────────────────┐
│  [← 목록으로]                             [수정] [비활성화]│
├──────────────────────────────────────────────────────────┤
│  ┌── 기본 정보 ─────────────────────────────────────┐   │
│  │ 이름: 홍길동(James)   성별: M   생년월일: 2010-03-15│   │
│  │ 학교: Trinity MS      학년: G8  거주지: 강남구     │   │
│  │ 연락처: 010-xxxx-xxxx  상태: [ACTIVE]              │   │
│  └────────────────────────────────────────────────────┘  │
│  ┌── MAP 점수 ──────────────────────────────────────┐   │
│  │ Reading: 225  Math: 231  Language: 218            │   │
│  └────────────────────────────────────────────────────┘  │
│  ┌── 수업 정보 ─────────────────────────────────────┐   │
│  │ 담당강사: Smith   과목: English Writing           │   │
│  │ 교재: Grammar in Use     이동수단: 차량            │   │
│  │ GPA: A+    SSAT/ISEE: -                          │   │
│  └────────────────────────────────────────────────────┘  │
│  ┌── 메모 ──────────────────────────────────────────┐   │
│  │ 목표: Harvard 진학                                │   │
│  │ 특이사항: 수요일 조퇴 가능                         │   │
│  │ 만족도: 매우 만족  최근상담일: 2026-04-20          │   │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

수정 버튼 클릭 시 같은 구조의 폼을 edit 모드로 전환 (인라인 편집).

---

### 2-4. 엑셀 업로드 모달

```
┌────────── 엑셀 업로드 (학생 일괄 등록) ─────────────────────┐
│  [📎 파일 선택] 또는 TPI_Master.xlsx 끌어다 놓기             │
│  ─────────────────────────────────────────────────────── │
│  ▼ 파싱 미리보기 (25행)                                    │
│  ┌─────┬──────────────┬──────┬────────┬────────┬──────┐  │
│  │ 행  │    이름      │ 성별 │  학교  │  학년  │  상태 │  │
│  ├─────┼──────────────┼──────┼────────┼────────┼──────┤  │
│  │  1  │ 홍길동(James)│  M   │ TMS    │   G8   │  OK  │  │
│  │  2  │ (이름 누락)  │  -   │  -     │   -    │ ⚠오류 │  │
│  │  3  │ 김민지(Amy)  │  F   │ TES    │   G5   │  OK  │  │
│  └─────┴──────────────┴──────┴────────┴────────┴──────┘  │
│  총 25행 | 유효: 24 | 오류: 1                              │
│  ─────────────────────────────────────────────────────── │
│  ● 중복(이름+생년월일) → 기존 레코드 갱신(Upsert)           │
│                                     [취소]  [Import 실행] │
└────────────────────────────────────────────────────────────┘
```

---

## 3. 작업 분해 (Task Breakdown)

### Phase 1 — DB Migration (SQL)

| Task | 파일 | 내용 |
|------|------|------|
| T-01 | `sql/acm/600-acm-std-students.sql` | `amb_acm_std_student` 테이블 + 인덱스 생성 |

### Phase 2 — Backend (NestJS)

| Task | 파일 | 내용 |
|------|------|------|
| T-02 | `backend/src/modules/acm-std/infrastructure/typeorm/student.typeorm-entity.ts` | TypeORM Entity |
| T-03 | `backend/src/modules/acm-std/application/dto/student.dto.ts` | CreateStudentDto, UpdateStudentDto, ListStudentsQueryDto, ChangeStatusDto, ImportResultDto |
| T-04 | `backend/src/modules/acm-std/application/student.service.ts` | CRUD 비즈니스 로직 |
| T-05 | `backend/src/modules/acm-std/application/import.service.ts` | 엑셀 파싱(xlsx 라이브러리) + Upsert 로직 |
| T-06 | `backend/src/modules/acm-std/presentation/student.controller.ts` | REST Controller (8 endpoints) |
| T-07 | `backend/src/modules/acm-std/acm-std.module.ts` | NestJS 모듈 정의 |
| T-08 | `backend/src/modules/acm.module.ts` | AcmStdModule 등록 |
| T-09 | `backend/package.json` | `xlsx` 패키지 추가 |

### Phase 3 — Frontend (Vite/React)

| Task | 파일 | 내용 |
|------|------|------|
| T-10 | `frontend-acm/src/modules/std/types.ts` | StudentSummary, StudentDetail 타입 |
| T-11 | `frontend-acm/src/modules/std/hooks/use-students.ts` | React Query hooks (list, detail, create, update, status, delete, import) |
| T-12 | `frontend-acm/src/modules/std/components/std-status-badge.tsx` | ACTIVE/INACTIVE/WITHDRAWN 뱃지 |
| T-13 | `frontend-acm/src/modules/std/components/std-filters.tsx` | 검색 + 상태/학교/학년 필터 바 |
| T-14 | `frontend-acm/src/modules/std/components/std-table.tsx` | 학생 목록 테이블 |
| T-15 | `frontend-acm/src/modules/std/components/std-form-modal.tsx` | 등록/수정 폼 모달 |
| T-16 | `frontend-acm/src/modules/std/components/std-import-modal.tsx` | 엑셀 업로드 + 미리보기 모달 |
| T-17 | `frontend-acm/src/modules/std/pages/std-list-page.tsx` | 목록 페이지 (T-12~16 조합) |
| T-18 | `frontend-acm/src/modules/std/pages/std-detail-page.tsx` | 상세/수정 페이지 |
| T-19 | `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/std.json` | 4개 언어 i18n 파일 |
| T-20 | `frontend-acm/src/i18n/index.ts` | `std` namespace 등록 |
| T-21 | `frontend-acm/src/components/layout/app-shell.tsx` | NAV에 학생관리 항목 추가 |
| T-22 | `frontend-acm/src/i18n/locales/{ko,en,vi,zh-CN}/common.json` | `nav.std` 키 추가 |
| T-23 | `frontend-acm/src/routes/router.tsx` | `/std`, `/std/:id` 라우트 등록 |
| T-24 | `frontend-acm/package.json` | `xlsx` 패키지 추가 (클라이언트 파싱은 불필요 — 서버 업로드 방식이므로 skip 가능) |

### Phase 4 — 배포 및 검증

| Task | 내용 |
|------|------|
| T-25 | `scripts/deploy-staging.sh` step 4b에 `600-acm-std-students.sql` 자동 인식 확인 |
| T-26 | Staging 배포 + smoke test (8 API 엔드포인트) |

---

## 4. 의존성 (Dependencies)

```
T-01 (DB) → T-02 (Entity) → T-04 (Service) → T-06 (Controller)
                          ↘ T-05 (Import Service) ↗
T-03 (DTO) → T-04, T-05, T-06

T-10 (Types) → T-11 (Hooks) → T-13,14,15,16
T-12 ~ T-16 → T-17, T-18
T-19 + T-20 → T-17, T-18 (i18n 라벨)
T-21, T-22, T-23 → 라우팅 완성
```

---

## 5. 리스크 및 대응 (Risks)

| 리스크 | 대응 |
|--------|------|
| TPI 엑셀 컬럼 순서 / 헤더명 불일치 | 파서 유연하게 작성 — 헤더명 매핑 Map 방식, 순서 무관 |
| 중복 upsert 키 충돌 (`std_name` + `std_birth_date` nullable) | birth_date NULL인 경우 upsert 기준에서 이름만 사용, 또는 insert-only |
| xlsx 라이브러리 bundle size (frontend) | 업로드는 서버 사이드 파싱 — 프론트엔드는 `<input type="file">` 전송만, xlsx 라이브러리 불필요 |
| 500행 파싱 메모리 | multer memStorage 500행×20컬럼 ≈ 수십KB — 문제없음 |
| gin_trgm 인덱스 (pg_trgm extension) | `sql/acm/600` 상단에 `CREATE EXTENSION IF NOT EXISTS pg_trgm;` 추가 |

---

## 6. 완료 기준 (Definition of Done)

- [ ] `GET /api/acm/std/students` → 200, 목록 반환
- [ ] `POST /api/acm/std/students` → 201, 생성 확인
- [ ] `PUT /api/acm/std/students/:id` → 200, 수정 확인
- [ ] `DELETE /api/acm/std/students/:id` → 200, soft-delete
- [ ] `POST /api/acm/std/students/import` → TPI 엑셀 업로드 → 성공건수 반환
- [ ] Frontend `/std` 목록 페이지 정상 렌더링
- [ ] Frontend 등록 모달 → 저장 → 목록 반영
- [ ] Frontend 상세 → 수정 → 변경 반영
- [ ] Frontend 엑셀 업로드 모달 → import 결과 표시
- [ ] 사이드바 "학생관리" 메뉴 표시 및 활성화 하이라이트
- [ ] 4개 언어 i18n 라벨 정상 표시
