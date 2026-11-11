---
document_id: REQ-261111
version: 1.2.0
status: IMPLEMENTED
change_log:
  - 2026-11-11 v1.2.0 — 사용자 승인(Q1~Q3 제안대로) 후 구현. 문서 번호 REQ-261103→REQ-261111(수업일정 창 REQ-261103 과 충돌)
  - 2026-11-10 v1.1.0 — 운영 DB 읽기 조회 결과 반영(제약 존재·버그 증거), 마이그레이션 번호 1060
  - 2026-11-03 v1.0.0 — initial analysis (사용자 확인 대기)
---

# REQ-261111 Manual time input for class schedules (수업 시간 직접 입력)

## 1. Request (요청)
`https://acm.amoeba.site/admin/csl`
1. 수업 스케줄 시간 지정이 30분 단위 선택만 있다 → 선택 목록 옆에 **직접 입력 칸** 추가.
   - 신규 상담 각 단계의 수업 시간, 수업 일정의 시간 입력 모두 오전 9시 시작·30분 단위.
   - 30분 단위 선택은 그대로 두고, 수기 입력 칸을 추가한다.
   - 10분 단위 수업이나 오전 9시 이전 수업이 가끔 있어 그때 수기 입력이 필요하다.
2. **버그** — '조율 상태'의 수업 예정일시 변경 시 날짜 선택은 되는데 시간 입력이 활성화되지 않는다.

## 2. Current State (현황 분석)

### 2.1 30분 단위 시간 선택 위치
| # | 화면 | 파일 | 목록 범위 | 서버 검증 |
|---|------|------|-----------|-----------|
| A | 신규 상담 › 2. 레벨테스트 — 일정 입력 | `frontend-acm/src/modules/csl/components/map-test-panel.tsx` | 09:00~22:30 | DTO `:00/:30` + DB CHECK |
| B | 신규 상담 › 레벨테스트 일정 변경 창 | `frontend-acm/src/modules/csl/components/level-test-schedule-dialog.tsx` | 09:00~22:30 | DTO `:00/:30` + DB CHECK |
| C | 신규 상담 › 3. 데모수업 — 새 회차 추가 | `frontend-acm/src/modules/csl/components/trial-class-panel.tsx` | 09:00~22:30 | DTO `:00/:30` + DB CHECK |
| D | 신규 상담 › 3. 데모수업 — 회차 수정 | 동일 파일 `DemoClassRow` | 09:00~22:30 | DTO `:00/:30` + DB CHECK |
| E | 수업일정 › 일정 등록/수정 창 (시작·종료) | `frontend-acm/src/modules/cal/components/cal-event-modal.tsx` | 06:00~23:30 | 제한 없음 — 11-03 REQ-261103(cal-modal)에서 브라우저 시간 입력칸이 이미 추가됨 → 공용 컴포넌트로 교체해 모양 통일 |

> 수업(반) 개설 창(`cls/components/class-create-dialog.tsx`)은 이미 `type="time"` 자유 입력이라 대상 아님.

### 2.2 서버·DB의 30분 제한 (직접 입력을 막는 원인)
- DTO `backend/src/modules/acm-csl/application/dto/inquiry.dto.ts` — `scheduledTime`(2곳)·`heldTime`(2곳)이 `@Matches(/^\d{2}:(00|30)(:\d{2})?$/)`.
- DB CHECK (`sql/acm/985-acm-csl-pipeline-revision.sql`)
  - `chk_acm_csl_mpt_time_30min` — `amb_acm_csl_map_test.mpt_scheduled_time` 분 ∈ {0,30}
  - `chk_acm_csl_tcl_time_30min` — `amb_acm_csl_trial_class.tcl_held_time` 분 ∈ {0,30}
- 화면만 바꾸면 `08:40` 저장 시 400(DTO) 또는 DB 오류가 난다 → **서버·DB 제한 해제가 필수**.
- 운영 DB 확인(2026-11-10, 읽기 전용): 두 제약 모두 존재. 저장된 시간은 데모수업 9건·레벨테스트 22건으로 전부 :00/:30.
  제약 삭제 후 기존 데이터에는 영향 없음.
- 수업일정(E)은 서버 제한이 없고, 저장된 값이 목록에 없으면 그 값을 옵션에 끼워 넣는 처리만 있다.

### 2.3 버그 — 조율 상태의 수업 예정일시
- 위치: 신규 상담 상세·학생 상세의 **수업 스케줄 · 학생 이력** (`frontend-acm/src/modules/dsh/components/lifecycle-editor.tsx`).
  조율 상태 = '수업 스케줄 조율 완료'일 때 나오는 **수업 예정일시 (한국 시간)** 칸.
