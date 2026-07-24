# RPT-260724 — 강사 자료실 업로드 불가 원인 분석 & 관리자-강사 채팅 도입 검토

---
document_id: RPT-260724
version: 1.0.0
status: REPORT (보고서 — 구현 미포함)
date: 2026-07-24
---

## Part 1. 강사 포털 자료실 "파일 업로드·공유대상 찾기 안 됨" 원인 (Root Cause)

### 1.1 Symptom (증상)
강사 포털 `문서/자료실 → 내 게시물 → [파일 업로드]` 에서:
- **공유할 학생** 목록이 비어 있음 ("공유 대상이 없습니다.")
- 공유 대상을 선택할 수 없으므로 **[학생에게 공유] 버튼이 비활성** → 업로드 진행 불가

### 1.2 Root Cause (원인) — 코드로 확정, 로컬 재현 완료

**파일 업로드의 공유후보는 "내 수업(반)에 소속된 학생"으로 제한**되어 있다.

| 기능 | 공유후보 소스 | API |
|---|---|---|
| 파일 업로드 | **내 반 학생만** (반 기반) | `GET /portal/materials/share-candidates` |
| 문서(게시판) | 포털 사용자 전체 (강사+학생) | `GET /portal/materials/share-candidates?scope=all` |

- 후보 쿼리(`PortalMaterialService.listShareCandidates` TEACHER 분기):
  `수업(amb_acm_cls_classes) ⋈ 강사 ⋈ 반-학생(재적) ⋈ 학생` — **강사에게 "학생이 소속된 수업(반)"이 하나도 없으면 결과 0명**.
- 프론트(`portal-materials-page.tsx`)는 대상 미선택 시 제출 버튼 비활성(`canSubmit = !!file && selected.size > 0`), 백엔드도 대상 없이는 400(`SELECT_STUDENTS`) — 3중 게이트 모두 정상 동작이며, **후보가 0명인 것이 근본 원인**.

**프로덕션의 강사(김익용)는 학생이 재적 중인 수업(반)이 없어** 후보가 0명 → "기능 안 됨"으로 보이는 것. (일정 참석자·담당강사 지정은 후보 산정에 포함되지 않음 — 오직 반 소속만 봄)

### 1.3 재현 결과 (로컬, 2026-07-24)

| 케이스 | 후보 결과 |
|---|---|
| 반(수업)에 학생이 있는 강사 (김민준) | 2명 정상 표시 (이서연, 박지호) |
| 반이 없는/학생 미소속 강사 | **0명 → 업로드 불가** (증상 재현) |
| 동일 강사, 문서용 `scope=all` | 10명 (전체 후보 정상) — 문서 작성은 문제 없음 |

### 1.4 부수 결함 (조사 중 발견)
1. **삭제된 수업(반)도 후보에 포함** — 후보/스코프 쿼리(`listShareCandidates`, `visibleClassIds`)에 `cls_deleted_at IS NULL` 필터가 없음. 소프트삭제된 반의 학생이 후보로 노출됨 (로컬 재현으로 확인).
2. UI 안내 부족 — 후보 0명일 때 "공유 대상이 없습니다"만 표시되어, 강사 입장에서 원인(반 미배정)을 알 수 없음.

### 1.5 프로덕션 확인 방법 (운영 DB에서 실행)
```sql
-- 김익용 강사의 "학생이 재적 중인 반" 수 (0이면 본 보고서 원인으로 확정)
SELECT count(DISTINCT c.cls_id)
  FROM amb_acm_cls_classes c
  JOIN amb_acm_tch_teacher t
    ON (c.cls_teacher_tch_id = t.tch_id OR t.tch_user_id = c.cls_teacher_user_id)
   AND t.ent_id = c.ent_id
  JOIN amb_acm_cls_class_students cs
    ON cs.cls_id = c.cls_id AND cs.ent_id = c.ent_id AND cs.cst_left_at IS NULL
 WHERE t.tch_email = 'fremdung@gmail.com' AND c.cls_deleted_at IS NULL;
```

