---
document_id: ACM-TC-STD-001
version: 1.0.0
status: Draft
created: 2026-05-05
req_ref: ACM-REQ-STD-001
plan_ref: ACM-PLN-STD-001
---

# ACM STD — 학생관리 모듈 테스트 케이스

## 분류 기준
- **Unit**: 백엔드 서비스/DTO 단위
- **Integration**: API endpoint e2e (DB 포함)
- **E2E**: 브라우저 Playwright
- **Manual**: 수동 확인

---

## TC-001 학생 목록 조회 (AC-001, AC-002)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-001 |
| 분류 | Integration |
| 우선순위 | P0 |
| 전제조건 | 로그인 완료, Bearer Token 보유 |
| 입력 | GET /api/acm/std/students (no params) |
| 기대 결과 | 200, `{ items: [], total: 0 }` (빈 DB 기준) |
| AC 매핑 | AC-001, AC-002 |

---

## TC-002 학생 개별 등록 (AC-003)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-002 |
| 분류 | Integration |
| 우선순위 | P0 |
| 전제조건 | 로그인, `ent_id` 세팅 |
| 입력 | POST /api/acm/std/students `{ std_name: "홍길동", std_status: "ACTIVE" }` |
| 기대 결과 | 201, `std_id` UUID 반환 |
| AC 매핑 | AC-003 |

---

## TC-003 학생 이름 검색 (AC-004)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-003 |
| 분류 | Integration |
| 우선순위 | P1 |
| 전제조건 | "홍길동", "김민지" 2명 등록 완료 |
| 입력 | GET /api/acm/std/students?q=홍길 |
| 기대 결과 | 200, items 1건 (홍길동만) |
| AC 매핑 | AC-004 |

---

## TC-004 엑셀 업로드 정상 (AC-005)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-004 |
| 분류 | Integration |
| 우선순위 | P0 |
| 전제조건 | TPI 형식 xlsx 파일 (5행) 준비 |
| 입력 | POST /api/acm/std/students/import (multipart, file=students.xlsx) |
| 기대 결과 | 200, `{ success: 5, failed: 0, errors: [] }` |
| AC 매핑 | AC-005 |

---

## TC-005 엑셀 업로드 Upsert (AC-006)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-005 |
| 분류 | Integration |
| 우선순위 | P1 |
| 전제조건 | "홍길동" (2010-03-15) 이미 등록 |
| 입력 | 동일 이름+생년월일 행 포함 xlsx 업로드 |
| 기대 결과 | 중복행 → update, 신규행 → insert, 총 건수 정확 |
| AC 매핑 | AC-006 |

---

## TC-006 엑셀 업로드 오류 행 처리 (AC-007)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-006 |
| 분류 | Integration |
| 우선순위 | P1 |
| 전제조건 | std_name 누락 행 포함 xlsx |
| 입력 | POST /api/acm/std/students/import |
| 기대 결과 | 유효 행 import 완료, `errors` 배열에 오류 행 번호+사유 포함 |
| AC 매핑 | AC-007 |

---

## TC-007 학생 정보 수정 (AC-008)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-007 |
| 분류 | Integration |
| 우선순위 | P0 |
| 전제조건 | 기존 학생 std_id 보유 |
| 입력 | PUT /api/acm/std/students/:id `{ std_school: "Trinity HS" }` |
| 기대 결과 | 200, 응답에 updated_at 갱신 확인 |
| AC 매핑 | AC-008 |

---

## TC-008 학생 비활성화 (AC-009)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-008 |
| 분류 | Integration |
| 우선순위 | P1 |
| 전제조건 | ACTIVE 학생 std_id |
| 입력 | PATCH /api/acm/std/students/:id/status `{ std_status: "INACTIVE" }` |
| 기대 결과 | 200; GET 목록(기본) 에서 해당 학생 미포함 |
| AC 매핑 | AC-009 |

---

## TC-009 엑셀 양식 다운로드 (AC-010)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-009 |
| 분류 | Integration |
| 우선순위 | P2 |
| 입력 | GET /api/acm/std/students/template |
| 기대 결과 | 200, Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, 헤더 행 포함 |
| AC 매핑 | AC-010 |

---

## TC-010 멀티테넌시 격리 (NFR-STD-002)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-010 |
| 분류 | Integration |
| 우선순위 | P0 |
| 전제조건 | entA 학생 3명, entB 학생 2명 등록 |
| 입력 | entB 토큰으로 GET /api/acm/std/students |
| 기대 결과 | entB 학생 2명만 반환 (entA 노출 없음) |
| AC 매핑 | NFR-STD-002 |

---

## TC-011 인증 없는 접근 차단
| 항목 | 내용 |
|------|------|
| ID | TC-STD-011 |
| 분류 | Integration |
| 우선순위 | P0 |
| 입력 | GET /api/acm/std/students (Authorization 헤더 없음) |
| 기대 결과 | 401 Unauthorized |

---

## TC-012 프론트엔드 — 사이드바 메뉴 (AC-001)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-012 |
| 분류 | E2E (Playwright) |
| 우선순위 | P1 |
| 전제조건 | Staging 로그인 완료 |
| 입력 | 사이드바 "학생관리" 클릭 |
| 기대 결과 | URL = /std, 학생 목록 페이지 렌더링 |

---

## TC-013 프론트엔드 — 등록 폼 (AC-003)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-013 |
| 분류 | Manual |
| 우선순위 | P1 |
| 입력 | "+ 학생 등록" → 폼 작성 → 저장 |
| 기대 결과 | 모달 닫힘, 목록 refresh, 신규 항목 맨 위 또는 알파벳순 위치 |

---

## TC-014 프론트엔드 — 엑셀 업로드 (AC-005)
| 항목 | 내용 |
|------|------|
| ID | TC-STD-014 |
| 분류 | Manual |
| 우선순위 | P1 |
| 입력 | "엑셀 업로드" → TPI_Master.xlsx 선택 → 미리보기 확인 → Import 실행 |
| 기대 결과 | 성공/실패 건수 toast 또는 결과 패널 표시, 목록 반영 |

---

## TC-015 DTO 유효성 검사
| 항목 | 내용 |
|------|------|
| ID | TC-STD-015 |
| 분류 | Unit |
| 우선순위 | P1 |
| 입력 | `{ std_status: "UNKNOWN_VALUE" }` |
| 기대 결과 | 400 Bad Request, ValidationPipe 오류 메시지 |
