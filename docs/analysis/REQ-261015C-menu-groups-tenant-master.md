---
document_id: ACM-MENU-TENANT-REQ-1.0.0
version: 1.0.0
status: Pending review
created: 2026-10-15
change_log:
  - version: 1.0.0
    date: 2026-10-15
    description: Menu groups, work management (my work / issues), service vs tenant settings, tenant master, per-role menu visibility, user timezone, system user tenant filter / 메뉴 그룹·업무관리·테넌트마스터·등급별 메뉴·사용자 타임존
---
# Menu Groups and Tenant Master Requirements (메뉴 구조·테넌트 마스터 요구사항)

## 1. Request (요청 원문 요약)
1. 좌측 메뉴를 **학원관리**와 **업무관리** 그룹으로 나눈다.
   - 학원관리: 대시보드, 신규상담, 학생관리, 학부모관리, 교사관리, 수업통계, 고객불만, 수납관리
   - 업무관리: 로비채팅, 내 업무(신설), 이슈(신설), 프로젝트, 문서, 드라이브
2. **내 업무**: AMA `/my-work`와 같은 기능으로, ACM 프로젝트·이슈를 대상으로 한다.
3. **이슈**: AMA `/issues`와 같은 UI로, ACM 프로젝트 이슈를 관리한다.
4. **서비스 설정**은 ACM 서비스 시스템 운영자(fremd@naver.com, AMA 로그인 사용자)에게만 제공한다.
5. **학생·교사 마이페이지**: 로그인 후 마이페이지에서 사용자 타임존을 설정한다. 테넌트 기본 타임존과 다르면 시간을 `기본 타임존(사용자 타임존)`으로 병기한다.
6. **테넌트 마스터 권한**을 신설한다. admin@tpi.co.kr을 TPI 테넌트의 테넌트 마스터로 지정한다.
7. 테넌트 마스터에게만 좌측 메뉴에 **테넌트 설정**을 노출한다.
8. 테넌트 설정의 **좌측 메뉴 노출 설정**에서 등급(관리자·강사·직원)별 노출을 지정한다. 현재는 시스템 어드민이 설정한 메뉴가 모든 등급에 노출된다. 앞으로는 시스템 어드민이 테넌트에 허가한 메뉴 안에서 테넌트 마스터가 등급별로 노출을 정한다.
9. `/system/admin` 사용자 관리: 테넌트를 먼저 선택한 후 목록을 노출한다.

## 2. Current State (현재 구현 · origin/main 53c6370 기준)
| 영역 | 현재 | 근거 |
|---|---|---|
| 좌측 메뉴 | 그룹 없는 단일 목록(약 25개). 하단에 APP_ADMIN 전용 System admin 링크 | `frontend-acm/src/components/layout/app-shell.tsx` NAV, `lib/admin-menu-keys.ts` |
| 메뉴 노출 | `amb_acm_tenant_menu`(테넌트 단위 표시/순서). 등급 구분 없음. 행이 없으면 노출. APP_ADMIN(전 테넌트)과 CONFIG_ADMIN(자기 테넌트)이 수정 | `sql/acm/520`, `999k`, `config-access.controller.ts`, `system-tenant.controller.ts` |
| 메뉴 필터 | `/acm/me/menus` 결과로 프론트에서만 숨김. API 실패 시 전체 노출. 수납은 ADMIN/APP_ADMIN/STAFF로 하드코딩 | `use-my-menus.ts`, `app-shell.tsx` |
| 역할 | `usr_role` = ADMIN/TEACHER/STAFF/APP_ADMIN. CONFIG_ADMIN은 `amb_acm_user_permission`의 별도 권한이며, fremd@naver.com에게만 SQL로 부여됨. 테넌트 마스터 개념 없음 | `sql/acm/505`, `510`, `999x`, `config-admin.guard.ts` |
| 서비스 설정 | `/admin/config/*`(AMA·화상·메일·일반(타임존)·카카오·광고·AI·GA4) 전체가 CONFIG_ADMIN 전용 | `router.tsx`, `require-config-admin.tsx` |
| AMA SSO | MASTER/OWNER/MANAGER → ADMIN, 교사 → TEACHER, 그 외 → STAFF. local 모드에서는 로그인마다 역할을 덮어씀 | `acm-role.mapper.ts`, `acm-auth.service.ts` |
| 테넌트 | `amb_acm_tenant`. 실제 테넌트는 `…0001 Trinity Academy`(code `tpi`)와 `…00ff System`뿐. TPI/TRINITY/SANTACROCE는 학생 사이트(`std_site`)이지 테넌트가 아님. 기본 타임존 `tnt_timezone`(기본값 Asia/Seoul) | `sql/acm/520`, `998`, `1006` |
| 포털 계정 | `amb_acm_portal_account` STUDENT/PARENT/TEACHER, `/portal/*` 화면. 마이페이지와 타임존 필드 없음. 시간 표시는 대부분 브라우저 로컬 기준 | `sql/acm/995`, `router.tsx` |
| 시스템 사용자 관리 | `GET /acm/system/users`가 `entId` 필터를 지원하지만 화면은 테넌트 필터 없이 전체 목록 | `system-user.controller.ts`, `system-admin-page.tsx` |
| 프로젝트·이슈 | `amb_acm_prj_item`(ISSUE 상태 TODO/DOING/DONE, 담당자, 마감일). 프로젝트별 조회만 가능. 전체 이슈 API와 내 업무 기능 없음 | `acm-prj` 모듈, `sql/acm/1032` |

