---
document_id: ACM-MENU-TENANT-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-15
change_log:
  - version: 1.1.0
    date: 2026-10-15
    description: User decisions on Q1–Q7 recorded; approved for implementation / 미결 사항 확정·구현 승인
  - version: 1.0.0
    date: 2026-10-15
    description: Implementation plan with UI mockups for REQ-261015C / 메뉴 그룹·테넌트마스터 구현 계획
---
# Menu Groups and Tenant Master Plan (메뉴 구조·테넌트 마스터 작업 계획)

요구사항: [REQ-261015C](../analysis/REQ-261015C-menu-groups-tenant-master.md). 아래 목업은 미결 사항(Q1–Q7)의 제안 기본값을 반영했다.

## 1. UI Mockups (화면 구성안)
### 1.1 Sidebar (좌측 메뉴)
```text
┌ ACM ───────────────────┐
│ ▾ 학원관리              │
│   대시보드              │
│   신규상담              │
│   학생관리      ▸ 사이트 │
│   학부모관리            │
│   교사관리              │
│   수업통계              │
│   고객불만              │
│   수납관리              │
│   ─ (Q1: 기존 기타 메뉴) │
│ ▾ 업무관리              │
│   로비채팅              │
│   내 업무        (신규) │
│   이슈           (신규) │
│   프로젝트              │
│   문서                  │
│   드라이브              │
│ ───────────────────── │
│ ⚙ 테넌트 설정  ← 테넌트 마스터만
│ ⚙ 서비스 설정  ← 서비스 운영자만
│ 🛡 System admin ← APP_ADMIN만
└────────────────────────┘
```
- 그룹 안 항목은 등급별 노출 결과에 따라 숨겨진다. 그룹 안에 남은 항목이 0개면 그룹 머리글도 숨긴다.
- 모바일 드로어에서도 같은 그룹 구조를 쓴다.

### 1.2 My Work (내 업무 · /admin/my-work)
```text
내 업무   전체 12 · 지연 2                                   [+ 이슈 등록]
┌배정 7┐┌지연 2┐┌오늘 마감 1┐┌이번 주 3┐┌오늘 완료 2┐      ← 클릭하면 필터
[배정됨] [내가 등록]   [프로젝트 ▾] [검색..............]
━━ 오늘 처리 (3) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ● 지연   교재 발주 확인     겨울특강 준비  · 마감 10.13 · 높음   [시작][완료]
 ● 오늘   상담 일정 공지     신학기 홍보    · 마감 10.15 · 보통   [완료]
── 이후 ─────────────────────────────────────────────────────────
 ○ 10.20  강의실 배정표      겨울특강 준비  · 낮음                [시작]
▸ 오늘 완료 (2)
                                    │ 오른쪽 상세 패널(선택 시)
                                    │ 제목 · 상태 · 담당 · 마감 · 설명
                                    │ [상태 변경 ▾] [전체 보기 →]
```

### 1.3 Issues (이슈 · /admin/issues, /admin/issues/:id)
```text
이슈                                                     [+ 이슈 등록]
[목록 | 칸반]
[전체 | 내 배정 | 내 등록]  [검색.............] [검색]
유형: [작업][기능][버그][의견][기타]   상태: [열림][진행][완료][반려]
[우선순위 ▾] [프로젝트 ▾] [담당자 ▾]                  [정렬: 생성 최신 ▾]
# │ 유형 │ 제목                │ 프로젝트     │ 상태 │ 우선순위 │ 담당  │ 마감  │ 생성
12│ 버그 │ 출결 알림 누락      │ 운영 개선    │ 진행 │ 높음     │ 김OO  │ 10.20 │ 10.14
                                              페이지 크기 [20 ▾]  ‹ 1 2 3 ›

칸반:  열림 │ 진행 │ 완료  (드래그로 상태 변경, 허용된 전이만)

상세 /admin/issues/:id
[← 이슈] #12 출결 알림 누락  [버그][높음]             [수정][삭제]
등록자 · 담당자[선택] · 프로젝트 · 시작/마감 · 생성일    │ 상태: 진행
[설명 | 이력]                                          │ [완료로] [열림으로]
설명 본문                                              │ 메모 [........]
[댓글 (3)]  댓글 목록 · 작성/수정/삭제(본인)
```

### 1.4 Tenant Settings (테넌트 설정 · /admin/tenant)
```text
테넌트 설정 — Trinity Academy
[메뉴 노출] [일반(기본 타임존)]                            ← Q2
메뉴 노출: 시스템 관리자가 허가한 메뉴만 표시됩니다.
메뉴            │ 관리자 │ 강사 │ 직원
── 학원관리 ──
대시보드        │  ■ 고정 │ ■ 고정│ ■ 고정
신규상담        │  ☑     │ ☐    │ ☑
학생관리        │  ☑     │ ☑    │ ☑
수납관리        │  ☑     │ ☐(잠김: 정책상 불가) │ ☑
── 업무관리 ──
내 업무         │  ☑     │ ☑    │ ☑
…
                                  [초기화(전체 노출)] [저장]
```

### 1.5 Portal My Page (포털 마이페이지 · /portal/me)
```text
마이페이지
이름  홍길동   로그인 ID  student@example.com   구분  학생
타임존  [테넌트 기본 따름 (Asia/Seoul) ▾]
        미리보기: 10/16 19:00 (서울) · 10/16 17:00 (호치민)
비밀번호 변경 [→]
                                                      [저장]
```
- 일정, 수업, 공지 시각에 같은 병기 포맷을 적용한다. 타임존이 같으면 한 번만 표시한다.

