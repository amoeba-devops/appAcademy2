---
document_id: RPT-260705-acm-production-cal-cls-verification
version: 1.0.0
status: In Review
created: 2026-07-05
audience: Ops / QA / Dev
---

# ACM Production Deploy + CAL/CLS Verification Report

## 1. Summary

2026-07-05 KST 기준 ACM production 에 CAL/CLS 확장 작업을 배포했고, 배포 직후 운영 URL/인증/API 기준의 1차 점검을 완료했다.

- deployed commit: `b802826`
- commit message: `feat(acm): expand calendar and class scheduling workflows`
- production workflow run: `28710947383`
- workflow result: `success`

이번 배포 범위는 다음을 포함한다.

- CAL 일/주/월 보기 확장
- CAL 일정 분류 확장 (`LEVEL_TEST`, `DEMO_CLASS`, `REGULAR_CLASS`, `OTHER`)
- CAL 카드 제목 형식 정리 (`시간 | 학생 | 수업명`)
- CSL 데모수업 자료/피드백과 CAL 일정의 연결 강화
- CLS 수업 생성/상세/세션 피드백 흐름 확장
- ACM CAL 카테고리 확장을 위한 PostgreSQL migration 적용 (`sql/acm/994-acm-cal-expand-categories.sql`)

## 2. Deploy Facts

## 2.1 Delivery Path

로컬 `ssh acm-prod` 직접 배포는 현재 로컬 공개키가 운영 서버에서 승인되지 않아 사용할 수 없었다.  
대신 저장소에 구성된 공식 GitHub Actions production workflow (`CD — Production`) 로 배포를 진행했다.

## 2.2 Production URLs

- `https://acm.amoeba.site/` → `HTTP 200`
- `https://acm.amoeba.site/admin/login` → `HTTP 200`

## 3. Automated Verification

## 3.1 Existing ACM smoke script

다음 스크립트를 production 에 대해 실행했고 전부 통과했다.

- script: `bash scripts/smoke-acm-p1.sh https://acm.amoeba.site`
- result: `7 pass / 0 fail`

검증 항목:

- `/api/acm/sch/schools`
- `/api/acm/sch/schools/autocomplete`
- `/api/acm/qna/categories`
- `/api/acm/qna/questions`
- `/api/acm/qna/questions?status=OPEN`
- `/api/acm/qna/questions?faqOnly=true`
- `/api/acm/csl/inquiries`

## 3.2 CAL / CLS / CSL follow-up checks

운영 토큰 로그인 후 이번 배포 핵심 표면을 추가로 조회 확인했다.

### CAL

- `GET /api/acm/cal/events?from=2026-07-01T00:00:00+09:00&to=2026-08-01T00:00:00+09:00` → `200`
- `GET /api/acm/cal/events/be207da3-f89d-46e0-a25f-981fca49c8f5` → `200`
- `GET /api/admin/cal/invitee-suggestions?limit=5` → `200`

확인 메모:

- month-range 이벤트 목록 응답 정상
- 이벤트 상세 응답 정상
- 추천 학생 API 응답 정상
- 추천 학생 API 는 `/api/acm/*` 가 아니라 `/api/admin/cal/*` 경로를 사용함

### CLS

- `GET /api/acm/cls/classes?limit=5&offset=0` → `200`
- `GET /api/acm/cls/sessions?from=2026-07-01&to=2026-07-31` → `200`

확인 메모:

- classes list 응답 구조 정상
- sessions list 응답 구조 정상
- 점검 시점 production 데이터는 `classes total = 0`, `sessions = []`

### CSL

- `GET /api/acm/csl/inquiries?limit=1` → `200`
- `GET /api/acm/csl/inquiries/4f9e8c6e-e85c-4bf6-8831-6007d63d4832` → `200`
- `GET /api/acm/csl/inquiries/4f9e8c6e-e85c-4bf6-8831-6007d63d4832/trial-classes` → `200`
- `GET /api/acm/csl/inquiries/4f9e8c6e-e85c-4bf6-8831-6007d63d4832/enrollment` → `200`

확인 메모:

- inquiry 상세 응답 정상
- 샘플 inquiry 의 trial class 는 아직 비어 있음 (`[]`)
- enrollment 데이터는 아직 비어 있음 (`null`)

## 4. Interpretation

현재까지 확인된 범위에서는 다음이 성립한다.

- production 정적 진입점과 로그인 화면은 정상 응답한다.
- ACM 인증 토큰 발급은 정상 동작한다.
- CAL / CLS / CSL 핵심 조회 API 는 배포 후 정상 응답한다.
- 이번 배포에 포함된 PostgreSQL CAL category 확장은 production 에서 장애 없이 반영된 것으로 판단된다.

다만 화면 기능 전체가 운영 데이터로 끝까지 검증된 것은 아니다. 특히 CLS 는 production 기준 실제 class/session 데이터가 없는 상태라서, 수업 생성 이후의 상세 흐름은 수동 시나리오 기반 확인이 추가로 필요하다.

## 5. Manual QA Checklist

## 5.1 `/admin/cal`

- 일 / 주 / 월 전환이 모두 정상 동작하는지 확인
- 일정 카드 제목이 `시간 | 학생 | 수업명` 형식으로 표시되는지 확인
- 일정등록 모달에서 분류가 `레벨테스트 / 데모수업 / 정규수업 / 기타` 로 노출되는지 확인
- 데모수업 / 정규수업에서 보다스쿨 링크 생성 흐름이 정상인지 확인
- 데모수업 일정 상세에서 CSL 업로드 자료가 보이는지 확인
- 설명 하단 `피드백으로 등록` 클릭 시 CSL `3. 데모수업 강사피드백` 으로 반영되는지 확인

## 5.2 `/admin/cls`

- `수업 생성` 다이얼로그가 정상 오픈되는지 확인
- 수업강좌 / 강사 / 학생 / 일정 / 교재 / 피드백 관련 UI 가 모두 노출되는지 확인
- 생성 직후 상세 화면 진입이 정상인지 확인
- 최근 세션 목록에서 피드백 모달이 정상 오픈되는지 확인

## 5.3 `/admin/csl`

- 상담 상세에서 CAL/CLS 연계 데이터가 깨지지 않는지 확인
- 데모수업 일정 생성 후 첨부자료 / 피드백 연결이 기대한 위치에 노출되는지 확인
- 샘플 inquiry `4f9e8c6e-e85c-4bf6-8831-6007d63d4832` 를 기준으로 상세 화면 기본 진입 확인

## 6. Known Gaps / Notes

- production 에 실제 `CLS class/session` 데이터가 아직 없어 읽기 검증은 통과했지만, 생성 후 상세/피드백 흐름은 수동 생성 기반 확인이 필요하다.
- 샘플 inquiry 는 trial class / enrollment 데이터가 비어 있어 해당 구간의 렌더링은 별도 데이터 생성 후 다시 확인해야 한다.
- `invitee-suggestions` 계열은 다른 ACM API 와 경로군이 다르므로 (`/api/admin/cal/*`) 운영 문서와 QA 체크리스트에서 혼동하지 않도록 표기 필요.

## 7. Recommended Next Step

우선순위는 다음 순서가 적절하다.

1. TPI01 테넌트에서 데모수업 일정 1건 생성 후 `/admin/cal` 상세 검수
2. `/admin/cls` 에서 정규수업 1건 생성 후 class/session 상세 검수
3. 상담 상세와 캘린더 피드백 연결 결과를 다시 확인

이 3개가 통과되면 이번 CAL/CLS 배포는 운영 기능 기준으로도 완료 판정이 가능하다.
