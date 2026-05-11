# TC-260511-cal-filter-by-owner-and-attendee — 테스트 케이스

> **Type**: 테스트 케이스 (Test Case)
> **Date**: 2026-05-11
> **Related**: [REQ](../analysis/REQ-260511-cal-filter-by-owner-and-attendee.md), [PLN](../plan/PLN-260511-cal-filter-by-owner-and-attendee.md)

---

## 1. AC 매핑 매트릭스

| AC | TC | 분류 | 우선순위 |
|----|----|------|---------|
| AC-1 | TC-01 | Manual + curl | P0 |
| AC-2 | TC-02 | Manual + curl | P0 |
| AC-3 | TC-03 | Manual + curl | P0 |
| AC-4 | TC-04 | Manual | P1 |
| AC-5 | TC-05 | Manual | P0 |
| AC-6 | TC-06 | curl | P1 |
| AC-7 | TC-07 | curl | P1 |
| (회귀) | TC-08 | curl | P0 |

---

## 2. Test Cases

### TC-01 — 작성자 필터 (강사 선택)
- **전제**: ADMIN 로그인. 강사 A 가 작성한 일정 ≥1, 강사 B 가 작성한 일정 ≥1
- **입력**: `GET /api/acm/cal/events?from=...&to=...&ownerUserId={A}`
- **기대**: 응답 items 의 모든 ownerUserId === A
- **우선순위**: P0

### TC-02 — 참석자 필터 (학생 선택)
- **전제**: ADMIN. 일정 X 에 학생 S 를 invitee 로 등록 완료
- **입력**: `GET /api/acm/cal/events?from=...&to=...&attendeeKind=STUDENT&attendeeRefId={S}`
- **기대**: items 에 일정 X 포함, S 가 참석자가 아닌 일정 미포함
- **우선순위**: P0

### TC-03 — 두 필터 동시 적용 (AND)
- **전제**: 강사 A 가 작성한 일정 X (학생 S 참석), 강사 A 가 작성한 일정 Y (학생 S 미참석), 강사 B 가 작성한 일정 Z (학생 S 참석)
- **입력**: `?ownerUserId={A}&attendeeKind=STUDENT&attendeeRefId={S}`
- **기대**: items = [X] 만 반환
- **우선순위**: P0

### TC-04 — 필터 초기화 (전체)
- **전제**: TC-01 직후
- **입력**: 두 셀렉트를 "전체" 로 변경 (= 파라미터 미전송)
- **기대**: 모든 일정 다시 표시 (range 내)
- **우선순위**: P1

### TC-05 — TEACHER 필터 UI 숨김 + 본인 일정 강제
- **전제**: TEACHER 권한으로 로그인 (`fremdung@gmail.com` / acm20261234)
- **입력**: 캘린더 페이지 접속
- **기대**:
  1. UI: 작성자/참석자 필터 셀렉트가 화면에 없음
  2. API 응답: 본인이 owner 인 일정만 (서버 강제)
  3. 사용자가 직접 `?ownerUserId={다른강사}` 보내도 무시됨
- **우선순위**: P0

### TC-06 — attendee 파라미터 부분 전송 (kind 만)
- **입력**: `?from=...&to=...&attendeeKind=STUDENT` (refId 누락)
- **기대**: 400 `INVALID_ATTENDEE_FILTER`
- **우선순위**: P1

### TC-07 — attendeeRefId 가 잘못된 UUID
- **입력**: `?attendeeKind=STUDENT&attendeeRefId=not-a-uuid`
- **기대**: 400 (class-validator)
- **우선순위**: P1

### TC-08 — 회귀: 기존 ownerUserId only / category only / 필터 없음
- **입력 (a)**: `?from=...&to=...` → 모든 일정
- **입력 (b)**: `?...&category=CLASS` → CLASS 일정만
- **입력 (c)**: `?...&ownerUserId={A}` → A 일정만
- **기대**: 본 변경 이전과 동일 동작
- **우선순위**: P0

---

## 3. 실행 방법

### Backend (curl)
```bash
TOKEN=$(curl -s -X POST 'https://acm-stg.amoeba.site/api/acm/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@tpi.co.kr","password":"acm20261234"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['accessToken'])")

# TC-01
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://acm-stg.amoeba.site/api/acm/cal/events?from=2026-05-01&to=2026-06-01&ownerUserId=<TEACHER_USR_ID>" | jq

# TC-02
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://acm-stg.amoeba.site/api/acm/cal/events?from=2026-05-01&to=2026-06-01&attendeeKind=STUDENT&attendeeRefId=<STD_ID>" | jq

# TC-06
curl -s -i -H "Authorization: Bearer $TOKEN" \
  "https://acm-stg.amoeba.site/api/acm/cal/events?from=2026-05-01&to=2026-06-01&attendeeKind=STUDENT" | head -20
```

### UI (manual)
1. https://acm-stg.amoeba.site/admin/cal 접속 (ADMIN)
2. 헤더 두 셀렉트 동작 확인 (TC-01~04)
3. TEACHER 계정으로 재로그인 → 셀렉트 미노출 확인 (TC-05)
