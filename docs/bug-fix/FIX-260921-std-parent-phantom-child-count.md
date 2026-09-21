---
document_id: STD-FIX-260921-parent-phantom-child-count
version: 1.0.0
status: FIXED (배포 진행)
date: 2026-09-21
related:
  - docs/analysis/REQ-260921-std-parent-ama-actions.md
---

# FIX-260921 — 학부모 목록 "연결 자녀 1" 인데 자녀가 없어 삭제 불가 / Phantom child count blocks parent deletion

## 1. Symptom (증상)

`/admin/std/parents` 에서 일부 학부모가 **연결 자녀 열에 숫자 `1` 만** 표시되고(이름 없음) 🗑 삭제 버튼이 **비활성**("연결된 자녀가 있어 삭제할 수 없습니다") 이라 지울 수 없다. 프로덕션 실측 **6명**.

## 2. Root Cause (원인)

[parent.service.ts](../../backend/src/modules/acm-std/application/parent.service.ts) `list()` 의 `childCount` 집계가 **링크 행(`amb_acm_std_student_parent`)만 세고** 학생의 소프트 삭제 여부를 보지 않았다. 반면 자녀 이름 목록(`children`)은 `s.deleted_at IS NULL` 로 조인한다. 학생이 삭제(소프트)되면 링크는 남으므로 **`childCount=1`·`children=[]`** 인 학부모가 생기고, 프론트는 `childCount>0` 이면 삭제를 막는다.

## 3. Fix (수정)

- `childCount` 집계도 `amb_acm_std_student` 와 `deleted_at IS NULL` 로 inner join → 살아 있는 학생만 센다.
- 결과: 해당 학부모는 **"고아 (자녀 없음)"** 배지로 표시되고 삭제 버튼이 활성화된다. 서버 삭제 API 는 원래 막지 않았으므로 변경 없음.
- 데이터 정리는 하지 않는다 — 운영자가 목록에서 확인 후 삭제(소프트)한다.

## 4. Verification (검증)

- backend `tsc` · eslint · jest acm-std 통과.
- 프로덕션 배포 후: 해당 6명이 고아 배지 + 삭제 가능.
