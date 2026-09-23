---
document_id: ACM-CSL-ENGLISH-CONTACT-RPT-1.0.0
version: 1.0.0
status: DeployedVerified
change_log:
  - version: 1.0.0
    date: 2026-09-23
    description: 상담 영문명 및 기본정보 수정 구현·검증
---
# Consultation Profile Update (상담 영문명·기본정보 수정)

## 1. Changes (변경)
- 신규 상담에서 맵테스트 선택 시 학생 영문이름 입력. 구분 전환 시 입력 보존.
- 상담 접수정보에 영문이름 표시, 상세 기본정보 수정에서 영문명·학년·구분·생년월일·성별·보호자·이메일·전화·학교 변경.
- 학교 검색 선택/직접 입력, 전화 제공 상태 정리. 변경한 필드만 PATCH하며 편집 중 재조회가 입력을 덮어쓰지 않는다.
- 상담 영문명 AES-GCM 암호화, 상담/MAP 프로필 트랜잭션 동기화 및 수정 시각 충돌 검증.
- 기존 학생/학부모 원장, 시험 결과, 일정은 수정 대상에서 제외.
- SQL 1018 nullable 컬럼 추가 및 테넌트별 영문명 이관 스크립트 제공. 기본 dry-run, 누락만 보충, 충돌 건 덮어쓰기 금지, 개인정보 로그 미출력.

## 2. Verification (검증)
- Backend unit: 77 suites / 611 tests 통과.
- PostgreSQL integration: 9건 통과. 암호화·부분 수정·명시 삭제·양방향 동기화·409 충돌·테넌트 격리·롤백·기존 영문명 보존·학교·외부접수·이관 멱등성 검증.
- Backend build 및 frontend TypeScript/Vite build 통과.
- Backend ESLint 오류 0건(기존 경고 포함). Frontend lint는 저장소 설정상 skip이며 TypeScript/build로 검증.

## 3. Release (배포)
- PR [#281](https://github.com/amoeba-devops/appAcademy2/pull/281), 운영 버전 `c9394533dd7758995b575c0665c96560341c1c46`.
- [Staging](https://github.com/amoeba-devops/appAcademy2/actions/runs/35845161242), [Production](https://github.com/amoeba-devops/appAcademy2/actions/runs/35845555143) 배포 및 smoke 성공.
- 운영 영문명 dry-run: 대상 66, 충돌 0. 암호화 보충 66건 완료. 재조회: 일치 66, 누락 0, 충돌 0.
- 운영 UI: 지정 상담의 모든 기본정보 수정 항목, 접수정보 영문명 라벨, 신규 상담 MAP 영문명 입력 확인. UI 확인 후 취소하여 원본 상담을 QA 목적으로 변경하지 않았다.

## 4. Regression Scope and Limits (회귀 검증 범위·한계)
- 이번 기능의 PostgreSQL 9건은 로컬 및 CI에서 통과. 상담 일정 초기화·대시보드 기존 검사를 포함한 관련 4 suites / 33 tests도 로컬 통과.
- 공용 통합 테스트 설정에 SQL 1014/1016/1018을 추가하면 기존 상담 목록·결제 및 학교 API 테스트 2 suites / 15 tests 통과.
- CI 전체 통합 단계는 `continue-on-error` 설정이다. 기존 11 suites는 전용 `tac-postgres-acm` 이미지 부재로 실패하므로 CI job 성공이 전체 통합 성공을 뜻하지 않는다.
- 전체 로컬 통합 실행에서는 7 suites 통과, 6 suites 실패. 테스트 스키마 보충 후 확인한 잔여 실패는 구형 ACTIVE/ENROLLED 상태 및 배열 응답 기대값, 별도 AMA/Auth 테스트 스키마 누락이다. 이번 기능 성공 건수와 분리하여 기록한다.
- 운영에서는 실제 정보 수정 없이 조회 및 폼 열기/취소만 수행했다. 저장·재조회·롤백은 격리된 PostgreSQL 통합 테스트로 검증했다.
