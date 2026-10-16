---
document_id: ACM-MY-WORK-AMA-PARITY-REQ-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-16
change_log:
  - version: 1.1.0
    date: 2026-10-16
    description: Q1–Q4 proposed defaults approved, AMA DB read-only extraction allowed / 제안 기본값 승인
  - version: 1.0.0
    date: 2026-10-16
    description: Migrate AMA TPI01 issues 8·18·23 and match AMA My Work / issue form / 내 업무 AMA 동일화 + 이슈 이전
---
# My Work AMA Parity & Issue Migration Requirements (내 업무 AMA 동일화 · 이슈 이전 요구사항)

## 1. Request (요청)
1. AMA 테넌트 **TPI01**의 `https://ama.amoeba.site/my-work`에 있는 **이슈 8, 18, 23**을 ACM `https://acm.amoeba.site/admin/my-work`의 이슈로 이전한다.
2. ACM 내 업무 화면의 **화면 구성, 아이콘, 색상**을 AMA와 같게 만든다.
3. **이슈 작성 화면과 기능**도 AMA와 같게 구현한다.

## 2. Current State (현재)
| Area | AMA (`ambManagement/apps/web`) | ACM (`frontend-acm`, REQ-261015C) |
|------|-------------------------------|-----------------------------------|
| 레이아웃 | 가운데 목록 + 우측 340px 패널(탭: 오늘의 미션 / 업무 상세), 회색 배경(`bg-gray-50/60`), indigo 계열 | 목록 + 우측 20rem 상세 카드, accent 토큰 |
| 헤더 | 제목 + 부제(담당 n · 지연 n) + 보기 탭(오늘 / 내 프로젝트 / 알림 확인함 / 칸반 / 내 성과) + `+ 새 업무`(indigo) | 제목 + `ListTodo` 아이콘 + `이슈 등록` |
| KPI | 7칸: 오늘의 미션(amber, 진행바) · 배정된 이슈(indigo, 강조) · 오늘 배정(violet) · 지연(red) · 오늘 마감(orange) · 검토 요청(violet) · 오늘 완료(green). 색 점 + 모노 숫자 | 5칸: 배정 · 지연 · 오늘 · 이번 주 · 오늘 완료 |
| 관계 칩 | 내 담당 / 내가 생성 / 알림 받음 / 참여 (단일 선택, 건수) | 배정 / 등록 (토글) |
| 필터 | 유형 세그먼트(전체/이슈/할 일) · 프로젝트 · 검색(돋보기) | 프로젝트 · 검색 |
| 목록 | **오늘 처리**(지연·오늘 마감·검토·미션 사유 배지) → **출처별 섹션**(다른 사람이 맡긴 이슈 indigo / 내가 작성한 내 이슈 sky / 내 태스크 emerald / 내가 만든 응답 대기 gray / 오늘 완료 green, 접기) | 지금 처리 / 이후 / 오늘 완료 |
| 행 | 담당 띠(indigo 4px) · 미션 체크 · 원형 완료 버튼(green) · 유형 칩(이슈 rose `이`) · P1/P2 · ref 번호 · 제목 · 담당 배지 · 사유 배지 · 프로젝트·상태 · 배정일/경과 · D-day(지연 red, 오늘 orange, 7일 내 indigo) · 시작/검토 버튼 | 상태 배지 · 제목 · 시작/완료 버튼 |
| 완료 | 확인 모달(이슈는 완료 상태 선택) · 일괄 완료(저장 바) | 즉시 DONE |
| 이슈 작성 | `+ 새 업무` → 유형 선택(내 할 일 / 협업 업무 / 기존 이슈의 실행 항목) → **IssueFormModal** | IssueFormDialog(프로젝트 select·유형·우선순위·상태·제목·설명 textarea·담당·시작·마감) |
| 이슈 모델 | ref 번호, 상위 이슈, 참여자, 첨부(Drive/로컬/URL), 진행률, 심각도, 영향 모듈, 해결 내용, WBS(Epic/Phase/Milestone/Component), 리치텍스트+멘션, AI 번역, 임시저장 | 유형·우선순위·상태·담당·시작·마감·댓글·상태 이력 (ref·상위·참여자·첨부·진행률 없음) |

## 3. Requirements (상세 요구사항)

### FR-1 Issue Migration (이슈 이전)
- AMA TPI01의 이슈 8·18·23을 ACM 테넌트 …0001(Trinity Academy)의 이슈로 옮긴다. 옮기는 항목: 제목, 설명(HTML), 유형, 우선순위, 상태, 담당자, 등록자, 시작일, 마감일, 진행률, 등록일시, 댓글, 상태 이력, 첨부 링크.
- AMA 상태 → ACM 상태: OPEN/REQUEST/FEEDBACK → `OPEN`, IN_PROGRESS/TEST/RESOLVED 등 진행 계열 → `IN_PROGRESS`, CLOSED/DONE → `DONE`, REJECTED → `REJECTED` (실제 값 확인 후 표로 확정).
- 사람(담당·등록·댓글 작성자)은 **이메일로 ACM 사용자와 매칭**한다. 매칭되지 않으면 이전 실행자로 대체하고 본문 끝에 원래 이름을 남긴다.
- 출처를 남긴다: `pit_source='AMA'`, `pit_source_ref='TPI01#8'` 등. 같은 ref로 다시 실행해도 중복 생성되지 않는다(멱등).
- 대상 ACM 프로젝트: **미결 Q2**.

