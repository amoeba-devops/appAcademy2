---
document_id: STD-OPTIONAL-EMAIL-PLN-1.0.0
version: 1.0.0
status: Implemented; not deployed
change_log:
  - version: 1.0.0
    description: Implementation plan and form mockup.
---
# Student Optional Email Plan (학생 이메일 선택 입력 계획)

## 1. UI Layout (화면 구성안)
학생 등록/수정 모달의 기존 위치를 유지한다.

```text
학생 등록
이름 *       [                         ]
전화번호      [                         ]
이메일 (선택) [                         ]
             이메일 없이 학생 등록이 가능합니다.
                         [취소] [저장]
```

## 2. Implementation (구현 계획)
1. 학생 폼의 이메일 필수 별표와 required 검증 제거, 선택 입력 문구를 4개 언어에 반영.
2. 입력된 이메일 앞뒤 공백 제거. 신규 등록 미입력은 NULL로 저장.
3. 서비스 create/update의 필수 검증 제거. 이메일 없는 학생의 수정도 허용하고 입력된 이메일 형식·중복 검증은 유지.
4. DTO의 빈 값 정규화와 수정 요청의 의미를 명시: 생략은 기존값 유지, 명시적 비우기는 NULL. 폼도 이 구분을 반영.
5. 포털계정 발급의 이메일 필요 조건을 점검하고 유지. 기존 계정 로그인 정보는 임의 변경하지 않음.

## 3. Verification (검증 계획)
- API: 이메일 누락/빈 값/공백으로 등록, 이메일 없는 학생의 정보 수정, 유효 이메일, 형식 오류, 중복 이메일 검증.
- UI: 별표 제거, 빈 이메일 저장 성공, 입력 시 형식 오류 표시, 기존 이메일 표시 확인.
- 프론트엔드 빌드와 관련 백엔드 테스트 실행.

## 4. Workflow (진행 절차)
AGENTS.md 9.2에 따라 분석서·계획서 사용자 확인 후 구현. 사용자가 구현을 승인하여 진행한다. 운영 배포는 별도 요청 시 수행한다.