## 3. Requirements (상세 요구사항)
### FR-1 Menu Groups (메뉴 그룹)
- 사이드바는 그룹 머리글(학원관리, 업무관리)과 그룹 안의 고정 순서를 가진다. 그룹은 접기/펼치기를 지원하고 상태는 사용자 브라우저에 기억한다.
- 요청 목록에 없는 기존 메뉴(MAP 신청, 수업, 직원, 일정, 시간표, 레퍼런스, 게시물, 알림, 수강신청, 수납 외 결제, MAP, Q&A 등)의 배치는 **미결 Q1**이다.
- 메뉴 키는 기존 키를 유지한다. 기존 노출 설정과 즐겨찾기 경로는 깨지지 않아야 한다. 신규 키는 `myWork`, `issues`이다.

### FR-2 My Work (내 업무)
- AMA 내 업무 구성을 ACM 모델로 축소 적용한다. 대상은 **내게 배정되었거나 내가 등록한 ACM 이슈**이다.
- 요약 카드(배정된 이슈·지연·오늘 마감·이번 주 마감·오늘 완료)를 클릭하면 필터로 동작한다. 관계 칩(배정·등록)과 프로젝트·검색 필터를 제공한다. 정렬은 긴급도순(지연 → 오늘 → 이후 → 마감 없음, 다음으로 마감일·우선순위)이다.
- 행에서 바로 상태를 변경(시작·완료)한다. 오른쪽 상세 패널에서 이슈를 확인하고 전체 페이지로 이동한다.
- AMA 전용 개념(개인 Todo, 오늘의 미션, 시나리오, 알림함, 성과 보기, 조직 단위)은 1차 범위에서 제외한다. 포함 여부는 **미결 Q3**이다.

