# PLN-260728F — 보다 강의실 시간기록·피드백·과제·수업완료·녹화본 (Class Record & Completion)

---
document_id: PLN-260728F
version: 0.1.0
status: DRAFT (awaiting user confirmation)
date: 2026-07-28
---

## 0. 기존 기능 설명 (요구 §1 — 상태/출결재동기화/강제폐쇄)

관리자 수업일정 모달의 "BODA 화상 강의실" 박스 (`BodaRoomPanel`):

| 기능 | 설명 |
|---|---|
| **상태** | 강의실 수명주기 배지 — `PENDING`(예약만 됨, 미개설) → `OPEN`(강사 개설, 입장 가능) → `STARTED`(수업 시작) → `PAUSED`(일시중지) → `ENDED`(수업 종료) → `CLOSED`(폐쇄·삭제). 보다스쿨 웹훅(이벤트 1/2/3/4/5)으로 자동 전이 |
| **출결 재동기화** | 웹훅 유실 대비 — 보다 SERVER API(`/svr/meet/log/user/join`)에서 참석자 입·퇴장 이력을 다시 가져와 로컬 출결 기록(`amb_acm_cal_boda_participant`)을 보정 (+신규/~수정 건수 표시) |
| **강제 폐쇄** | 강사가 종료하지 않고 방치된 강의실을 관리자가 보다 서버에 폐쇄 명령(`/svr/meet/close`) — 진행 중이면 확인 후 실행 |

## 1. 요구 매핑 → Phase

| # | 요구 | Phase |
|---|---|---|
| R1 | 실제 개설/입실/퇴실/종료 시간 **기록** (벤더 공식시각) | **A** |
| R2 | 관리자 모달 + **강사/학생 포털 상세**에 시간 **표기** | **A** |
| R3 | 강사 피드백 작성 (rich editor) — 관리자·학생 열람 | **B** |
| R4 | 과제 전달 (텍스트+파일) 또는 "과제 없음" 상태 | **B** |
| R5 | 피드백+과제(또는 없음) → **[수업완료]** 배지 (리스트=아이콘+완료 / 캘린더=완료만) | **B** |
| R6 | 종료된 강의 **녹화본 다운로드** (강사·학생) | **C** |

## 2. Phase A — 시간 기록·표기 (기록 인프라 보정)

- **웹훅 시각 보정**: 벤더 필드 `eventDatetime`(unix 초) 파싱 추가(현재 `eventAt` 명칭 불일치로 수신시각 대체 저장) + `meetIdx` Integer 수용 → `bdr_opened_at(1)/started_at(2)/ended_at(4)/closed_at(5)` 이 **보다 공식 발생시각**으로 기록.
- 입실/퇴실: 기존 웹훅 11/12 (`bdp_joined_at/left_at`) 유지 + 재동기화 보정.
- **표기**:
  - 관리자 모달 BodaRoomPanel: 기존 개설/시작/종료/폐쇄 + **참석자별 입·퇴실 목록** 추가.
  - 포털 상세(`/portal/calendar/:id`): "강의실 기록" 섹션 — 개설·수업시작·종료 시각 + 입·퇴실(강사=참석자 전원, 학생=본인 것만).

```
[포털 상세 — 강의실 기록]
🕐 강의실 기록
  개설      07-28 (월) 15:58   수업 시작  16:00
  수업 종료 16:52              폐쇄       16:55
  입·퇴실   이서연 16:01 → 16:50 (49분)
```

## 3. Phase B — 피드백·과제·수업완료

### 데이터 (999h)
- `amb_acm_cal_event_review` — evt_id UNIQUE, `rvw_feedback_html TEXT`, `rvw_homework_status`(`NONE`|`ASSIGNED`), `rvw_homework_html TEXT`, 작성 강사, created/updated.
- `amb_acm_cal_event_attachment` + `cea_kind`(`GENERAL`|`HOMEWORK`) — 과제 파일은 기존 첨부 인프라 재사용.

### 동작
- **강사 포털 상세**(수업 종료 후 상시): [피드백 작성](tiptap) — 저장 시 관리자 모달·학생 상세에 표시. / [과제] 텍스트(tiptap)+파일(복수) 또는 [과제 없음] 버튼.
- 과제 파일 업로드용 **포털 강사 엔드포인트** 신설 (담당강사만, 기존 S3 인프라 재사용).
- **수업완료** = 피드백 존재 AND 과제상태 입력(ASSIGNED or NONE). 목록 API에 `hasFeedback`/`homeworkStatus`/`classDone` 플래그 포함.
- 표시 (관리자 /admin/cal + 포털 캘린더 공통):
  - 리스트형: 📝(피드백) 📚(과제) 아이콘 + `[수업완료]` 배지
  - 월 캘린더 칸: `✓수업완료` 배지만

```
[리스트형]                              [강사 상세 — 작성 영역]
16:00 중등수학 A반  📝 📚 [수업완료]     ✍ 수업 피드백 (관리자 확인용)  [작성/수정]
17:00 수학 클리닉   📝                   📚 과제  [과제 등록] [과제 없음]
                                        → 텍스트(에디터) + 파일 첨부(복수)
[월 캘린더 칸]
  16:00 중등수학… ✓완료
```

### 학생 상세
- 피드백(강사 작성) + 과제 내용 + 과제 파일 다운로드 표시. 과제 없음이면 "과제 없음".

## 4. Phase C — 녹화본 다운로드

- 보다 API 확인 완료(2026-07-28 조사): `GET /svr/record/log/video?searchType=ROOM&meetKey=` → recordIdx·녹화 시작/종료·fileExist / `GET /svr/record/log/video/{recordIdx}/download` (Basic 인증 필요 → **백엔드 스트리밍 프록시** 필수).
- 백엔드: `GET /portal/cal/events/:id/recordings`(목록) + `.../recordings/:recordIdx/download`(프록시 다운로드) — 참석자·담당강사·관리자 스코프. 관리자용 동일 라우트.
- 표기: 종료된 보다 수업의 상세(강사·학생·관리자 모달)에 "🎬 녹화본" 목록 + [다운로드].

## 5. 검증·배포
- 999h additive 마이그레이션(CD 자동), acm-cal 단위테스트 확장, be/fe tsc·build, 로컬 재현(웹훅 시뮬레이션) 후 A→B→C 순차 PR/배포.
