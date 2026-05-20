# Contact 페이지 학부모이름 추가 요구사항 분석서

## 문서 정보
- **문서 ID**: REQ-CONTACT-PARENT-001
- **버전**: v1.0.0
- **작성일**: 2026-05-15
- **작성자**: Claude Code AI
- **관련 문서**: CLAUDE.md, SPEC.md

## 1. 개요
Contact 페이지의 상담 신청 폼에 학부모이름(보호자이름)을 추가하고, 입력 데이터를 admin/csl (Counseling Management) 페이지에 저장하는 기능을 구현한다.

## 2. 현재 상태 (AS-IS)
### Contact 페이지 폼 필드
- 상담 유형 (types): checkbox, 복수 선택 가능
- 학생 이름 (studentName): text, 필수
- 학년 (grade): text, 필수
- 연락처 (phone): tel, 필수
- 개인정보 동의 (privacyAgreed): checkbox, 필수

### 데이터 처리
- Frontend API: `/api/portal/consultations` - 데이터 검증만 수행, 저장하지 않음
- Backend 저장: 미구현

## 3. 요구사항 (TO-BE)
### 필드 추가
- 학부모 이름 (parentName): text, 필수 입력
- 학교 이름 (schoolName): text, 선택 입력 (필수 아님)

### 데이터 저장
- 저장 위치: admin/csl (Counseling Management)
- 저장 API: `/api/web/contact` (backend WebInquiryController)
- 저장 데이터: inquiry 엔티티로 변환하여 저장

### UI 디자인
- contact.html 디자인 참고하여 구현
- 기존 폼 레이아웃 유지하면서 필드 추가

## 4. 비기능 요구사항
- **보안**: 개인정보 암호화 저장 (NFR-005)
- **다중 테넌트**: academy_id 격리 (NFR-004)
- **API 규칙**: RESTful JSON API 준수
- **코드 규칙**: TypeScript strict, Clean Architecture 준수

## 5. 영향 범위
### Frontend 변경
- `lib/portal/schemas.ts`: consultationSchema에 parentName, schoolName 추가
- `components/portal/forms/consultation-form.tsx`: UI 필드 추가
- `app/api/portal/consultations/route.ts`: backend API 호출로 변경

### Backend 변경
- `modules/acm-csl/presentation/web-inquiry.controller.ts`: WebContactDto에 parentName 추가

### Admin 변경
- CSL 페이지에서 새로운 필드 표시 (필요시)

## 6. 제약사항
- 학교이름은 필수 입력이 아님
- 기존 데이터 구조 유지
- contact.html의 디자인 요소 참고

## 7. 리스크 및 고려사항
- 기존 데이터 마이그레이션 불필요 (새 필드)
- API 변경으로 인한 호환성 문제 없음
- 개인정보 암호화 적용 확인