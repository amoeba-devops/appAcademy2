---
document_id: STD-OPTIONAL-EMAIL-RPT-1.0.0
version: 1.0.0
status: Deployed
change_log:
  - version: 1.0.0
    description: Optional student email implementation and validation results.
---
# Optional Student Email (학생 이메일 선택 입력)

## 1. Changes (변경 사항)
- 학생 등록/수정 이메일 필수 표시와 필수 검증 제거, 선택 입력 안내를 4개 언어로 추가.
- 재원·휴원·퇴원 상태 모두 이메일 없이 저장 가능.
- 이메일 앞뒤 공백 제거, 빈 값은 NULL 저장. 수정 API에서 이메일 생략은 기존 값 유지, 명시적 NULL/빈 값은 삭제.
- 이메일 입력 시 형식·길이·테넌트 내 중복 검증 유지.
- 포털계정 발급의 이메일 필요 조건은 유지. 기존 계정 정보 자동 변경 없음.
- DB 스키마 변경 및 기존 데이터 일괄 변경 없음.

## 2. Validation (검증)
- DTO HTTP 검증, 학생 이메일 저장 서비스, 기존 포털계정 서비스: 3 suites / 38 tests passed.
- Frontend TypeScript + Vite build: passed (기존 대형 청크 경고).
- Backend Nest build: passed.
- 테스트는 합성 데이터 및 mock 저장소를 사용했으며 실제 운영 DB나 브라우저에서 등록하지 않았다.

## 3. Delivery (전달)
- 별도 브랜치 fix/std-optional-email-261009.
- 숫자 콤마 PR #312와 분리하여 main 기준 작업.
- 운영 배포 완료. 원본 IDE 작업의 기존 소스 및 staged 변경은 유지하고 문서만 복사.

## 4. Production Deployment (운영 배포)
- PR #313 merged: 44933cbd2869b14d2404f57bf32ae718881c3048.
- 배포 시각: 2026-10-09 12:44:46 KST / 10:44:46 ICT.
- PR CI 37879945984, main CI 37880285633, staging 37880285570: success.
- Production workflow: https://github.com/amoeba-devops/appAcademy2/actions/runs/37880632299 — success.
- 운영 frontend/backend 이미지 44933cb, running, restarts=0.
- Backend health OK, /admin/std HTTP 200, 기동 후 초기 backend error lines=0.
- 운영 인증 사용자 등록 흐름은 실행하지 않았으며 실제 학생 데이터 변경 없음. 15분 장기 모니터링 결과가 아닌 초기 점검 결과.
- 롤백 기준: 건강 점검 실패 또는 이번 변경으로 인한 학생 저장 장애 발생 시 직전 이미지 0be036d로 복구.
- 숫자 콤마 PR #312는 이번 배포에 포함하지 않음.
