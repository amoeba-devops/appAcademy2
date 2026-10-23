---
document_id: ACM-ADMIN-USER-REQ-1.0.0
version: 1.0.0
status: Approved
created: 2026-10-24
change_log:
  - version: 1.0.0
    date: 2026-10-24
    description: AMA issue transfer, admin user management page, AMA→local account switch / AMA 이슈 이전·관리자 관리 페이지·AMA→로컬 전환
---
# AMA Issue Transfer & Admin User Management (AMA 이슈 이전 · 관리자 관리)

## 1. Overview (개요)
요청 원문:
1. "이슈 이전 — https://ama.amoeba.site/issues/fee353a9-17eb-4ed7-aa77-285fcd69c054 이 이슈를 acm으로 이전한다."
2. "ACM - 관리자 관리 페이지 신설. (6명) 이 사용자들 AMA 에서 모두 로컬로 변경한다. /admin/config 에 관리자 관리 페이지 신설하고 관리자 등급 사용자 정보수정 페이지 작성한다. 비번 변경, 임시비번 발행 등"

## 2. Part 1 — AMA Issue Transfer (이슈 이전)

### 2.1 Findings
- 선례: REQ-261016C — AMA TPI01 ISN-8·18·23 → ACM ISS-3·4·5. 방식: **AMA 운영 DB 읽기 전용 추출(SELECT 1회, 사용자 허용)** → 멱등 import SQL(`sql/acm/1041`, `pit_source='AMA'` + `pit_source_ref`), 사람은 이메일로 ACM 사용자 매칭(없으면 테넌트 마스터 + 본문에 원래 이메일), 같은 이름 프로젝트(공백 무시, 운영 '학원운영').
- 이번 대상: AMA 이슈 `fee353a9-17eb-4ed7-aa77-285fcd69c054` — 제목·본문·댓글·첨부·담당자는 AMA 에서만 확인 가능(ACM 에서 접근 불가).

### 2.2 Requirements
| ID | 요구사항 |
| --- | --- |
| FR-I1 | AMA 운영 DB 에서 해당 이슈(본문·상태·우선순위·유형·담당/등록/참여자·댓글·첨부 목록·상위 이슈)를 **SELECT 로만** 추출. AMA 원본 변경 없음 |
| FR-I2 | 1041 과 같은 방식의 멱등 마이그레이션(`sql/acm/1050번대`)으로 ACM 이슈(ISS-n) 생성, `pit_source_ref='<AMA 테넌트>#<이슈번호>'` |
| FR-I3 | 첨부 파일: AMA 파일 저장소 접근이 필요 — 파일이 있으면 목록·이름만 본문에 남기고 실제 파일 이전은 별도 결정 (Q-I2) |
| FR-I4 | 배포(CD 자동 적용) 후 운영에서 ISS 번호·본문·댓글 수 확인(읽기 전용) |

## 3. Part 2 — Admin User Management (관리자 관리)

### 3.1 Findings (운영 DB 읽기 전용, 2026-10-24)

| 계정 | 등급 | 로그인 | 비밀번호 | AMA 역할 | 30일 AMA 로그인 | 보조 권한 |
| --- | --- | --- | --- | --- | --- | --- |
| tpijung@tpiglobal.network | 관리자 | AMA | 있음 | MASTER | 4 | |
| tpimorgan@tpiglobal.network | 관리자 | AMA | 있음 | MASTER | 16 | |
| tpiyeri@tpiglobal.network | 관리자 | AMA | 있음 | MASTER | 1 | 서비스 운영자 |
| riskzang9699@gmail.com | 관리자 | AMA | **없음** | MANAGER | 0 | |
| fremd@korea.com | 직원 | AMA | **없음** | MEMBER | 0 | |
| tpitaeyun@tpiglobal.network | 직원 | AMA | **없음** | MEMBER | 0 | |

- 테넌트 활성 콘솔 사용자: 관리자 6(AMA 5·로컬 1 = admin@tpi.co.kr 테넌트 마스터), 직원 2(AMA), 교사 3(로컬).
- **AMA 로 로그인하면 다시 AMA 로 바뀜**: SSO 교환 시 같은 테넌트·이메일 계정을 연결하고 `auth_source='ama'` 로 되돌린다(`acm-auth.service.ts:666`). 2026-10-16 에 TPI 3명을 로컬로 바꿨지만 AMA 로 로그인해 다시 AMA 가 됐다(현재 상태).
- **AMA 계정 전용 기능**(로컬로 바꾸면 쓸 수 없음):
  - 상담 삭제 — `AmaAccountGuard` (REQ-260914G)
  - 학생 삭제 — AMA 관리자(`auth_source='ama'` + `ama_role` MASTER/OWNER/MANAGER) 만 (`student-deletion.service.ts:50`). 현재 해당자 **5명 = 이번 전환 대상 전원** → 전환 후 **삭제할 수 있는 사람이 없어짐**.
- 비밀번호 없는 3명은 로컬 전환 즉시 **로그인 불가** → 임시 비밀번호 발급이 함께 필요.
- 기존 관리 기능: 시스템 관리(`/system/admin`, APP_ADMIN 전용, 모든 테넌트) — 수정·잠금·비밀번호·보조 권한. 비밀번호 요청 처리(`/admin/password-requests`) — 임시 비밀번호 24시간·메일. 테넌트 단위 "관리자 관리" 화면은 없음.

