---
document_id: STD-CSL-SCORES-BUG-FIX-1.0.0
version: 1.0.0
status: Deployed
change_log:
  - version: 1.0.0
    description: Investigated missing linked consultation MAP scores.
---
# Missing Student MAP Scores (학생 MAP 점수 누락)

## 1. Status (상태)
구현 및 대상 학생 점수 보정 완료. 재발 방지 코드 운영 배포 완료.

## 2. Findings (결과)
상담 #109의 MAP 181/216점이 학생 점수에는 없음. 등록 이후 점수 저장의 학생 동기화가 없고, 등록 전환 조회도 MAP 유형 조건이 누락됨.

## 3. References (관련 문서)
[분석서](../analysis/REQ-261009C-std-consultation-scores.md), [계획서](../plan/PLN-261009C-std-consultation-scores.md).

## 4. Implementation (구현)
- 등록 전환 시 testType=MAP 지정, 등록 완료 후 상담을 다시 조회하여 새 연결 ID 사용.
- 명시적 학생 연결 우선, 동일 테넌트·미삭제 검사. 잘못된 명시 연결은 이름 매칭으로 우회하지 않음.
- 기존 미연결 등록 전환의 이름/전화 매칭은 유지.
- 두 결과 입력 API 모두 연결 학생의 빈 MAP 점수 반영. 접수의 과거 점수 저장 경로는 결과 입력과 구분하여 자동 이관하지 않음.
- 조건부 UPDATE + COALESCE로 기존 값·0점·동시 수정 보존. 재실행 시 변경 대상 없으면 쓰지 않음.
- 소스 MAP 유형·상담 ID·테넌트 검사.

## 5. Validation (검증)
- 관련 단위 테스트 31개 통과, PostgreSQL 통합 테스트 3개 통과.
- 통합 검증: 빈 칸 채우기·재실행·동시 갱신·0점 보존·삭제 및 다른 테넌트 차단.
- Backend build 통과. 프론트엔드 변경 없음.

## 6. Targeted Production Correction (대상 운영 보정)
사용자 승인 범위의 상담 #109 / 학생 d3084c0f-51cf-4cca-bfe1-99b001a8dc8b만 처리.
실행 시 상담·MAP·학생 행을 잠그고 같은 테넌트 연결, 미삭제 학생, MAP 원본 Reading=181/Math=216 및 단일 결과를 재확인.
트랜잭션 전: Reading NULL, Math NULL, Language NULL.
트랜잭션 후: Reading 181, Math 216, Language NULL. UPDATE 1 / COMMIT 확인.
다른 학생이나 기존 입력 점수는 변경하지 않음. 자동 재발 방지 코드 배포 결과는 아래 7절 참조.

## 7. Production Deployment (운영 배포)
- PR #315, merge 144df306e78f021e3f60bfd79fb790193fae71d4.
- 배포 시각: 2026-10-10 08:18:42 KST / 06:18:42 ICT.
- PR CI 37953763531, main CI 38003352162, staging 38003352159 모두 성공.
- Production https://github.com/amoeba-devops/appAcademy2/actions/runs/38003727465 성공.
- frontend/backend 이미지 144df30 running, restarts=0. Health OK, 학생 상세 페이지 HTTP 200, 기동 후 초기 backend error lines=0.
- 운영에서 실제 상담 점수 입력 요청은 재실행하지 않았다. 저장 기능은 단위/통합 테스트로 검증하고 운영은 배포·서비스 상태만 확인했다.
- 이번 배포에 DB migration/추가 학생 데이터 보정 없음. 직전 정상 이미지 2a5d2a1을 롤백 기준으로 보관.
- 로컬 상담 회귀 테스트 총 117개 및 PostgreSQL 통합 테스트 3개 통과.
