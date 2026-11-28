---
document_id: PLN-261128-CAL
version: 1.1.0
status: APPROVED
change_log:
  - 2026-11-28 v1.1.0 — 사용자 확인("이대로 진행"), 구현
  - 2026-11-28 v1.0.0 — initial plan (사용자 확인 대기)
---

# PLN-261128-CAL Calendar category management · color picker (일정 분류 관리 · 컬러피커)

Related: [REQ-261128-CAL](../analysis/REQ-261128-cal-category-manage.md)

## 1. Screen Layout (화면 구성안)
```
① /admin/cal 상단 도구줄 (관리자)
 색상 기준 [분류 ▾]  [분류 관리]  [색상 설정]
 ● 정규수업  ● 데모수업  ● 레벨테스트  ● 미팅  ● 기타  ● 수업 가능 시간  ● 수업 불가능 시간  ● 휴강  ● 결강

② [분류 관리] 모달
 ┌ 분류 관리 ─────────────────────────────────────────────────┐
 │ 순서  이름              색상          통계 포함   관리         │
 │ ↑↓   정규수업  (기본)    [■] #3B82F6   ☑          —            │
 │ ↑↓   데모수업  (기본)    [■] #10B981   ☑          —            │
 │ ↑↓   레벨테스트(기본)    [■] #F97316   ☑          —            │
 │ ↑↓   미팅      (기본)    [■] #6B7280   ☑          —            │
 │ ↑↓   기타      (기본)    [■] #6B7280   ☑          —            │
 │ ↑↓   [수업 가능 시간  ]  [■] #22C55E   ☐          [삭제]        │
 │ ↑↓   [수업 불가능 시간]  [■] #EF4444   ☐          [삭제]        │
 │ ↑↓   [휴강            ]  [■] #A855F7   ☐          [삭제]        │
 │ ↑↓   [결강            ]  [■] #F43F5E   ☐          [삭제]        │
 │ [+ 분류 추가]                                                  │
 │ ⓘ 기본 분류는 화상수업·상담 일정과 연결되어 이름을 바꾸거나 삭제할 수 없습니다. │
 │                                         [취소]  [저장]         │
 └────────────────────────────────────────────────────────────┘
 삭제 클릭 → "이 분류의 일정 N건은 그대로 남고, 새 일정에서는 고를 수 없습니다. 삭제할까요?"
 모바일: 한 분류 = 카드 한 장 (이름 / 색상 / 통계 포함 / 삭제 세로 배치)

③ 색상 칸 [■] 클릭 → 컬러피커 팝오버
 ┌──────────────────────────┐
 │ ███████ 색상 선택 영역     │  ← 브라우저 기본 컬러피커 (input type=color)
 │ HEX [#3B82F6]            │  ← 직접 입력, 형식 틀리면 빨간 안내
 │ 추천 ● ● ● ● ● ● ● ●     │  ← 기존 8색 빠른 선택
 │ 미리보기 ┌───────────────┐│
 │         │17:00 | 홍길동  ││  ← 카드 배경·글자색 자동 계산 결과
 │         └───────────────┘│
 └──────────────────────────┘

④ [색상 설정] 모달 (담당 강사 색) — 팔레트 동그라미 8개 → 같은 컬러피커로 교체

⑤ 일정 작성·수정 모달 — 분류 선택
 분류 [정규수업 ▾]   목록 = 사용 중인 분류 (순서대로)
 수정 시 삭제된 분류의 일정이면: "휴강 (삭제된 분류)" 로 표시·유지

⑥ 강사 포털 /portal/calendar — 분류 필터·카드 2번째 줄·모달 "과목" 이 같은 목록·이름을 사용
```

## 2. Data Model (데이터)
`sql/acm/1073-cal-category.sql` (멱등)
```sql
CREATE TABLE IF NOT EXISTS amb_acm_cal_category (
  cct_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ent_id UUID NOT NULL,
  cct_code VARCHAR(20) NOT NULL,          -- 기본: REGULAR_CLASS… / 추가: C_xxxxxxxx
  cct_name VARCHAR(40),                   -- 추가 분류 이름 (기본 분류는 NULL → i18n)
  cct_is_system BOOLEAN NOT NULL DEFAULT false,
  cct_in_stats BOOLEAN NOT NULL DEFAULT true,
  cct_sort_order INT NOT NULL DEFAULT 0,
  created_at / updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_acm_cal_category_code UNIQUE (ent_id, cct_code)
);
```
- 테넌트마다 기본 5개(시스템)와 추가 4개를 넣는다. 추가 4개는 `AVAILABLE`, `UNAVAILABLE`, `CANCELED`, `ABSENT`이며 통계 제외로 둔다. 이미 있으면 건너뛴다.
- `amb_acm_cal_event.evt_category` CHECK 제약은 삭제한다. 앞으로 분류 검증은 서비스에서 한다(기본 코드 + 해당 테넌트의 분류 코드).
- 색상 저장 위치는 `amb_acm_cal_color_setting` 그대로다. `ccs_palette`에 팔레트 이름 대신 `#RRGGBB`를 저장한다. 기존 행은 같은 색의 HEX로 바꾼다(UPDATE).

