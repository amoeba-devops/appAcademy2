---
document_id: ACM-PAY-STUDENT-SEARCH-RPT-1.0.0
version: 1.0.0
status: Implemented; not deployed
created: 2026-10-01
change_log:
  - version: 1.0.0
    date: 2026-10-01
    description: Search-based individual student selection / 검색 후 학생 개별 추가
---

# Student Selection Implementation (학생 검색 선택 구현)

## 1. Result (구현 결과)

청구 등록 모달은 검색 전 학생 목록 대신 안내를 표시한다. 이름 검색 결과의 추가 버튼으로 학생을 한 명씩 선택하고 별도 선택 목록에서 개별 삭제한다. 전체 선택을 제거했으며 검색어가 바뀌어도 기존 선택을 유지한다. 같은 학생 중복 및 100명 초과 선택은 차단한다. 이름·사이트·상태와 짧은 식별값으로 결과를 구분한다.

검색 입력에 250ms 지연을 적용하고 이전 검색 결과를 잘못 선택하지 않도록 새 결과 수신까지 로딩을 표시한다. 사이트/수업 필터를 바꾸면 선택을 초기화한다는 안내를 추가했다. 기존 수업 옵션 조회는 유지한다. 4개 언어 반영, 서버/DB 변경 없음.

## 2. Verification (검증)

- Frontend TypeScript/Vite build 통과 (기존 청크 크기 경고).
- 가상 데이터 브라우저: 검색 전 목록 비노출, A 검색/추가 후 B 검색 시 A 유지, B 개별 추가, 선택됨 버튼 비활성화, 2명 청구 미리보기 성공, A 개별 제외 시 선택 1명 및 미리보기 초기화 확인.
- 기존 실제 Nest HTTP 가상 계정 검증 통과. 운영 업무 데이터 변경 없음.
- 작업 위치 `/private/tmp/acm-payment-261001`, 브랜치 `feat/pay-student-search-261001`. 원본 프로젝트 소스의 미커밋 변경 보존.
- 운영 미배포. 기존 상담 납부 이관은 실제 납부일·총 청구액 회신 대기 상태로 유지.

## 3. Screenshot (화면 증빙)

로컬 가상 학생 데이터로 확인한 화면이다.

![학생 검색 및 개별 선택](screenshots/261001-pay/student-search.png)
