---
document_id: REQ-261103B
version: 1.1.0
status: IMPLEMENTED
change_log:
  - 2026-11-03 v1.1.0 — decisions confirmed (hide extra textbook, any https link, student+parent, create also full page) and implemented
  - 2026-11-03 v1.0.0 — initial analysis
---

# REQ-261103B Student Edit Page & Class Info (학생 수정 전체 페이지·수업정보 개편)

## 1. Request (요청)
1. `/admin/std/:id` 학생정보 **수정 화면을 모달이 아닌 전체 페이지**로.
2. 수업정보(강사 선택 후 강사별 수업정보)에 **과목·교재·수업링크** 3개 항목만 노출. 수업링크 = Google Meet 주소 입력용.
3. **이동수단·GPA·SSAT/ISEE 삭제.**
4. **학생 포털** 수업일정 아래에 **수업정보 — 강사별 목록**(과목·교재·수업링크) 표시.

## 2. As-Is (현재, cafae35)
| 항목 | 현재 |
|------|------|
| 수정 화면 | 상세 페이지 [수정] → `StdFormModal` 모달(기본정보·MAP·수업정보·메모). 신규 등록도 같은 모달(목록 화면) |
| 수업정보 저장 | `amb_acm_std_teacher_class_info.info` JSONB, 강사별 1행 |
| 수업정보 항목 | 과목(`subject`), 교재(`curriculum`), 추가교재(`materials`), 이동수단(`mobility`), GPA(`gpa`), SSAT/ISEE(`ssatIseeNote`) |
| 상세 화면 | 강사별 묶음에 위 6개 항목 표시 |
| 학생 포털 `/portal/calendar` | 달력·목록만. 수업정보 없음 |

## 3. Requirements (요구사항)
| ID | 내용 |
|----|------|
| FR-1 | 새 경로 `/admin/std/:id/edit`(수정)·`/admin/std/new`(등록, Q4) 전체 페이지. 상세의 [수정] 버튼이 이 페이지로 이동. 저장·취소 후 상세로 복귀. 항목·검증은 현재 모달과 동일 |
| FR-2 | 강사별 수업정보 입력 항목 = **과목·교재·수업링크**. 수업링크는 https 주소 검사(Q2) |
| FR-3 | 이동수단·GPA·SSAT/ISEE(+추가교재, Q1)는 수정·상세 화면에서 제거. **DB 값은 지우지 않고 보존**(저장 시 그대로 유지) |
| FR-4 | 학생 상세 화면 수업정보도 과목·교재·수업링크(링크는 새 탭으로 열림) |
| FR-5 | 학생 포털 수업일정 아래 **수업정보** 섹션: 강사별 카드 — 강사명·과목·교재·수업링크([수업 입장] 버튼). 값이 없으면 '—' |
| FR-6 | 포털 API `GET /api/portal/std/class-info`: 로그인한 학생(또는 학부모의 자녀, Q3) 본인 것만, 현재 배정된 강사만 |
| NFR | 4개 언어, 모바일 규칙, DB 스키마 변경 없음(JSONB에 `meetingUrl` 키 추가) |

## 4. Open Questions (확인 필요)
| # | 질문 | 권장안 |
|---|------|--------|
| Q1 | 현재 "교재"와 별도로 있는 **추가교재** 항목 | **숨김**(3개 항목만), 값은 보존 |
| Q2 | 수업링크 형식 | **Google Meet 주소만** 허용(다른 주소는 저장 거부) |
| Q3 | 포털 수업정보를 볼 사람 | **학생 + 학부모**(학부모는 자녀별로 묶어 표시) |
| Q4 | 신규 학생 등록 화면 | **모달 유지**(요청은 수정 화면만) |

## 5. Decisions (결정, 2026-11-03)
| # | 결정 |
|---|------|
| Q1 | 추가교재 **숨김**(값 보존) |
| Q2 | 수업링크 **https 주소 모두 허용**(Zoom 등 포함), http·주소 아님은 거부 |
| Q3 | 포털 수업정보 **학생 + 학부모**(학부모는 자녀별) |
| Q4 | **신규 등록도 전체 페이지**(`/admin/std/new`) |
