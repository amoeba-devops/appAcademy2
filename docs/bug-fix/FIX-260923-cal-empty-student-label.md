---
document_id: ACM-CAL-EMPTY-STUDENT-FIX-1.0.0
version: 1.0.0
status: Implemented - Not Deployed
created: 2026-09-23
change_log:
  - version: 1.0.0
    date: 2026-09-23
    description: 수업일정 학생 미지정 대체문구 제거
---

# Empty Student Label (학생 미지정 표시 수정)

## 1. Request (요청)
수업일정 `/admin/cal`에서 학생명이 없는 일정을 표시할 때 대체문구 없이 빈칸으로 노출한다.

## 2. Change (수정)
`frontend-acm/src/modules/cal/pages/cal-month-page.tsx`의 `buildEventDisplayLine`에서 학생명 최종 fallback을 `학생 미지정`에서 빈 문자열로 변경했다. 학생명 조회와 기존 데모/레벨테스트 제목의 이름 추출은 유지한다. 같은 표시 문자열을 쓰는 일정 카드와 툴팁에 적용된다. 목록형 ListRow는 원래부터 학생명이 있을 때만 출력하여 추가 수정이 필요하지 않았다.

표시 예시:
```text
변경 전: 10:00 | 학생 미지정 | 수업명
변경 후: 10:00 |             | 수업명
```
위 공백은 학생 표시 영역을 설명하기 위한 예시이며 실제 문자열은 빈 문자열이다. 날짜·제목·담당강사·일정 데이터는 변경하지 않는다.

## 3. Validation (검증)
frontend-acm의 TypeScript 검사 및 Vite production 빌드 통과. git diff --check 통과. 기존 번들 크기 경고만 남아 있다. 단순 표시 문구 수정으로 신규 테스트는 추가하지 않았다. 운영 배포 및 운영 화면 반영 검증은 아직 수행하지 않았다.

## 4. Workspace (작업 위치)
별도 작업트리 `/private/tmp/acm-cal-empty-student`, 브랜치 `fix/cal-empty-student-label`에 구현했다. 기존 사용자의 작업트리는 보존했다.
