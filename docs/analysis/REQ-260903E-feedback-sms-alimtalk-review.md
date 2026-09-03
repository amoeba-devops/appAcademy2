---
document_id: CAL-REQ-260903E
version: 1.0.0
status: REVIEW (구현 검토 — 의사결정 대기)
date: 2026-09-03
change_log:
  - 2026-09-03 v1.0.0 구현 검토 보고서 작성 (Claude Code)
---

# REQ-260903E — 피드백 문자/카카오 알림톡 발송 구현 검토 / Feedback SMS·AlimTalk Delivery Review

## 1. Requirement (요구)

수업일정의 피드백 발송(현재 이메일, REQ-260902)에 더해, **학부모 핸드폰 번호가 등록된 경우 문자(SMS) 또는 카카오톡 알림톡**으로도 전달하는 기능의 구현 검토.

## 2. Current Assets (보유 자산 — 조사 결과)

| 자산 | 상태 |
|------|------|
| 학부모 전화번호 | `amb_acm_std_parent.par_phone` VARCHAR(30) — 이미 저장·수정 UI 있음 |
| 피드백 발송 파이프라인 | `FeedbackMailerService` + 수신자 선택 모달 + `amb_acm_notification_log`(channel `EMAIL/AMOEBATALK/SMS` 지원) — 채널 추가에 맞는 구조 |
| **AmoebaTalk 클라이언트** | `backend/src/infrastructure/external/ama/notify/` — **코드 완성·미배선**. `POST {AMOEBATALK_API_URL}/api/v1/messages`, Bearer+HMAC 서명, `{to: 전화번호, templateCode, variables, body}`, 5s 타임아웃·1회 재시도, mock 모드 지원. env: `AMOEBATALK_API_URL/API_KEY/HMAC_SECRET` |
| 아키텍처 방침 | CLAUDE.md §4.6 — AMA 연동 범위에 "AmoebaTalk 알림" 명시 (설계 의도된 경로) |

## 3. Options (선택지)

### Option A — AmoebaTalk 경유 (권장)
AMA 플랫폼의 메시징 API로 발송(플랫폼이 알림톡/SMS 라우팅 담당).

- **장점**: 클라이언트 코드가 이미 있어 **배선만 하면 됨**(연동 규모 최소). 아키텍처 방침 일치. 카카오 채널·발신번호 등 인프라를 플랫폼이 관리.
- **선결 조건(외부 의존)**: ① AMA 측 AmoebaTalk API 가동 여부 ② API 자격증명(URL/KEY/HMAC) 발급 ③ 피드백용 **templateCode** 등록(알림톡은 카카오 사전 승인 필수 — 자유 본문 불가, 변수 치환형 고정 템플릿)
- **예상 규모**: 백엔드 ~3파일(모듈 배선 + FeedbackMailer 채널 분기 + 로그), 프론트 발송 모달 채널 선택 UI. **2~3일**

### Option B — 문자업체 직접 연동 (Aligo/Solapi/NHN Cloud 등)
- **장점**: AMA 의존 없음, 즉시 계약 가능.
- **단점/조건**: 신규 연동 개발(REST + 발송결과 웹훅), **발신번호 사전등록**(통신사 인증), 알림톡은 별도로 **카카오 비즈니스 채널 개설 + 대행사 통한 템플릿 승인**(영업일 수일). 건당 과금(SMS ~8~20원/LMS ~30원/알림톡 ~7~9원). 자격증명·과금 관리 부담 신규 발생.
- **예상 규모**: 연동 신규 개발 포함 **4~6일** + 채널/템플릿 승인 리드타임

### 공통 고려사항
- **본문 제약**: 피드백은 리치 HTML — 문자/알림톡엔 그대로 못 보냄. 현실적 형태는 "피드백 도착 알림"(학생명·수업명·일시 + 확인 안내) 요약 발송이며, 전문 열람은 이메일(또는 추후 학부모 포털)로 유도. 알림톡 템플릿 예: `[{{학원명}}] {{학생명}} 학생의 {{수업명}}({{일시}}) 수업 피드백이 도착했습니다.`
- **개인정보**: 피드백 전문을 문자에 담는 것은 길이·비용·유출면에서 비권장.
- 발송 이력은 기존 `notification_log`(channel=AMOEBATALK 또는 SMS)로 수용 가능 — 스키마 변경 불필요.

## 4. Recommendation (권고)

**Option A(AmoebaTalk) 우선.** 단, AMA 측 API 가동·자격증명·템플릿 등록이 선결이므로:
1. (사용자/운영) AMA 플랫폼팀에 AmoebaTalk API 가동 여부·자격증명·알림톡 템플릿 등록 절차 확인
2. 확인되면: 배선 + 피드백 발송 모달에 "알림톡/문자 함께 발송" 옵션 추가(전화번호 보유 학부모 대상), 알림톡 실패 시 SMS 대체발송은 플랫폼 정책에 따름
3. AMA API가 준비 안 된 경우에만 Option B 재검토

## 5. Open Questions (의사결정 필요)

| Q | 내용 |
|---|------|
| Q-A | AMA AmoebaTalk API 실가동 여부 + 자격증명 발급 가능 여부 (플랫폼팀 확인 필요) |
| Q-B | 발송 내용: "도착 알림 요약"(권장) vs 피드백 전문 — 전문은 LMS 장문·비용·유출 이슈 |
| Q-C | 발송 트리거: 이메일 발송과 동시 자동 vs 모달에서 채널 선택(권장) |
