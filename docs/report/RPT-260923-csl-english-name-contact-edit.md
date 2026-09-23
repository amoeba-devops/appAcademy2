---
document_id: ACM-CSL-ENGLISH-CONTACT-RPT-1.0.0
version: 1.0.0
status: VerifiedNotDeployed
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
CI → staging → production smoke → 영문명 dry-run/apply → 운영 화면 조회 순서로 진행 중.
