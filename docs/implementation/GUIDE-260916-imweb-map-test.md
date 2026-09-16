---
document_id: CSL-GUIDE-260916
version: 1.0.0
status: ACTIVE
date: 2026-09-16
related: docs/plan/PLN-260916-map-test-application-intake.md, docs/implementation/GUIDE-260903G-imweb-apply.md
change_log:
  - 2026-09-16 v1.0.0 최초 작성 — 아임웹 `/test2` 페이지 생성·게시 + 누적 접수 이관 절차 (Claude Code)
---

# GUIDE-260916 — 아임웹 `/test2` 맵테스트 신청 페이지 적용 / imweb MAP Test Form Rollout

## 0. 요약 (What & Why)

기존 `/test` 는 **아임웹 자체 입력폼**이라 접수 데이터가 아임웹 게시판에만 남고 ACM 콘솔·대시보드와 연결되지 않는다.
`/test2` 를 새로 만들어 **ACM 코드 위젯**을 넣으면 접수 즉시 ACM `/admin/test` 에 구조화되어 쌓인다.
`/test` 는 그대로 두고 병행 운영하다가, 안정화 후 메뉴만 `/test2` 로 바꾸면 된다.

| 대상 | 아임웹 관리자 | 새 페이지 | 스니펫 |
|------|--------------|----------|--------|
| TPI | https://tpi.imweb.me/admin | `/test2` | `snippets/map-test-form-tpi.html` |
| TRINITY | https://trinityacademy.imweb.me/admin | `/test2` | `snippets/map-test-form-trinity.html` |

두 사이트 폼 항목은 **9개로 동일**하다 (TRINITY 에는 기존 `/test` 에 없던 "응시 희망 요일/시간" 이 추가된다).

## 1. 사전 확인

1. **중국내 접속 허용이 꺼져 있을 것** — 아임웹 `기본 설정 › 기타 설정 › 중국내 접속 허용(beta)` 이 켜져 있으면 외부 스크립트가 제거되어 폼이 동작하지 않는다. (2026-09-14 기준 TPI·TRINITY 모두 해제 완료)
2. ACM 이 배포되어 `POST /api/web/external-intake/map-test` 가 살아 있을 것.

## 2. 페이지 생성 (사이트마다 반복)

1. 아임웹 관리자 → **사이트 편집(디자인 모드)** 진입
2. 페이지 추가 → 이름 `MAP TEST 응시 신청`, **주소 `test2`** (주소는 40자 이내)
3. 본문에 **"코드" 위젯** 추가
4. 해당 사이트 스니펫 파일 **전체**를 붙여넣기
   - TPI → `docs/implementation/snippets/map-test-form-tpi.html`
   - TRINITY → `docs/implementation/snippets/map-test-form-trinity.html`
   - ⚠ 사이트별 `SITE_KEY` 가 다르므로 파일을 바꿔 쓰지 말 것
5. 저장 → **게시**

## 3. 게시 확인

```bash
# 스니펫이 실제 게시 HTML 에 들어갔는지
curl -s https://www.tpi.co.kr/test2      | grep -c acm-map-apply   # 1 이상
curl -s https://trinityacademy.kr/test2  | grep -c acm-map-apply   # 1 이상
```

`0` 이 나오면 §1-1 (중국내 접속 허용) 을 다시 확인한다.

## 4. 실접수 테스트

1. `/test2` 에서 테스트 값으로 1건 제출 → "접수되었습니다" 모달 확인
2. ACM 콘솔 `/admin/test` 목록에 해당 건이 **사이트·영문명·생년월일·성별·응시지·희망 시간**까지 보이는지 확인
3. 상세에서 값 확인 후 **테스트 건은 삭제**한다 (`/admin/csl/:id` 에서 삭제 — AMA 연동 계정 필요)

## 5. 누적 접수 이관 (1회성)

1. 아임웹 관리자 → **콘텐츠 › 입력폼 › 맵테스트 응시** 선택
2. 우측 상단 **내보내기 → 파일 생성** → 잠시 후 목록에 생긴 파일을 **다운로드** (형식은 `.xlsx`)
3. 엑셀에서 열어 **다른 이름으로 저장 → CSV UTF-8** 로 변환
4. ACM `/admin/test` → **[아임웹 CSV 이관]** → 사이트 선택 → CSV 선택
5. **[검증만]** 으로 건수 확인 → **[이관 실행]**
6. 재실행해도 `(사이트·응답시간·학생 한글이름)` 기준으로 **중복 건너뜀** 되므로 안전하다

> 이관 건은 접수 알림(알림톡·메일)을 보내지 않는다. 상담 단계는 `접수` 로 생성되며 목록에서 조정할 수 있다.

## 6. 접수 알림 설정 (선택, 하지만 권장)

알림을 실제로 보내려면 콘솔 설정이 필요하다. **설정 전에는 콘솔 실시간 알림만 동작**하고, 알림톡·메일은 조용히 건너뛴다(접수는 정상 저장).

| 채널 | 설정 위치 | 입력 항목 |
|------|----------|----------|
| 학부모 알림톡 | `/admin/config/kakao` | Solapi API 키·시크릿, `pfId`, **맵테스트 접수 템플릿 ID** |
| 학부모·운영자 이메일 | `/admin/config/mail` | SMTP 호스트·계정·발신주소, **운영자 알림 수신 이메일**(쉼표 구분) |

알림톡 템플릿 변수는 기존 승인 템플릿과 동일하게 `#{학원명} #{학생명} #{수업명} #{일시}` 를 쓴다
(`수업명` = `MAP TEST 응시`, `일시` = 신청자가 고른 희망 요일/시간).

## 7. 메뉴 교체 (안정화 후, 운영자 판단)

`/test2` 로 접수가 정상 유입되는 것을 며칠 확인한 뒤, 사이트 메뉴의 "MAP TEST 신청" 링크를 `/test` → `/test2` 로 바꾼다.
`/test` 페이지 자체는 과거 접수 조회를 위해 당분간 남겨 둔다.

## 8. 문제 해결

| 증상 | 원인 | 조치 |
|------|------|------|
| 폼이 아예 안 보임 | 중국내 접속 허용 ON / 코드 위젯 미게시 | §1-1 확인 후 재게시 |
| "접수에 실패했습니다" | 사이트 키 불일치(401) 또는 오리진 차단(403) | 스니펫의 `SITE_KEY` 가 사이트와 맞는지 확인 |
| 접수는 되는데 콘솔에 없음 | 다른 테넌트/환경으로 전송 | 스니펫 `API_URL` 이 `acm.amoeba.site` 인지 확인 |
| 이관 시 "컬럼을 찾지 못했습니다" | CSV 가 아닌 xlsx 그대로 업로드 | 엑셀에서 CSV UTF-8 로 저장 후 재시도 |
| 알림이 안 옴 | 템플릿/SMTP 미설정 | §6, 또는 `/admin/notifications` 발송 로그의 `SKIPPED` 사유 확인 |