### 1.6 조치 옵션 (권고 포함)

| 옵션 | 내용 | 공수 | 비고 |
|---|---|---|---|
| **A. 후보 확대 (권장)** | 파일 업로드 후보를 문서와 동일하게 **포털 학생 전체**로 확대(내 반 학생 상단 정렬). `scope=all` 재사용이라 백엔드 변경 최소 | 소 (0.5일) | 문서/파일 간 동작 일관성 확보 |
| B. 운영 조치 | `/admin/cls`에서 해당 강사의 수업(반)을 만들고 학생 배정 | 0 (데이터) | 즉시 우회 가능하나, 반이 없는 강사마다 반복 발생 |
| C. 후보 기준 추가 | 반 소속 ∪ **담당강사(std_teacher_id) 배정 학생**으로 확대 | 소 | 수강생관리와 동일 기준 — A보다 보수적 |
| (공통) 부수결함 수정 | `cls_deleted_at IS NULL` 필터 추가 + 후보 0명 시 안내문구 개선 | 소 | A/B/C 어느 쪽이든 함께 권장 |

> **권고**: 단기 B(운영 조치)로 즉시 해소 + A(또는 C)와 부수결함 수정을 다음 배포에 포함.

---

## Part 2. 학원관리자 ↔ 강사 채팅 — 기존 고객사(AMA) 채팅 활용 검토

### 2.1 기존 자산 현황 (ambManagement 조사 결과)

AMA 플랫폼에는 **완성도 높은 채팅 2종**이 이미 존재한다.

| 자산 | 용도 | 핵심 기능 | 저장 테이블 |
|---|---|---|---|
| **아메바톡(amoeba-talk)** | 사내/조직 메신저 | 채널 + **1:1 DM(find-or-create)**, SSE 실시간 수신, 접속상태(presence heartbeat), 읽음표시, 리액션, 첨부(클릭 추적), 고정, 검색, 메시지 번역 | `amb_talk_channels/-members/-messages/…` (ent_id 스코프) |
| chat(고객상담) | 고객사 문의 상담 → 이슈/회의록 전환 | 대화(conversation)+타임라인, 관리자 응대 | `conversation/message` |

관리자↔강사 1:1 대화 용도에는 **아메바톡의 DM**이 기능적으로 정확히 부합한다 (`POST talk/channels/dm { target_user_id }` → 채널 재사용/생성, `Sse('events')` 실시간).

### 2.2 ACM에 적용 시 문제점 (Implementation Risks)

| # | 문제점 | 상세 | 심각도 |
|---|---|---|---|
| **P1. 계정 불일치** | 아메바톡의 사용자 = **AMA 계정(userId)**. ACM 학원관리자는 AMA SSO로 계정 보유하나, **포털 전용 강사는 AMA 계정이 없을 수 있음** (`tch_ama_user_id` nullable — AMA에서 동기화된 강사만 보유). AMA 계정 없는 강사는 채팅 주체가 될 수 없음 → **강사 AMA 계정 프로비저닝 절차 필요** | **높음** |
| **P2. 인증 체계 상이** | 포털은 ACM JWT(`ACM_JWT_SECRET`), 아메바톡 API는 AMA JWT. 포털 화면에서 직접 호출 불가 → ① ACM 백엔드가 AMA API를 **서버간 프록시**(기존 HMAC 서명 클라이언트 확장) 또는 ② AMA 토큰 교환(teacher용 SSO) 필요. 기존 `ama-exchange`는 콘솔(관리자)용 | **높음** |
| **P3. 테넌트 매핑** | ACM `entId` ≠ AMA `entityId` (예: `…0001` ↔ `928f5fe4…`) — 기존 연동에서도 확인된 함정. 채널 ent 스코프·상대 검색 시 매핑 테이블 필수 | 중 |
| P4. UI 재사용 불가 | 아메바톡 프론트는 AMA 웹앱 내부 컴포넌트 — ACM 포털에 이식 불가. **포털용 채팅 UI 신규 개발**(목록/대화창/SSE 수신) 필요. 단, API·데이터·실시간은 재사용되므로 순수 신규 대비 공수 대폭 절감 | 중 |
| P5. 데이터 소재/개인정보 | 대화 내용이 **AMA DB**에 저장 — 학원(ACM) 데이터와 물리 분리. 보존/삭제 정책, 학원별 격리(P3와 연동), 관리자 감사 요건 검토 필요 | 중 |
| P6. 권한 모델 | 아메바톡 DM은 `CLIENT_LEVEL` 사용자의 임의 DM을 제한(`assertNotClient`, 같은 채널 멤버 간만 허용). 강사 계정이 AMA에서 어떤 레벨로 프로비저닝되는지에 따라 DM 생성 규칙 조정 필요 | 중 |
| P7. 알림 | 포털 미접속 강사에게 새 메시지 알림 경로 없음 — 기존 AmoebaTalk notify(이메일/톡 알림) 재사용으로 보완 가능 | 낮음 |

