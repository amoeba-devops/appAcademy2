---
document_id: ACM-CFG-INVITE-TM-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-18
change_log:
  - version: 1.0.0
    date: 2026-10-18
    description: Service operator user invite + 5 integration settings restricted to tenant master / 서비스 운영자 사용자 초대 + 연동 설정 5종 테넌트 마스터 전용
---
# Service Settings: User Invite & Tenant-Master-Only Settings (서비스 설정 — 사용자 초대·테넌트 마스터 전용 설정)

## 1. Overview (개요)

요청 원문: "https://acm.amoeba.site/admin/config 서비스운영자 권한에게 서비스 설정에서 사용자 초대 기능 구현 / AI엔진, AMA 연동, 화상강의 설정, 카카오알림톡, GA4 방문자 설정은 테넌트 마스터에게만 노출"

## 2. Current State (현황, 2026-10-18)

| 항목 | 현재 |
| --- | --- |
| 서비스 설정 `/admin/config` | 서비스 운영자(`CONFIG_ADMIN`)만. 카드 7개 + Google Drive 링크: 광고 플랫폼, AI 엔진, AMA 연동, 화상강의, 메일, 카카오 알림톡, GA4 |
| 테넌트 설정 `/admin/tenant` | 테넌트 마스터(`TENANT_MASTER`)만. 탭: 메뉴 권한, 일반(타임존) |
| API 권한 | 7개 설정 API 모두 `ConfigAdminGuard`(서비스 운영자) |
| 권한 보유자(운영) | 서비스 운영자 2명(fremd@naver.com, tpiyeri@tpiglobal.network), 테넌트 마스터 1명(admin@tpi.co.kr) |
| 사용자 생성 | 시스템 관리자(`/system`)의 사용자 생성, 교사·직원 화면의 계정 발급. **초대 기능 없음** |

## 3. Requirements (요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | 서비스 설정에 **사용자 초대** 추가(서비스 운영자 전용): 이메일·이름·역할 입력 → 초대 메일 발송 |
| FR-2 | 초대받은 사람은 메일 링크에서 비밀번호를 정하고 가입 완료 → 바로 로그인 |
| FR-3 | 초대 목록: 대기·수락·만료·취소 상태, 재발송·취소 |
| FR-4 | 초대 링크 유효기간 72시간, 1회용. 이미 있는 이메일은 초대 불가 |
| FR-5 | 메일 미설정 시 초대 링크를 운영자 화면에 1회 표시(복사해 전달) |
| FR-6 | **AI 엔진·AMA 연동·화상강의·카카오 알림톡·GA4 방문자** 설정은 테넌트 마스터에게만 보이고, API 도 테넌트 마스터만 허용 |
| FR-7 | 서비스 설정에는 광고 플랫폼·메일·Google Drive·사용자 초대가 남는다 |
| NFR | 초대 토큰은 해시로만 저장, 응답·로그에 남기지 않음. 4개 언어(ko/en/vi/zh-CN) |

## 4. Open Questions (확인 사항)

| Q | 내용 | 제안 |
| --- | --- | --- |
| Q1 | 5개 설정을 테넌트 마스터에게 **어디서** 보여줄까 | **테넌트 설정에 "연동 설정" 탭** 추가(카드 5개). 화면 주소(`/admin/config/ai` 등)는 그대로 |
| Q2 | 초대할 수 있는 역할 | **관리자·직원·강사** 중 선택. 강사는 교사 정보와 연결이 필요하므로 가입 후 교사 관리에서 연결 |
| Q3 | 서비스 운영자가 5개 설정을 **완전히 못 보게** 할까(API 포함) | 요청대로 **완전히 차단**. 지금 서비스 운영자 2명은 이 5개를 못 보게 된다 |
| Q4 | 초대 시 서비스 운영자·테넌트 마스터 권한을 같이 줄 수 있나 | 주지 않는다(역할만). 권한 부여는 기존 방식 유지 |
