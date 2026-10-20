---
document_id: ACM-CFG-USER-LIST-PLN-1.1.0
version: 1.1.0
status: Approved
created: 2026-10-18
related: REQ-261018B-config-user-list
change_log:
  - version: 1.1.0
    date: 2026-10-18
    description: Approved as proposed (Q1 students with issued login accounts only) / 제안대로 승인
  - version: 1.0.0
    date: 2026-10-18
    description: Work plan with UI mockup / 작업 계획 + 화면 구성안
---
# Work Plan (작업 계획) — 등록 사용자 목록

## 1. Screen Mockup (화면 구성안)

```
← 설정으로 돌아가기
👤+ 사용자 초대                                          [+ 초대하기]
[등록 사용자 20] [초대 내역]                                  ← 탭
[전체 20] [관리자 6] [직원 2] [강사 8] [학생 9]   🔍 [이름·이메일 검색   ]
┌──────────────────────────────────────────────────────────────────────┐
│ 이름        이메일 / 로그인 ID          구분   로그인  권한/상태     가입일      마지막 로그인 │
│ ACM Admin   admin@tpi.co.kr            관리자 로컬   테넌트 마스터  2026-05-19  10-18 09:12 │
│ fremd       fremd@naver.com            관리자 AMA    서비스 운영자  2026-06-02  10-17 21:40 │
│ 김강사      t.kim@tpi.co.kr            강사   콘솔                  2026-09-01  —          │
│ 김강사      t.kim@tpi.co.kr            강사   포털                  2026-09-01  10-16 18:00 │
│ 이학생      s.lee@gmail.com            학생   포털   잠김           2026-09-10  10-15 20:31 │
└──────────────────────────────────────────────────────────────────────┘
휴대폰: 행 → 카드(이름·구분 배지 / 이메일 / 가입일·마지막 로그인)
```

## 2. Work Packages (작업 단위)

| WP | 내용 |
| --- | --- |
| WP1 API | `GET /acm/admin/users?type=ALL\|ADMIN\|STAFF\|TEACHER\|STUDENT&q=` (`ConfigAdminGuard`, 자기 테넌트). 콘솔 계정(ADMIN/STAFF/TEACHER, APP_ADMIN 제외) + 포털 계정(STUDENT, TEACHER) 합쳐 반환, 유형별 건수 포함. 비밀번호·토큰 등 민감 값 제외 |
| WP2 화면 | 초대 화면에 탭 2개(등록 사용자 기본), 필터 칩·검색, 표/카드, 이름 → 관리 화면 링크. 4개 언어 |
| WP3 테스트 | 통합: 유형별 건수, 다른 테넌트 제외, 검색, 권한(서비스 운영자 외 403) |
| WP4 배포 | PR → CI → 스테이징 → 운영(최신 main) → 무자격 확인 |

DB 변경 없음.
