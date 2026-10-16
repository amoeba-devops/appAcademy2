---
document_id: ACM-MY-WORK-AMA-PARITY-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
related: REQ-261016C-my-work-ama-parity
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Q1–Q4 proposed defaults approved, AMA DB read-only extraction allowed / 제안 기본값 승인
  - version: 1.0.0
    date: 2026-10-16
    description: Work plan with UI mockups / 작업 계획 + 화면 구성안
---
# My Work AMA Parity Work Plan (내 업무 AMA 동일화 작업 계획)

> 미결 Q1–Q3은 REQ의 **제안 기본값** 기준으로 작성했다. 결정이 바뀌면 해당 WP만 조정한다.

## 1. UI Mockups (화면 구성안)

### 1.1 /admin/my-work (AMA 동일, 미션·알림함·성과 제외안)
```
┌──────────────────────────────────────────────────────────────┬──────────────────────┐
│ 내 업무                              [오늘|내 프로젝트|칸반] [+ 새 업무] │ [업무 상세]          │
│ 담당 7건 · 지연 2건                    (선택 탭=indigo-600 흰 글자)       ├──────────────────────┤
│                                                                │ 이슈 ·담당· 진행 중  │
│ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐  │ [지연] TPI-18        │
│ │●배정이슈││●오늘배정││●지연    ││●오늘마감││●검토요청││●오늘완료│  │ 상담 등록 화면 개선  │
│ │ 7      ││ 1      ││ 2 (red)││ 1      ││ 0      ││ 3      │  │ 프로젝트  ACM 운영   │
│ └indigo──┘└violet──┘└red─────┘└orange──┘└violet──┘└green───┘  │ 상위 이슈 TPI-8 →    │
│ 관계  (내 담당 7) (내가 생성 3) (참여 1)                        │ 등록자    Gray Kim   │
│ [전체|이슈]  [프로젝트·전체 ▾]  [🔍 제목·프로젝트·번호]           │ 역할      담당       │
│                                                                │ 마감      D+2 (red)  │
│ 오늘 처리 ③  지연·오늘 마감·검토 요청                 전체 선택 │ 배정일    2026-10-14 │
│ ┌──────────────────────────────────────────────────────────┐  │ 등록일    2026-10-10 │
│ ▌□ ◯ [이] P1 TPI-18 상담 등록 화면 개선   20261014·2일  D+2 [시작]│ [완료] [전체 화면]   │
│ ▌   (담당)(지연) ACM 운영 · 진행 중                          │  │                      │
│ ▌□ ◯ [이]    TPI-23 출결 알림 문구        20261015·1일  오늘    │  │ [상세|이력] 탭       │
│ └──────────────────────────────────────────────────────────┘  │                      │
│ 나머지 업무                                       ● 담당 ● 관여 │                      │
│ ▼ ● 다른 사람이 맡긴 이슈 2   (indigo)   지연 1 · 오늘 1          │                      │
│ ▼ ● 내가 작성한 내 이슈 3     (sky)                              │                      │
│ ▼ ● 내가 만든 응답 대기 1     (gray)                             │                      │
│ ▶ ● 오늘 완료 3              (green, 기본 접힘)                  │                      │
├────────────────────────────────────────────────────────────────┤                      │
│ 2건 선택 (이슈 2)                        [선택 해제] [완료 처리] │ ← 선택 시 하단 고정바 │
└──────────────────────────────────────────────────────────────┴──────────────────────┘
▌= indigo-600 담당 띠   ◯ = 원형 완료(hover green)   [이] = rose-50/rose-600 유형 칩
D-day: 지연 red-600 · 오늘 orange-600 · 7일 내 indigo-600 · 그 외 gray-400 (MM/DD)
```

### 1.2 완료 확인 모달
```
┌ 업무 완료 ─────────────────────────┐
│ TPI-18 상담 등록 화면 개선          │
│ 완료 상태  (●완료) (○반려)          │
│ 메모 [                          ]   │
│                    [취소] [완료]    │
└─────────────────────────────────────┘
```