- 원인: 이 칸만 브라우저 기본 `datetime-local` 입력이다. 브라우저마다 동작이 달라, 달력에서 날짜만 고르고 시간 부분은 직접 키보드로 입력해야 하는 환경(Safari·일부 모바일)에서는 시간을 넣을 방법이 보이지 않는다.
  Chrome 데스크톱에서는 달력 옆에 시·분 목록이 나와 재현되지 않았다(2026-11-03 운영 확인).
- 시간이 비면 값 전체가 비고, 서버는 '조율 완료'에 예정일시가 없으면 400(`Teacher and schedule required`)으로 거부한다 → 사용자에게는 저장이 안 되는 것으로 보인다.
- 운영 기록 증거(2026-11-10, 읽기 전용): 10-08 15:26 작성된 '조율 완료' 기록의 예정 시각이 **15:26**(작성 시각과 동일), 1분 뒤 취소 후 재작성했으나 다시 15:26.
  날짜를 고를 때 브라우저가 현재 시각을 자동으로 채우고 시간을 바꾸지 못한 것으로 보인다. 11-03 기록 2건(18:00·20:00)은 정상 입력.

## 3. Requirements (요구사항)
| ID | 내용 |
|----|------|
| FR-1 | 공용 시간 입력 컴포넌트 `TimeSelectInput` — 기존 30분 선택 목록 + 오른쪽 **직접 입력** 칸(HH:MM). 둘은 같은 값을 공유한다. |
| FR-2 | 직접 입력: `00:00~23:59` 어떤 분이든 허용. 숫자만 입력해도 자동으로 `HH:MM` 형식(예: `840` → `08:40`). 잘못된 값이면 칸 아래 빨간 안내, 저장 값은 바뀌지 않음. |
| FR-3 | 목록에 없는 값(예: `08:40`)이면 선택 목록에 `직접 입력 (08:40)` 항목이 선택된 상태로 보인다. 목록에서 30분 값을 고르면 직접 입력 칸도 그 값으로 바뀐다. |
| FR-4 | 적용 화면: 2.1의 A~E 전부(E는 시작·종료 시간 각각). 30분 목록의 범위는 화면별 기존 값을 유지한다. |
| FR-5 | 서버: 위 DTO 4곳을 `HH:MM(:SS)`, 시 00~23·분 00~59 검증으로 완화. |
| FR-6 | DB: 새 마이그레이션 `sql/acm/1060-csl-time-any-minute.sql` 로 두 CHECK 제약 `DROP CONSTRAINT IF EXISTS`(멱등). 985 파일은 수정하지 않는다(해시 마커로 재실행 방지). |
| FR-7 | 버그: 수업 예정일시를 **날짜 칸 + `TimeSelectInput`** 으로 나눈다. 저장 형식(`YYYY-MM-DDTHH:MM:00+09:00`)은 그대로. 날짜만 있고 시간이 비면 저장 버튼 옆에 "시간을 입력하세요" 안내. |
| FR-8 | i18n: 새 문구(직접 입력, 직접 입력 (값), 형식 안내, 시간 필요 안내)는 ko/en/vi/zh-CN 4개 언어 동시 반영. |

## 4. Non-goals (범위 밖)
- 30분 목록 범위(09:00~22:30 / 06:00~23:30) 자체 변경.
- 수업 길이(종료 시간) 규칙 변경 — 상담 단계 일정의 연동 캘린더 일정 길이는 기존 로직 그대로.
- 수업(반) 개설 창의 시간 입력.

## 5. Decisions (결정, 2026-11-11 사용자 "제안대로")
| # | 질문 | 결정 |
|---|------|------|
| Q1 | 직접 입력 허용 범위 | 00:00~23:59, 1분 단위 전부 허용 |
| Q2 | 수업일정(E) 시작·종료 시간에도 적용 | 적용 |
| Q3 | 버그 화면 | '수업 스케줄 · 학생 이력'의 수업 예정일시 |

## 6. Verification (확인)
- backend: `inquiry-time.dto.spec.ts`(08:40 허용·25:00 거부, DTO 4종), `csl-cal-linker.service.spec.ts` 08:40 데모수업 → 캘린더 시작 23:40Z. acm-csl·acm-dsh 204 tests 통과, `tsc` 통과.
- frontend: `normalizeTime` 14 케이스, `tsc`·`vite build` 통과. 로컬 빌드 + API 목(Playwright 1440px) — `840`→`08:40`·목록 `08:40 · 직접`, `2510` 오류 안내, 수업 예정일시 날짜만 입력 시 "시간을 입력하세요" → 시간 입력 후 사라짐.
- 30분 표기 라벨('시간 (30분)' 등) 4개 언어에서 '(30분)' 제거.
