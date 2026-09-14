---
document_id: CSL-REQ-260914E
version: 1.0.0
status: CONFIRMED — 옵션 A(정식 수집·저장) 채택 (2026-09-14 사용자 확정)
date: 2026-09-14
change_log:
  - 2026-09-14 v1.0.0 외부 상담접수 폼 연락처 분리(전화번호/이메일) 대응 (Claude Code)
---

# REQ-260914E — 상담 학부모 이메일 수집·저장 / Parent Email on Consultation Intake

## 1. 발단 — 운영 장애

`https://www.tpi.co.kr/contact2` 상담 접수가 **전건 실패**하고 있었다.

```
POST https://acm.amoeba.site/api/web/external-intake  →  400
{"error":{"code":"HTTP_400","message":["property parentEmail should not exist"]}}
```

아임웹 폼에서 **연락처를 전화번호 + 이메일로 분리**하면서 스니펫이 `parentEmail` 을
보내기 시작했는데, 서버 `ExternalIntakeDto` 에 해당 필드가 없었다. 전역
ValidationPipe 가 `forbidNonWhitelisted: true` 라 **DTO 에 없는 속성이 오면 400**
이다 (backend/src/main.ts).

재현: 허니팟(`website`)을 채워 저장 없이 검증 단계만 태운 요청으로 프로덕션에서
동일 응답 확인 (2026-09-14).

## 2. 요구사항

- **R-1** 외부 접수 API 가 `parentEmail` 을 수용한다 (이메일 칸이 없는 사이트도 있으므로 optional).
- **R-2** 이메일을 **정식 컬럼으로 암호화 저장**한다 (전화번호·학부모명과 동일 방식).
- **R-3** 관리자 상담 상세에서 이메일을 확인하고, 콘솔 직접 등록 시에도 입력할 수 있다.
- **R-4** 3개 사이트(TPI / TRINITY / SANTACROCE) 스니펫을 동일하게 맞춘다.

## 3. As-Is

| 항목 | 현황 |
|---|---|
| `ExternalIntakeDto` | `parentEmail` 없음 → 400 |
| `CreateInquiryDto` | 이메일 필드 없음 |
| `amb_acm_csl_inquiry` | 이메일 컬럼 없음 (이름·전화번호만 AES-GCM 저장) |
| 저장소 스니펫 3종 | `연락처` 단일 입력 — 아임웹 TPI 실물과 어긋난 상태 |

## 4. 결정 (2026-09-14)

사용자 확정: **옵션 A — 정식 수집·저장**. (B: message 에 덧붙이기 / C: 폼 롤백 은 채택하지 않음)
다른 2개 사이트도 동일 폼으로 변경 예정이므로 optional 로 받아 3사이트 공통 처리한다.

## 5. Acceptance Criteria

- **AC-1** `parentEmail` 포함 요청이 201 로 접수된다.
- **AC-2** 이메일 없이 보내는 사이트도 그대로 접수된다 (하위호환).
- **AC-3** 잘못된 형식은 400 으로 거절된다.
- **AC-4** 저장은 AES-GCM 암호화 (NFR-005 / ADR-005), 평문 컬럼 없음.
- **AC-5** 관리자 상담 상세에 `학부모 이메일` 이 표시된다.
- **AC-6** 기존 행(이메일 없음)은 `—` 로 표시되고 오류가 없다.

## 6. 범위 외

- 이메일 기반 알림 발송 (피드백 메일 기능은 학부모 계정 이메일을 별도로 씀)
- 기존 상담 건의 이메일 소급 입력