### 1.3 이슈 등록/수정 모달 (AMA IssueFormModal 순서)
```
┌ 이슈 등록 ──────────────────────────────────────── ✕ ┐
│ ⟲ 저장된 임시 작성본이 있습니다 (10/16 14:02) [복원][삭제] │ amber 배너
│ 프로젝트                     상위 이슈                  │
│ [🔍 프로젝트 검색      ]     [🔍 상위 이슈 검색     ]   │
│ 유형                                                     │
│ [작업 ▾]                                                 │
│ 제목                                                     │
│ [                                                   ]    │
│ 설명  (B I • 1. 링크 — Tiptap 툴바)                      │
│ [                                                   ]    │
│ 우선순위             담당자                              │
│ [보통 ▾]             [🔍 Gray Kim ✕]                     │
│ 참여자  (홍길동 ✕) (+ 추가)                              │
│ 파일 첨부  [⇪ 파일 업로드] [🔗 URL 등록]                 │
│ ┌ ⇪ 파일을 끌어다 놓거나 클릭 ─────────────────────┐    │
│ └ 회사 Drive 또는 ACM 저장소에 저장됩니다 ─────────┘    │
│ 📄 기획서.pdf  1.2 MB                          🗑        │
│ 해결 내용 (수정 시에만)                                  │
│ 시작일 [    ]   마감일 [    ]   진행률 (40%) ──●────     │
│                                       [취소] [이슈 등록] │
└──────────────────────────────────────────────────────────┘
max-w-2xl · rounded-xl · 입력 rounded-lg border-gray-300 focus:border-indigo-500 · 주버튼 indigo-600
```

## 2. Work Packages (작업 단위)

| WP | 내용 | 주요 파일 |
|----|------|-----------|
| WP1 DB | `1040-prj-issue-ama-parity.sql`(멱등): `pit_ref_seq`+테넌트별 채번 테이블, `pit_parent_id`, `pit_done_ratio`(0–100 CHECK), `pit_resolution`, `assigned_at`(기존 행 = created_at 백필), `pit_source`/`pit_source_ref`(+uq), `amb_acm_prj_issue_participant`, `amb_acm_prj_issue_attachment` | `sql/acm/1040-*.sql` |
| WP2 BE | `ItemDto` 확장(parentId·participantIds·doneRatio·resolution·attachments), 담당 변경 시 `assigned_at` 갱신, 상위 이슈 같은 프로젝트·순환 금지, 참여자 = 프로젝트 멤버, 설명 HTML sanitize. `my-work` 응답에 ref·상위·참여·배정일·역할(ASSIGNEE/REPORTER/PARTICIPANT)·사유(OVERDUE/TODAY) 추가. `POST issues/:id/attachments`(업로드: 객체 저장소/Drive, URL 등록), `GET …/download`, `DELETE`. `POST issues/bulk-status`(일괄 완료) | `acm-prj/application/*`, `presentation/issue.controller.ts` |
| WP3 FE 내 업무 | `my-work-page.tsx` 재작성 + `my-work/` 하위 컴포넌트(MyWorkRow, DueTag, WorkDetailPanel, CompleteConfirmModal, MyWorkKanban, MyProjectsView, groupMyWork 유틸). AMA 색·아이콘 그대로, 날짜는 테넌트 TZ | `frontend-acm/src/modules/prj/issues/my-work/*` |
| WP4 FE 이슈 폼 | `issue-form-dialog.tsx` → AMA 구조. 프로젝트·상위 이슈 검색 콤보, 담당/참여자 선택, Tiptap(기존 `mini-rich-editor` 확장), 첨부 탭, 진행률, 임시 저장(localStorage, try/catch). 상세 페이지 설명·첨부·참여자·상위 이슈 표시 | `issues/issue-form-dialog.tsx`, `issue-detail-page.tsx` |
| WP5 i18n | `myWork.*`, `issues.form.*` 4개 언어 | `i18n/locales/*/common.json` |
| WP6 이전 | AMA에서 이슈 8·18·23 읽기 전용 추출(JSON) → 검토 → ACM 반영 스크립트(멱등, `pit_source_ref` 기준). 사람 = 이메일 매칭. 첨부는 링크로 이전(파일 재업로드는 Drive 링크면 링크 유지) | `scripts/migrate-ama-issues.ts` (일회성) |
| WP7 테스트 | BE 단위(전이·채번·상위 순환·sanitize·멱등 이전), 통합(it-prj-issue), FE 빌드·lint, 로컬 브라우저 확인(3009) | `backend/test/integration/acm/*` |
| WP8 배포 | PR → staging 확인 → production dispatch → 이전 스크립트 운영 실행 → `/admin/my-work`에서 3건 확인 → RPT | `docs/implementation/RPT-261016C-*.md` |

