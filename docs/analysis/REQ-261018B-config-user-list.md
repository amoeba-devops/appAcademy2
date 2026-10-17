---
document_id: ACM-CFG-USER-LIST-REQ-1.0.0
version: 1.0.0
status: Draft
created: 2026-10-18
change_log:
  - version: 1.0.0
    date: 2026-10-18
    description: Registered user list on the invite page / 사용자 초대 화면에 등록 사용자 목록
---
# Registered User List (등록 사용자 목록)

요청 원문: "https://acm.amoeba.site/admin/config/invites 현재 관리자/직원/강사/학생 등록된 사용자 목록 구현"

## 1. Current Data (현황, 운영 2026-10-18, 테넌트 Trinity Academy)

| 구분 | 저장 위치 | 인원 |
| --- | --- | --- |
| 관리자 | 콘솔 계정 `amb_acm_user` role ADMIN | 6 (AMA 2 · 로컬 4) |
| 직원 | 콘솔 계정 role STAFF | 2 (AMA) |
| 강사 | 콘솔 계정 role TEACHER | 3 · 포털 강사 계정 5 |
| 학생 | 포털 계정 `amb_acm_portal_account` STUDENT | 9 (학생 명부는 300명, 로그인 계정이 있는 학생만 9명) |

강사는 콘솔(`/admin`) 계정과 포털(`/portal`) 계정이 따로 있다.

## 2. Requirements (요구사항)

| ID | 요구사항 |
| --- | --- |
| FR-1 | `/admin/config/invites` 에 탭 **[등록 사용자] [초대 내역]** — 등록 사용자 목록 추가 |
| FR-2 | 구분 필터: 전체 / 관리자 / 직원 / 강사 / 학생 + 이름·이메일(로그인 ID) 검색 |
| FR-3 | 표시: 이름, 이메일(로그인 ID), 구분, 로그인 방식(AMA·로컬·포털), 권한 배지(서비스 운영자·테넌트 마스터), 상태(활성·잠김), 가입일, 마지막 로그인 |
| FR-4 | 같은 테넌트만. 서비스 운영자 전용(현재 화면 권한과 동일) |
| FR-5 | 읽기 전용. 이름을 누르면 관리 화면(교사 관리·직원 관리·학생 상세)으로 이동 |
| NFR | 4개 언어, 휴대폰 폭에서 카드형 |

## 3. Open Questions (확인 사항)

| Q | 내용 | 제안 |
| --- | --- | --- |
| Q1 | 학생 = 로그인 계정이 있는 학생(9)? 학생 명부 전체(300)? | **로그인 계정이 있는 학생**(등록된 사용자) |
| Q2 | 강사 = 콘솔 계정(3) + 포털 강사 계정(5)? | **둘 다** 보여주고 "콘솔"·"포털" 로그인 방식으로 구분 |
| Q3 | 목록에서 잠금·역할 변경 등 관리 기능? | **읽기 전용**(관리는 기존 화면). 필요하면 2차 |
| Q4 | 학부모 포털 계정(8)도 포함? | 요청 범위 밖 — **제외** |
