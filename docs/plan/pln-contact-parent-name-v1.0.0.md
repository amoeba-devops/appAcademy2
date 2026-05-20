# Contact 페이지 학부모이름 추가 작업 계획서

## 문서 정보
- **문서 ID**: PLN-CONTACT-PARENT-001
- **버전**: v1.0.0
- **작성일**: 2026-05-15
- **작성자**: Claude Code AI
- **관련 요구사항**: REQ-CONTACT-PARENT-001

## 1. 작업 개요
Contact 페이지 상담 신청 폼에 학부모이름과 학교이름 필드를 추가하고, 데이터를 CSL에 저장하는 기능을 구현한다. contact.html 디자인을 적용한다.

## 2. 작업 분해
### 2.1 Frontend 스키마 수정
- **파일**: `frontend/src/lib/portal/schemas.ts`
- **작업**: `consultationSchema`에 `parentName`, `schoolName` 필드 추가
- **세부사항**:
  - `parentName`: string, min(1), 필수
  - `schoolName`: string, optional

### 2.2 Frontend 폼 컴포넌트 수정
- **파일**: `frontend/src/components/portal/forms/consultation-form.tsx`
- **작업**: 학부모이름, 학교이름 입력 필드 추가 + contact.html 디자인 적용
- **UI 레이아웃** (contact.html 기반):
  ```
  어떤 상담을 원하시나요? (checkbox 복수 선택)
  학생 이름
  학년
  학부모 이름 (추가)
  학교 이름 (선택, 추가)
  연락처
  개인정보 동의
  ```
- **디자인 적용**:
  - `form-group` 클래스 사용
  - `control-label` 클래스 사용
  - `form-control` 클래스 사용
  - `checkbox checkbox-styled` 클래스 사용
  - contact.html의 상담 옵션들 사용

### 2.3 Frontend API 수정
- **파일**: `frontend/src/app/api/portal/consultations/route.ts`
- **작업**: backend `/api/web/contact`로 데이터 전송하도록 변경
- **세부사항**: fetch 호출로 backend API 호출

### 2.4 Backend DTO 수정
- **파일**: `backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts`
- **작업**: `WebContactDto`에 `parentName` 필드 추가
- **세부사항**: validation 데코레이터 적용

### 2.5 Backend 저장 로직 수정
- **파일**: `backend/src/modules/acm-csl/presentation/web-inquiry.controller.ts`
- **작업**: `submitContact` 메서드에서 `parentName` 저장
- **세부사항**: inquiry 생성 시 parentName 포함

## 3. 의존성
- **선행 작업**: 없음
- **동시 작업**: 없음
- **후속 작업**: 테스트 실행

## 4. 리스크 및 완화 방안
### 리스크 1: 기존 데이터 구조 변경
- **영향**: inquiry 엔티티에 parentName 필드 추가 필요
- **완화**: backend에서만 parentName 저장, 기존 필드 유지

### 리스크 2: UI 레이아웃 깨짐
- **영향**: 필드 추가로 폼 레이아웃 변경
- **완화**: contact.html 디자인 참고하여 조정

### 리스크 3: 개인정보 암호화 누락
- **영향**: parentName 암호화 저장 필요
- **완화**: NFR-005 확인하여 AES-GCM 적용

## 5. 테스트 계획
### 단위 테스트
- 스키마 validation 테스트
- API 요청/응답 테스트

### 통합 테스트
- 폼 제출 → backend 저장 확인
- CSL 페이지에서 데이터 확인

### E2E 테스트
- Contact 페이지 → 폼 입력 → 제출 → CSL 확인

## 6. 완료 기준
- [ ] 학부모이름 필드 추가됨 (필수)
- [ ] 학교이름 필드 추가됨 (선택)
- [ ] 데이터 CSL에 저장됨
- [ ] UI 디자인 contact.html과 유사
- [ ] 모든 테스트 통과

## 7. 메모
- contact.html의 폼 디자인 참고 필요
- 개인정보 암호화 적용 확인
- 다중 테넌트 academy_id 격리 확인