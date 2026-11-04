---
document_id: REQ-261104
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-04 v1.1.0 — confirmed and implemented
  - 2026-11-04 v1.0.0 — initial analysis
---

# REQ-261104 Reactivate Archived Student (비활성화 학생 다시 활성화)

## 1. Request (요청)
`/admin/std/archived` 비활성화 목록에서 비활성화한 학생을 **다시 활성화**하는 버튼이 필요하다.

## 2. As-Is (현재, 4620d84)
| 항목 | 현재 |
|------|------|
| 비활성화 | `StudentDeletionService.archive` — `std_archived_at`·`std_archived_by`·`deleted_at` = now, 이력 `ARCHIVE`. 상담·수업·수납 기록은 그대로 |
| 비활성화 목록 | `std_archived_at IS NOT NULL` 학생, 버튼은 [내용 확인 / 완전삭제] 뿐 |
| 권한 | 관리자(ADMIN·APP_ADMIN) + 서비스 운영자(CONFIG_ADMIN) 또는 테넌트 마스터(TENANT_MASTER) |
| 이력 | `amb_acm_std_deletion_history.sdh_action` CHECK = `ARCHIVE`·`PURGE` 만 |

운영(2026-11-04 SELECT): 비활성화 학생 4명, 이력 ARCHIVE 4건.

## 3. Requirements (요구사항)
| ID | 내용 |
|----|------|
| FR-1 | 비활성화 목록 행마다 **[다시 활성화]** 버튼 → 확인창 → 처리 |
| FR-2 | 처리 = `std_archived_at`·`std_archived_by`·`deleted_at` 비움. 학생 상태(재원·퇴원 등)·배정 강사·기록은 비활성화 전 그대로 |
| FR-3 | 삭제 이력에 `RESTORE`(다시 활성화) 기록 — 처리자·일시. 이력 화면 처리유형 "다시 활성화" |
| FR-4 | 권한 = 비활성화와 같음. 이미 활성인 학생은 그대로 성공(중복 클릭 안전) |
| FR-5 | 처리 후 목록에서 빠지고 학생 목록·상세에 다시 나타남. 완료 안내 + [학생 보기] |
| NFR | 마이그레이션(CHECK 에 RESTORE 추가, 멱등), 4개 언어, 통합 테스트 |

## 4. Open Questions (확인 필요)
| # | 질문 | 권장안 |
|---|------|--------|
| Q1 | 권한 | **비활성화와 동일**(관리자 + 서비스 운영자/테넌트 마스터) |
| Q2 | 학생 상세에서도 다시 활성화 | **목록에서만**(비활성화 학생은 상세가 열리지 않음) |

## 5. Decisions (결정, 2026-11-04)
| # | 결정 |
|---|------|
| Q1 | 권한 **비활성화와 동일** |
| 화면 | 계획서대로(확인창 + 완료 안내) |
