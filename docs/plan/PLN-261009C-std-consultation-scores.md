---
document_id: STD-CSL-SCORES-PLAN-1.0.0
version: 1.0.0
status: Implemented; targeted data corrected; code not deployed
change_log:
  - version: 1.0.0
    description: Investigated missing linked consultation MAP scores.
---
# Score Inheritance Fix Plan (점수 연동 수정 계획)

## 1. Implementation (구현안)
1. 등록 전환 조회에 testType=MAP을 지정한다.
2. 연결 inq.stdId를 우선 사용해 같은 테넌트의 삭제되지 않은 학생을 선택한다. 유효하지 않은 명시 연결은 이름 매칭으로 다른 학생에게 우회하지 않는다. 미연결 기존 흐름에만 기존 안전한 이름/전화 매칭을 유지한다.
3. 상담 점수 저장 경로를 모두 점검해 연결된 학생의 NULL MAP 점수만 채운다. 기존 학생 값은 보존한다. 반복 저장과 동시 수정을 고려해 조건부 갱신한다.
4. 상담 #109의 누락 점수는 구현·검증 후 별도 운영 보정으로 Reading=181, Math=216을 빈 칸에만 반영한다. 실행 직전 원본 점수와 연결·빈 값 여부를 재확인하고 트랜잭션 및 변경 전후 기록을 남긴다. Language는 미입력 유지.
5. 다른 상담으로 범위를 넓힌 일괄 보정은 하지 않는다.

## 2. UI Layout (화면 구성안)
기존 학생 상세 점수 영역을 유지한다.
```text
MAP 점수
Reading   181
Math      216
Language  미입력
신규상담 연결 #109 · 7. 수강중
```
새로운 비-MAP 점수 화면이나 이력 기능은 이번 수정 범위에 포함하지 않는다.

## 3. Validation (검증)
MAP/SSAT 동시 존재, 등록 이후 점수 입력, 명시 연결 학생 선택, 타 테넌트·삭제된 학생 차단, 기존 점수 보존, 0/NULL 구분, 재실행 및 동시 갱신을 테스트한다. 관련 빌드와 상담/학생 회귀 테스트 수행.

## 4. Approval (승인)
AGENTS.md 9.2에 따라 분석서·화면 구성안 확인 후 구현한다. 운영 보정은 검증 후 실제 반영 단계에서 수행하며 현재는 미실행이다.