### FR-3 Issues (이슈)
- 접근 가능한 모든 프로젝트의 이슈를 하나의 목록으로 보여주는 AMA 이슈 화면을 만든다: 목록과 칸반 보기, 검색, 필터(범위: 전체/내 배정/내 등록, 유형·상태·우선순위·프로젝트·담당자), 정렬(생성·수정·마감·우선순위), 페이지 크기 선택.
- 이슈 등록과 수정 창의 입력 항목: 프로젝트, 유형, 제목, 설명, 우선순위, 담당자, 시작일·마감일.
- 상세 페이지에서 상태 변경, 댓글, 상태 이력을 다룬다.
- AMA와 같은 UI를 위해 이슈 모델을 확장한다: 유형(TASK/FEATURE/BUG/OPINION/OTHER), 우선순위(1–5), 등록자, 시작일, 댓글, 상태 이력.
- 상태 체계: 현재 TODO/DOING/DONE을 유지할지, AMA의 간소화 모드(OPEN/IN_PROGRESS/DONE)로 맞출지는 **미결 Q4**이다. 기존 프로젝트 이슈 탭은 같은 모델과 컴포넌트를 쓴다.
- 1차 제외: AMA의 11단계 승인 워크플로, 간트, 고객사 공개 댓글, AI 번역·분석, WBS 필드, 필터 프리셋.
- 권한: 테넌트(`ent_id`)와 프로젝트 참여 범위를 서버에서 검사한다. 비참여 프로젝트의 이슈는 목록에 나오지 않는다.

### FR-4 Service Settings vs Tenant Settings (서비스 설정 / 테넌트 설정 분리)
- **서비스 설정**: ACM 서비스 운영자 전용이다. 기존 CONFIG_ADMIN 권한(fremd@naver.com 1명)을 서비스 운영자 권한으로 사용하며, 이메일 하드코딩은 하지 않는다.
- **테넌트 설정**: 테넌트 마스터 전용이다. 1차 포함 항목은 좌측 메뉴 등급별 노출이다.
- 기존 설정 항목(AMA 연동, 화상, 메일, 카카오, 광고, AI, GA4, 일반·타임존)을 서비스와 테넌트 중 어디에 둘지는 **미결 Q2**이다. 제안 기본값은 §5에 있다.
- 메뉴명 변경: 기존 `설정` → `서비스 설정`. `테넌트 설정`은 새로 추가한다. 권한이 없으면 메뉴를 숨기고, 주소나 API로 직접 접근해도 403을 반환한다.

### FR-5 Tenant Master (테넌트 마스터)
- `amb_acm_user_permission`에 `TENANT_MASTER` 권한을 추가한다. CONFIG_ADMIN과 같은 방식(테넌트 범위, 매 요청 DB 확인)이다. 기본 역할(ADMIN 등)과 별개라서 AMA SSO가 역할을 덮어써도 유지된다.
- 최초 지정: admin@tpi.co.kr을 대상 테넌트의 테넌트 마스터로 지정한다. 운영 DB에서 계정 존재 여부와 소속 테넌트를 읽기 전용으로 먼저 확인한다.
  - "TPI 테넌트"는 실제로는 `…0001 Trinity Academy`(code `tpi`)로 추정하며, 확인 대상이다(**미결 Q5**).
  - 계정이 없으면 생성 방식(AMA SSO 첫 로그인 후 부여 또는 로컬 계정 생성)을 확인한다.
- 이후 지정과 해제는 시스템 어드민(`/system/tenants/:entId`)에서 한다. 테넌트 마스터가 다른 마스터를 지정할 수 있는지는 1차에서 불가로 제안한다.

### FR-6 Per-Role Menu Visibility (등급별 메뉴 노출)
- 2단계 구조로 노출을 정한다.
  1. 시스템 어드민이 테넌트에 **허가**한 메뉴(기존 `amb_acm_tenant_menu`)
  2. 테넌트 마스터가 정한 **등급별 노출**(신규)
- 최종 노출 = 허가됨 AND 해당 등급에 노출됨.
- 등급: ADMIN(관리자), TEACHER(강사), STAFF(직원). 등급별 설정이 없는 메뉴는 기존처럼 노출해서 하위 호환을 지킨다.
- 대시보드는 항상 노출한다. 서비스 설정과 테넌트 설정은 각 권한으로만 노출하며 등급 설정 대상이 아니다.
- 메뉴 숨김은 화면 노출 제어다. 각 모듈 API 권한을 바꾸지는 않는다. 숨긴 메뉴의 주소로 직접 들어오면 "접근할 수 없는 메뉴" 안내를 표시한다.
- 서버 API 차단 포함 여부는 **미결 Q6**이다. 수납의 기존 하드코딩 제한은 유지한다.
- 기존 CONFIG_ADMIN의 테넌트 메뉴 편집 기능(REQ-261006B)은 테넌트 설정의 등급별 노출로 대체한다. 허가 범위는 시스템 어드민만 변경한다.

