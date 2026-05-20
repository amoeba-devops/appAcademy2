# Contact 페이지 학부모이름 추가 테스트 케이스

## 문서 정보
- **문서 ID**: TC-CONTACT-PARENT-001
- **버전**: v1.0.0
- **작성일**: 2026-05-15
- **작성자**: Claude Code AI
- **관련 요구사항**: REQ-CONTACT-PARENT-001
- **테스트 유형**: Unit, Integration, E2E

## 1. 테스트 범위
Contact 페이지 학부모이름 추가 및 CSL 저장 기능

## 2. 테스트 케이스 목록

### TC-001: 학부모이름 필드 표시 (Unit)
- **ID**: TC-001
- **유형**: Unit
- **우선순위**: P0
- **전제조건**: Contact 페이지 로드
- **입력**: 없음
- **기대결과**: 학부모이름 입력 필드 표시됨 (contact.html 스타일: form-group, control-label, form-control)
- **실제결과**: 
- **통과여부**:

### TC-002: 학교이름 필드 표시 (Unit)
- **ID**: TC-002
- **유형**: Unit
- **우선순위**: P0
- **전제조건**: Contact 페이지 로드
- **입력**: 없음
- **기대결과**: 학교이름 입력 필드 표시됨 (선택 표시, contact.html 스타일)
- **실제결과**: 
- **통과여부**:

### TC-003: contact.html 상담 옵션 표시 (Unit)
- **ID**: TC-003
- **유형**: Unit
- **우선순위**: P0
- **전제조건**: Contact 페이지 로드
- **입력**: 없음
- **기대결과**: contact.html의 상담 옵션들 표시 (MAP TEST 튜터링, ISEE 튜터링 등, checkbox checkbox-styled 스타일)
- **실제결과**: 
- **통과여부**: 

### TC-003: 학부모이름 필수 validation (Unit)
- **ID**: TC-003
- **유형**: Unit
- **우선순위**: P0
- **전제조건**: 폼 제출 시도
- **입력**: 학부모이름 빈 값
- **기대결과**: "학부모이름을 입력해주세요" 에러 표시
- **실제결과**: 
- **통과여부**: 

### TC-004: 학교이름 선택 validation (Unit)
- **ID**: TC-004
- **유형**: Unit
- **우선순위**: P0
- **전제조건**: 폼 제출 시도
- **입력**: 학교이름 빈 값
- **기대결과**: 에러 없음 (선택 필드)
- **실제결과**: 
- **통과여부**: 

### TC-005: Backend DTO validation (Integration)
- **ID**: TC-005
- **유형**: Integration
- **우선순위**: P0
- **전제조건**: API 요청
- **입력**: parentName 누락
- **기대결과**: 400 Bad Request
- **실제결과**: 
- **통과여부**: 

### TC-006: 데이터 CSL 저장 (Integration)
- **ID**: TC-006
- **유형**: Integration
- **우선순위**: P0
- **전제조건**: 유효한 폼 데이터
- **입력**: 모든 필드 입력
- **기대결과**: CSL inquiry 생성됨, parentName 저장됨
- **실제결과**: 
- **통과여부**: 

### TC-007: E2E 폼 제출 (E2E)
- **ID**: TC-007
- **유형**: E2E
- **우선순위**: P0
- **전제조건**: Contact 페이지 접근
- **입력**: 유효한 모든 필드 값
- **기대결과**: 제출 성공, 성공 메시지 표시
- **실제결과**: 
- **통과여부**: 

### TC-008: CSL 페이지 데이터 확인 (E2E)
- **ID**: TC-008
- **유형**: E2E
- **우선순위**: P0
- **전제조건**: TC-007 통과
- **입력**: 없음
- **기대결과**: CSL 페이지에서 parentName, schoolName 확인 가능
- **실제결과**: 
- **통과여부**: 

## 3. 테스트 환경
- **Frontend**: localhost:3009
- **Backend**: localhost:4009
- **Database**: MySQL 8.x
- **Browser**: Chrome latest

## 4. 테스트 데이터
```json
{
  "types": ["ACCREDITED"],
  "studentName": "김학생",
  "parentName": "김학부모",
  "grade": "중3",
  "schoolName": "서울국제학교",
  "phone": "010-1234-5678",
  "privacyAgreed": true
}
```

## 5. 완료 기준
- 모든 P0 테스트 케이스 통과
- 에러 없이 데이터 저장 확인
- UI 디자인 contact.html과 유사