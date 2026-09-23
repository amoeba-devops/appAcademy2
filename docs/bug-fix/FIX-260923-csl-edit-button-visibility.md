---
document_id: ACM-CSL-EDIT-VISIBILITY-FIX-1.0.0
version: 1.0.0
status: Implemented
change_log:
  - version: 1.0.0
    date: 2026-09-23
    description: 상담 상세 기본정보 수정 버튼의 위치·시인성 개선
---
# Consultation Edit Button Visibility (상담 수정 버튼 표시)

## 1. Request and Change (요청·변경)
사용자 요청 “상담 상세 - 수정버튼 눈에 띄게 표시”에 따라 기존 기본정보 수정 링크를 상세 상단, 단계 표시 바로 위로 이동했다. 모든 상담 단계와 칸반 상세 모달에서 동일 위치에 표시한다. 강조색 배경·흰 글자·연필 아이콘·36px 높이의 공용 Button을 사용한다. 클릭하면 기존 편집 폼이 상단에서 열린다.

수정 가능 항목은 기존 구분·학교·학년·생년월일·성별이며 저장 API와 동작은 유지한다. 별도 계획 중인 이름·연락처·메모 수정 확장과 강사 미지정 저장 변경은 포함하지 않는다.

## 2. Screen Layout (화면 구성)
```text
학생명 · 상담 상세                       [다음 단계] [삭제]
                                         [✎ 기본정보 수정]
[접수] [레벨테스트] [데모수업] ...
[현재 단계 내용]
```
클릭 시 같은 위치에서 폼·취소·저장 표시. 원래 접수 패널 안의 중복 링크는 제거한다.

## 3. Verification (검증)
TypeScript 및 Vite production build, git diff --check 통과. 기존 번들 크기 경고만 존재. 표시 개선으로 신규 테스트는 추가하지 않는다. DB 및 API 변경 없음.