### 3.2 Requirements
| ID | 요구사항 |
| --- | --- |
| FR-A1 | 서비스 설정(`/admin/config`)에 **"관리자 관리"** 카드 → `/admin/config/admins` (서비스 운영자 CONFIG_ADMIN 전용, 서버도 403) |
| FR-A2 | 목록: 이 테넌트의 **관리자·직원** 계정 — 이름·이메일·등급·로그인 방식(AMA/로컬)·보조 권한·상태·가입일·마지막 로그인. 검색·등급·방식 필터 |
| FR-A3 | 상세/수정: 이름·이메일·등급(관리자↔직원)·상태(활성/비활성)·잠금/해제 |
| FR-A4 | **비밀번호 변경**(관리자가 새 비밀번호 직접 지정, 정책 검사) · **임시 비밀번호 발급**(24시간·다음 로그인 시 변경, 메일 발송 또는 1회 표시 — 기존 기능 재사용) |
| FR-A5 | **로그인 방식 전환 AMA→로컬**: 한 명 또는 여러 명 선택 일괄. 비밀번호 없으면 전환과 함께 임시 비밀번호 발급(메일/1회 표시) 안내 |
| FR-A6 | 전환 후 AMA 로 로그인해도 **로컬 유지**(Q-A1) |
| FR-A7 | 자기 자신 비활성·등급 강등·서비스 운영자 권한 제거 금지(잠김 방지). 테넌트 마스터 계정은 등급 변경 금지 |
| FR-A8 | 모든 변경은 감사 활동 로그 + 접속 로그(비밀번호·잠금·임시비번) 기록(P1·P2 자동/기존) |
| FR-A9 | 4개 언어, 운영 콘솔 UI 표준, 모바일 |
| FR-A10 | 요청 6명 전환은 배포 후 이 화면에서 실행(관리자 확인) — Q-A3 |

## 4. Decisions needed (결정 필요)
| Q | 질문 | 제안 |
| --- | --- | --- |
| Q-I1 | AMA 운영 DB 읽기 전용 조회(이슈 1건 추출) 허용 | 1회 허용 필요(지난번과 같음). AMA 원본은 변경하지 않음 |
| Q-I2 | 이슈 첨부 파일 | 파일 이름 목록만 본문에 남기고, 실제 파일은 필요 시 별도 |
| Q-A1 | 로컬 전환 후 AMA 로그인 | **AMA 로그인은 허용하되 로컬 유지**(계정에 "로컬 고정" 표시, SSO 가 AMA 로 되돌리지 않음). 대안: 로컬 전환 계정은 AMA 로그인 차단 |
| Q-A2 | AMA 전용 기능(상담 삭제·학생 삭제) | **"관리자 등급 + 서비스 운영자(CONFIG_ADMIN) 또는 테넌트 마스터"** 로 권한 기준 변경(AMA 여부 무관). 그대로 두면 전환 후 아무도 삭제 못 함 |
| Q-A3 | 6명 전환 실행 | 배포 후 관리자 관리 화면에서 직접 실행. 비밀번호 없는 3명(riskzang9699·fremd·tpitaeyun)은 임시 비밀번호 메일 발송 |
| Q-A4 | 목록 범위 | 관리자·직원(교사는 교사관리 화면에서 관리) |

## 5. Decisions (결정, 2026-10-24 사용자)
제안대로 진행, Q-I1 AMA 운영 DB 읽기 전용 조회 1회 허용.

## 6. Part 1 Result (이슈 이전 결과)
- AMA 원본(읽기 전용 추출): **TPI01 ISN-26** "김다우 학생 모친 SJA BHA 입학 관련 상담 전화 오후 6:30" — 업무(TASK)·열림(OPEN)·우선순위 3·MAJOR·마감 2026-10-23, AMA 프로젝트 '업무', 등록 tpimorgan · 담당 tpijung · 참여 tpiyeri, 본문 2문단, 댓글·첨부 없음. AMA 원본 변경 없음.
- `sql/acm/1051-prj-issue-import-ama-tpi01-isn26.sql` — 1041 규칙(멱등 `TPI01#ISN-26`, 이메일 매칭·대체). ACM 에 '업무' 프로젝트가 없어 같은 이름으로 생성(등록자 관리자).

## 7. Part 2 Implementation (관리자 관리 구현)
- `sql/acm/1052` `usr_local_pinned` — 로컬 고정 계정은 AMA 로그인 시 로그인 방식·등급·이름·이메일 유지(AMA 사용자 ID·역할 스냅숏만 갱신)
- `/api/acm/config/admins` (CONFIG_ADMIN): 목록·상세·수정(본인 강등·비활성·잠금 금지, 테넌트 마스터 등급·상태 고정)·잠금/해제·비밀번호 지정(정책·다음 로그인 변경 선택)·임시 비밀번호(24h·메일/1회 표시)·AMA→로컬 일괄 전환(비밀번호 없으면 임시 발급)
- 상담 삭제·복구, 학생 삭제 = 관리자 + (서비스 운영자 또는 테넌트 마스터) — `RecordDeleteGuard`, `config-access.canDeleteRecords`. 구 `AmaAccountGuard` 제거
- 화면 `/admin/config/admins` (서비스 설정 카드), 상세 대화상자, 4개 언어