### 2.3 구현 옵션 비교

| 옵션 | 방식 | 장점 | 단점/전제 | 예상 공수 |
|---|---|---|---|---|
| **A. 아메바톡 프록시 통합 (권장)** | ACM 백엔드가 AMA talk API를 서버간 프록시(HMAC) + 포털에 경량 채팅 UI + SSE 릴레이. 강사 AMA 계정 자동 프로비저닝(P1) + entId 매핑(P3) | 기존 검증된 메신저 재사용(실시간·읽음·첨부), 관리자는 기존 아메바톡 화면 그대로 사용 가능 | P1·P2 선결 — AMA 측 협의(계정 발급 API·서비스 토큰) 필요 | 중 (5~8일, AMA 협의 별도) |
| B. 아메바톡 바로가기(SSO 링크) | 포털에 "관리자와 대화" 버튼 → AMA 아메바톡 웹 새창(SSO) | 개발 최소 | 강사 전원 AMA 계정 필수(P1 동일), UX 단절(별도 앱 이동), 포털 내 알림 없음 | 소 (1~2일) |
| C. ACM 자체 경량 채팅 | `amb_acm_chat_*` 신규(문서 댓글 인프라 패턴 재사용) + 폴링/SSE | AMA 의존 없음, 포털 계정 그대로, 데이터 학원 DB 내 보관 | 메신저 기능(읽음·첨부·실시간) 자체 구현 — 아메바톡 수준 도달엔 공수 큼 | 중~대 (7~10일) |

### 2.4 권고 (Recommendation)
1. **1순위: 옵션 A** — "기존 고객사 채팅 활용" 취지에 부합. 단, 착수 전 AMA 측과 ①강사 계정 프로비저닝(또는 기존 `tch_ama_user_id` 동기화 강사 한정 1차 오픈) ②서버간 인증(서비스 토큰/HMAC 범위 확장) 2가지 합의가 선결 조건.
2. AMA 협의가 지연되면 **옵션 C**를 대안으로 — 관리자↔강사 1:1 텍스트+첨부 수준의 경량 스펙이면 기존 ACM 인프라(포털 JWT·S3·댓글 패턴)만으로 독립 구현 가능.
3. 어느 옵션이든 **P5(보존·격리 정책)** 는 학원 개인정보 처리방침에 반영 필요.

---

## Appendix. 조사 근거
- 파일 업로드 흐름: `frontend-acm/src/modules/portal-app/pages/portal-materials-page.tsx` (CreateForm), `backend/.../portal-material.service.ts` `listShareCandidates`/`create`
- 재현: 로컬 db_acm + 배포 동일 코드 (2026-07-24), 케이스 3종 API 검증
- 아메바톡: `ambManagement/apps/api/src/domain/amoeba-talk/*` (channel/message/presence 컨트롤러, TalkSseService, amb_talk_* 엔티티)
- 계정 연결: `amb_acm_tch_teacher.tch_ama_user_id` (sql/acm/989), ACM↔AMA SSO 운영 메모