### FR-7 My Page and User Timezone (마이페이지·사용자 타임존)
- 대상: 포털 학생·교사 계정(`/portal/*`). 콘솔 TEACHER 사용자에게도 같은 설정을 줄지는 **미결 Q7**이다.
- 마이페이지 `/portal/me`: 이름과 로그인 ID 조회, 비밀번호 변경(기존 기능이 있으면 연결), 타임존 선택(IANA 목록, 기본값 "테넌트 기본 따름").
- 계정별 타임존을 저장한다(`pac_timezone`, null이면 테넌트 기본).
- 표시 규칙: 사용자 타임존이 테넌트 기본과 다르면 `10/16 19:00 (서울) · 10/16 17:00 (호치민)`처럼 기본 타임존 먼저, 사용자 타임존은 괄호로 병기한다. 같으면 한 번만 표시한다.
- 적용 범위: 포털 일정, 수업, 공지 일시, 채팅 시각. 기존 브라우저 로컬 기준 표시는 공통 포맷터로 전환한다.

### FR-8 System User List by Tenant (시스템 사용자 관리)
- `/system/admin`은 상단의 테넌트 선택 후 해당 테넌트 사용자만 조회한다. 선택 전에는 안내를 표시하고, 선택한 테넌트는 URL 쿼리(`?entId=`)로 유지한다.
- 기존 API의 `entId` 필터를 사용한다. 사용자 생성 시 기본 테넌트는 선택한 테넌트이다.

## 4. Non-Functional / Boundaries (비기능·경계)
- 다국어: 신규 UI 문구는 ko/en/vi/zh-CN 4개 언어로 작성하고, 한국어 하드코딩을 금지한다.
- 권한은 서버에서 검사한다. 이메일을 코드에 하드코딩하지 않으며, 권한 부여는 마이그레이션 또는 시스템 어드민 기능으로 한다.
- 신규 테이블과 컬럼은 PG 컨벤션(`amb_acm_*`, `ent_id`, `TIMESTAMPTZ`)을 따른다. 마이그레이션은 멱등이어야 한다(CD 자동 적용).
- 기존 이슈와 데이터를 보존한다. 상태값 변경 시 기존 값 매핑을 마이그레이션에 포함한다.

## 5. Open Questions (미결 사항)
| Q | 내용 | 제안 기본값 |
|---|---|---|
| Q1 | 요청 목록에 없는 기존 메뉴의 배치 | 학원관리 그룹 하단에 기존 순서대로 둔다(MAP 신청, 수업, 직원, 일정, 시간표, 게시물, 알림, 수강신청, MAP, Q&A, 레퍼런스) |
| Q2 | 기존 설정 항목의 서비스/테넌트 분리 | 서비스 설정: AMA 연동, 화상, 메일, 카카오, AI, 광고 플랫폼, GA4. 테넌트 설정: 메뉴 등급별 노출, 일반(기본 타임존) |
| Q3 | 내 업무 1차 범위 | 이슈 기반만 포함. 개인 Todo·오늘의 미션은 2차 |
| Q4 | 이슈 상태값 | AMA 간소화 모드 OPEN/IN_PROGRESS/DONE + REJECTED. 기존 TODO→OPEN, DOING→IN_PROGRESS로 매핑 |
| Q5 | "TPI 테넌트"의 실체 | 테넌트 `…0001`(code tpi, "Trinity Academy"). 학생 사이트 TPI만의 권한이 아님 |
| Q6 | 숨긴 메뉴의 API 차단 | 1차는 화면 노출과 직접 URL 안내까지. API 차단은 모듈별로 2차 |
| Q7 | 콘솔 사용자(강사·직원)의 타임존 | 포함. 콘솔 프로필 메뉴에 같은 설정 제공 |