## 3. Migration Steps (이슈 이전 절차)
1. (권한 필요) AMA 프로덕션 DB에서 TPI01 법인의 `iss_ref_number` 또는 순번 8·18·23 이슈, 댓글, 상태 이력, 참여자, 첨부 링크를 **SELECT만** 해 JSON으로 저장.
2. 추출 내용을 사용자에게 보여 주고 상태·사람·프로젝트 매핑 표를 확정.
3. 스테이징에서 리허설 → 운영 적용. 재실행해도 중복 없음.

## 4. Risks (위험)
- AMA 상태 체계(11단계)가 ACM 4단계로 줄어들며 세부 상태가 사라짐 → 원래 상태를 상태 이력 메모로 남긴다.
- 리치 텍스트 도입으로 기존 plain text 설명 → 렌더 시 텍스트면 문단으로 감싸 호환.
- 첨부 업로드는 `ACM_S3_*` 미설정 시 503 → Drive 연결 또는 URL 탭 안내.

## 5. Estimate (예상)
WP1–2 1일, WP3 1.5일, WP4 1일, WP5–7 0.5일, WP6·8 0.5일.

## 6. Implementation Notes (구현 결과, 2026-10-16)
| 항목 | 계획 | 구현 |
|------|------|------|
| KPI | 6칸(검토 요청 포함) | ACM에 TEST(검토) 상태가 없어 **검토 요청 → 7일 내 마감**(sky)으로 대체. 나머지 5칸은 AMA 색 그대로 |
| 관계 칩 | 내 담당/내가 생성/참여 | 동일. AMA의 ‘알림 받음’(Watcher)은 ACM에 없어 제외 |
| 일괄 완료 | `POST issues/bulk-status` | 별도 API 없이 AMA처럼 항목별 상태 API 순차 호출(서버 전이 규칙 그대로) |
| 이슈 번호 | `pit_ref_seq` | `pit_ref_no` + 테넌트별 채번 테이블·INSERT 트리거, 화면 `ISS-n`. 목록 검색에서 `ISS-n`/숫자 검색 |
| 첨부 | 이슈 첨부 업로드 API | 기존 프로젝트 파일 업로드(회사 Drive/ACM 저장소)를 재사용하고 `amb_acm_prj_issue_attachment`로 연결. URL 첨부 지원 |
| 설명 렌더 | 서버 sanitize | HTML 저장, 보기는 **읽기 전용 Tiptap**(스키마 밖 태그 제거, `dangerouslySetInnerHTML` 미사용) |
| 이전 | 일회성 스크립트 | 멱등 SQL `sql/acm/1041-prj-issue-import-ama-tpi01.sql`(CD 자동 적용). 사람=이메일 매칭, 없으면 테넌트 마스터로 대체 + 본문/댓글에 원래 이메일 기록. AMA 상태 이력은 ACM 4단계로 변환(같은 상태 전이 생략). 댓글 HTML은 텍스트로 변환 |
| ISN-18 프로젝트 | 같은 이름 | AMA에서 프로젝트가 없어 **학원 운영**에 배치 |

### 이전 대상 (AMA TPI01, 읽기 전용 추출)
| AMA | 제목 | 상태 | 프로젝트 | 등록 → 담당 | 마감 | 진행률 | 댓글 |
|-----|------|------|----------|-------------|------|--------|------|
| ISN-8 | 김준연 학생 컨설팅 프로세스 완료 시기 체크 | 진행(P2) | 학원 운영 | tpimorgan → tpijung | 10-05 | 0% | 5 |
| ISN-18 | 데일리 학생 팔로업 컨택트 | 진행 | (없음→학원 운영) | tpimorgan → tpiyeri, 관련자 tpijung | — | 0% | 0 |
| ISN-23 | 학생 불참 시 TPI 연락 책임 없도록 가이드 변경 | 진행 | 학원 운영 | tpimorgan → tpiyeri, 관련자 tpijung·tpimorgan | 10-14 | 100% | 3 |

### 검증
- BE `tsc` 0 error, eslint 0, 단위 8/8, 통합 `it-prj-issues` 9/9(1040 두 번 적용 멱등, 번호·상위 순환·참여자·첨부·배정 시각).
- FE `tsc`·`vite build` 통과. 로컬 DB 사본에서 1040·1041 적용(재실행 시 중복 없음) 후 헤드리스 브라우저로 내 업무·이슈 등록·상세 화면 확인.
- 참고: `1035`는 사전순으로 `999x`보다 먼저 실행되어 빈 DB에서는 실패한다(기존 문제, 운영은 이미 적용되어 영향 없음).