### FR-2 My Work Screen = AMA (내 업무 화면 동일화)
- AMA `MyWorkPage`의 레이아웃·Tailwind 색상·lucide 아이콘·문구 구조를 그대로 따른다(§2 표 AMA 열). 앱 공통 셸(사이드바·헤더)은 ACM 것을 유지한다.
- 이슈 행에 **ref 번호**(예: `TPI-12`), 담당 띠, 원형 완료, 유형 칩, P1/P2, D-day, 배정일/경과, 시작 버튼을 표시한다.
- 완료는 확인 모달을 거친다(이슈는 DONE/REJECTED 선택). 여러 건 선택 후 **일괄 완료**(최대 AMA와 같은 한도).
- 우측 패널: 업무 상세 탭(상세 / 이력). 상세 = 유형·담당·상태·사유 배지, 프로젝트, 상위 이슈, 등록자, 역할, 마감, 배정일, 등록일, [완료] [전체 화면] 버튼.
- ACM에 없는 AMA 기능(개인 Todo, 오늘의 미션, 알림 확인함, 내 성과, 연결 대화, 시나리오)의 처리 범위: **미결 Q1**.

### FR-3 Issue Form = AMA (이슈 작성 화면 동일화)
AMA `IssueFormModal`과 같은 순서·모양으로 구성한다.
1. 프로젝트(검색 콤보, `[코드] 이름`) / 상위 이슈(검색, 유형 칩·ref 표시)
2. 유형 / (심각도 — Q3)
3. 제목
4. 설명: 리치 텍스트(Tiptap, ACM 기존 의존성) — 멘션은 **Q3**
5. AI 번역 패널(KO/EN/VI) — **Q3**
6. 우선순위 / 담당자(검색 선택, 기본=나)
7. 참여자(다중 선택, 담당자 제외)
8. 파일 첨부: [파일 업로드](드래그앤드롭, ACM 객체 저장소 또는 회사 Drive) / [URL 등록] 탭
9. (영향 모듈 — Q3) · 수정 시 해결 내용
10. 시작일 / 마감일 / 진행률(0–100, 10 단위 슬라이더)
11. 임시 저장: 3초마다 브라우저에 저장, 다시 열면 복원/삭제 배너
- 등록/수정/상세 화면과 프로젝트 이슈 탭이 같은 폼을 쓴다.
- `+ 새 업무` 진입은 **Q1** 결정에 따라 유형 선택 단계를 둘지 정한다.

### FR-4 Data Model (데이터 모델 확장)
`amb_acm_prj_item`(ISSUE)에 추가: `pit_ref_seq`(테넌트별 순번, 화면 `TPI-n`), `pit_parent_id`, `pit_done_ratio`, `pit_resolution`, `assigned_at`, `pit_source`/`pit_source_ref`. 신규 테이블: `amb_acm_prj_issue_participant`, `amb_acm_prj_issue_attachment`(객체 키·Drive ID·URL).

### NFR
- 4개 언어(ko/en/vi/zh-CN) i18n, 하드코딩 금지.
- 권한: 테넌트·프로젝트 참여 범위 서버 검사(기존과 동일). 참여자는 이슈 조회 가능.
- 설명은 HTML로 저장하고, 화면은 읽기 전용 Tiptap으로 그려 스키마 밖 태그·속성을 버린다(XSS, `dangerouslySetInnerHTML` 미사용).
- 모바일(<lg)에서는 우측 패널이 아래로 내려간다(AMA와 동일).

## 4. Open Questions (미결)
| Q | 내용 | 제안 기본값 |
|---|------|------------|
| Q1 | AMA 전용 기능 범위 — 오늘의 미션·개인 Todo·알림 확인함·내 성과·연결 대화 | **1차 제외.** 보기 탭은 `오늘 / 내 프로젝트 / 칸반`만, KPI 미션 칸 제외(6칸), `+ 새 업무`는 바로 이슈 폼. 제외 기능은 2차 REQ |
| Q2 | 이전할 ACM 프로젝트 | AMA 이슈의 프로젝트명과 같은 ACM 프로젝트가 있으면 그곳, 없으면 같은 이름으로 ACM 프로젝트 생성 |
| Q3 | 폼의 심각도·영향 모듈·WBS·멘션·AI 번역 | 심각도·WBS·영향 모듈은 TPI01 AMA 법인 설정에서 숨김이면 제외. **멘션·AI 번역은 2차**(번역은 테넌트 AI 설정 재사용 예정) |
| Q4 | AMA 운영 DB 조회 권한 | 이슈 8·18·23 내용 확인을 위해 AMA 프로덕션 DB 읽기 전용 조회(`SELECT`만) 1회 허용 필요 |
| Q5 | 이전 후 AMA 원본 | AMA는 건드리지 않는다(읽기만) |