## 3. Backend (`acm-cal`)
| Task | Detail |
|------|--------|
| B-1 | `CalCategoryService` — 목록 조회, 일괄 저장(추가·수정·순서), 삭제(숨김). 기본 분류는 이름 변경·삭제 시 422 |
| B-2 | API `GET/PUT /acm/cal/categories`, `DELETE /acm/cal/categories/:code`. 삭제 응답에 사용 중인 일정 건수 포함 (ADMIN) |
| B-3 | 일정 생성·수정 DTO: `@IsIn` 고정 목록 대신 "해당 테넌트의 사용 중인 분류" 검증. 수정 시 기존 값(삭제된 분류) 유지는 허용 |
| B-4 | `normalizeCalCategory`: 테넌트 분류 코드는 그대로 통과. 알 수 없는 코드만 OTHER |
| B-5 | 통계: `byCategory`는 동적 분류로 집계. `cct_in_stats=false` 분류는 건수·시간 합계에서 뺀다 |
| B-6 | 색상 저장 검증: `#RRGGBB` (기존 팔레트 이름도 읽기 호환) |
| B-7 | 포털 API `GET /portal/cal/categories` (이름·색상, 읽기 전용) |
| B-8 | 단위 테스트: 분류 검증, 기본 분류 보호, 통계 제외, 색상 형식 |

## 4. Frontend (`frontend-acm`)
| Task | Detail |
|------|--------|
| F-1 | `useCalCategories()` 훅 — 하드코딩된 5곳을 대체: 작성 모달, 달력 필터, 범례, 통계 2곳, 포털 캘린더 |
| F-2 | `cal-category-manager.tsx` — ② 분류 관리 모달 (추가·수정·순서·삭제 확인) |
| F-3 | `color-picker.tsx` — ③ input color + HEX + 추천 8색 + 미리보기 |
| F-4 | `calendar-colors.tsx` — 색은 HEX 하나만 받고, 배경(연하게)·글자(진하게)·테두리 색을 계산한다. 글자 대비가 4.5:1 미만이면 글자색을 더 어둡게 한다 |
| F-5 | 분류 이름 표시: 기본 분류·추가 4개는 `t('category.X')`, 관리자가 추가한 분류는 입력한 이름 |
| F-6 | i18n 4개 언어: `cal.categoryManage.*`, `cal.category.{AVAILABLE,UNAVAILABLE,CANCELED,ABSENT}`, `cal.colors.picker.*` |

## 5. Test & Deploy (검증·배포)
- backend: jest + tsc. frontend: tsc + build. 마이그레이션은 로컬 DB 복사본에서 두 번 실행해 멱등인지 확인한다.
- 배포 후 운영 확인:
  - 9개 분류가 들어갔는지, 기존 색상 설정이 HEX로 바뀌었는지 (SELECT)
  - 기존 일정 건수가 그대로인지
  - 번들 grep, 오류 로그 0
- 롤백: 새 테이블과 HEX 값이 있어도 이전 코드는 기본 5개로 동작한다. 단 HEX 색상은 회색으로 보인다. CHECK 제약은 되돌리지 않는다.

## 6. Decisions to Confirm (확인 필요)
1. 삭제 방식은 **숨김**(기존 일정은 유지·표시)으로 한다. 기존 일정을 '기타'로 옮기는 방식은 쓰지 않는다.
2. 기본 5개 분류는 이름 변경·삭제를 막는다. 색상과 순서는 바꿀 수 있다.
3. 추가 4개(수업 가능/불가능 시간·휴강·결강)는 **통계 제외**를 기본값으로 둔다.
4. 수업 가능/불가능 시간은 **표시용**으로만 쓴다. 예약 차단·충돌 검사는 범위에서 뺀다.

## 7. Implementation Notes (구현 메모)
- Decisions 1–4 confirmed as written.
- Category codes: system 5 fixed; seeded `AVAILABLE` / `UNAVAILABLE` / `CANCELED` / `ABSENT`; admin-added `C_` + 8 hex.
- Tenants without rows are seeded lazily on first use (`CalCategoryService.ensureDefaults`); 1073 seeds tenants that already use the calendar.
- Category colors stay in `amb_acm_cal_color_setting` (kind `CATEGORY`); the category manager saves name/order/stats flag and color together. The [색상 설정] dialog now edits assignee colors only.
- Legacy palette hex values keep their exact original card tones (`toneOf`), so the calendar looks the same after 1073.
- External scheduler API reports tenant categories as `OTHER` (`systemCalCategory`).
- Recurrence generation may keep a since-deleted category (copies of existing events); new events and edits that change the category require an active one.
- Verified: backend jest (acm-cal · acm-integration · csl linker) 235 pass, tsc; 1073 run 3× on a local DB copy; service SQL run against it; derived text contrast ≥ 4.5:1.