### 1.6 System Users (시스템 사용자 관리 · /system/admin)
```text
사용자 관리
테넌트 [선택하세요 ▾]  [검색..........] [역할 ▾]           [+ 사용자 추가]
(선택 전) "테넌트를 선택하면 사용자 목록이 표시됩니다."
(선택 후) 이름 │ 이메일 │ 역할 │ 권한(서비스운영/테넌트마스터) │ 상태 │ 작업
```
- 시스템 테넌트 상세(`/system/tenants/:entId`)에 테넌트 마스터 지정/해제를 추가한다.

## 2. Data and API (데이터·API)
| 구분 | 내용 |
|---|---|
| 권한 | `amb_acm_user_permission` 권한 코드에 `TENANT_MASTER`를 추가한다(CHECK 확장). `TenantMasterGuard`를 신설한다. 기존 CONFIG_ADMIN 표시명은 "서비스 운영자" |
| 지정 | 마이그레이션 `sql/acm/1035-tenant-master.sql`: 권한 추가와 admin@tpi.co.kr 지정. 계정이 없으면 건너뛰고 NOTICE를 남겨 멱등을 보장한다. 시스템 API는 `POST/DELETE /acm/system/tenants/:entId/masters` |
| 등급별 메뉴 | 신규 `amb_acm_tenant_role_menu(trm_id, ent_id, trm_role, trm_menu_key, trm_visible, created_at, updated_at)`, `uq_acm_trm_ent_role_key`. API `GET/PUT /acm/tenant/menus`(테넌트 마스터). `GET /acm/me/menus`는 역할별 결과를 반환 |
| 이슈 확장 | `amb_acm_prj_item`에 `pit_issue_type`, `pit_priority SMALLINT`, `reporter_id`, `start_date`를 추가한다. 상태 매핑은 Q4 확정 후 진행. 신규 `amb_acm_prj_issue_comment`, `amb_acm_prj_issue_status_log` |
| 이슈 API | `GET /acm/prj/issues`(서버 필터·정렬·페이지), `GET /acm/prj/issues/:id`, `PATCH .../status`, 댓글 CRUD, `GET /acm/prj/my-work`(요약 + 항목) |
| 타임존 | `amb_acm_portal_account.pac_timezone`, `amb_acm_user.usr_timezone`(Q7) 추가. `GET/PUT /portal/me`, `PUT /acm/me/profile`. 프론트 `formatDual(date, tenantTz, userTz)`는 `lib/tz.ts`에 둔다 |
| 시스템 사용자 | 기존 `GET /acm/system/users?entId=`를 사용하고 화면만 변경 |

## 3. Work Packages (구현 순서 · PR 단위)
1. **WP1 메뉴 그룹 + 시스템 사용자 테넌트 선택**: 프론트 위주라 위험이 낮다. 메뉴 키 `myWork`, `issues`를 등록하고 화면은 준비 중으로 둔다.
2. **WP2 테넌트 마스터 + 서비스/테넌트 설정 분리 + 등급별 메뉴**: 마이그레이션 1035·1036, 가드, 테넌트 설정 화면, 시스템 어드민 지정 UI를 만든다. 운영 계정은 읽기 전용으로 확인한 후 배포한다.
3. **WP3 이슈 모델 확장 + 이슈 화면**: 마이그레이션 1037, 이슈 API, 목록·칸반·상세·댓글을 만든다. 기존 프로젝트 이슈 탭은 같은 컴포넌트로 교체한다.
4. **WP4 내 업무**: my-work API와 화면.
5. **WP5 마이페이지·타임존**: 컬럼 추가, 포털 마이페이지, 병기 포맷터, 포털 시간 표시 전환. 콘솔 프로필은 Q7 결과에 따른다.
- 각 WP는 별도 PR로 만들고 머지하면 스테이징에 자동 배포된다. 사용자가 확인한 후 운영 배포한다.

## 4. Verification (검증)
- 등급별 메뉴: ADMIN/TEACHER/STAFF 각각 노출 결과와, 허가되지 않은 메뉴는 마스터가 켤 수 없는지 확인한다. 하위 호환(설정 없음 = 노출)과 다른 테넌트 설정 차단도 통합 테스트로 확인한다.
- 권한: 테넌트 마스터가 아니면 테넌트 설정 API가 403인지, 서비스 운영자가 아니면 서비스 설정이 403인지, AMA SSO 재로그인 후에도 권한이 유지되는지 확인한다.
- 이슈: 비참여 프로젝트 이슈가 노출되지 않는지, 상태 전이와 이력, 댓글 작성자 권한, 기존 이슈의 상태 매핑을 확인한다.
- 타임존: 같은 타임존이면 한 번, 다르면 병기되는지와 DST 지역(예: America/New_York) 표시를 단위 테스트로 확인한다.
- 다국어: 4개 언어 키가 모두 있는지, 390px 모바일 사이드바와 표의 가로 넘침이 없는지 확인한다.

## 5. Review Gate (검토)
2026-10-15 사용자가 Q1–Q7을 확정하고(REQ §6) 구현을 승인했다. WP1부터 순서대로 PR을 만든다. Q6 결정에 따라 등급별 메뉴는 숨김만 적용한다.
