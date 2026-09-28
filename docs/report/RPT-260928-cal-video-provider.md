---
document_id: ACM-CAL-VIDEO-PROVIDER-RPT-1.0.0
version: 1.0.0
status: Implemented - Not Deployed
created: 2026-09-28
updated: 2026-09-28
change_log:
  - version: 1.0.0
    date: 2026-09-28
    description: Implement tenant video provider settings and verify database, service and browser behavior
---

# Video Provider Selection — Implementation Report (화상강의 종류 선택 구현 보고서)

## 1. Outcome (구현 결과)

설정의 **화상강의 설정**에서 구글미트/보다에듀를 선택할 수 있다. 구글 모드의 정규·체험수업 등록은 Google Meet 링크를 저장하고, 관리자·참여자 화면에서 해당 링크로 입장한다. 보다 전용 화면과 사용자 API는 학원 설정에 따라 숨김·차단한다.

- 중립 설정 경로 `/admin/config/video`, 기존 `/admin/config/boda`는 리다이렉트.
- 저장 후 현재 학원의 콘솔·포털 설정 캐시 즉시 갱신. 다른 열린 화면은 포커스 복귀 및 30초 주기 재조회.
- 기존 보다 수업의 일반 편집은 제공사·URL 유지. ‘현재 설정으로 변경’ 시에만 Meet 링크와 수정 사유를 받아 전환.
- 구글→보다 설정 변경 후에도 이미 등록한 구글 일정 링크는 유지.
- 설정 미등록 학원은 기존 보다 동작 유지. 보다 자격증명 테이블은 별도 보존.
- 네 언어(ko/en/vi/zh-CN) 및 모바일 설정 화면 지원.

## 2. Server and Data (서버·데이터)

| Area | Implementation (구현) |
|---|---|
| DB | `999t-acm-cal-video-config.sql`: 학원 unique, 제공사 CHECK, 갱신 trigger, 입장 handoff 시각 |
| Settings | ADMIN GET/PUT `/api/admin/cal/video/config`; 변경 시 기존 감사 테이블에 제공사 변경 기록 |
| Capabilities | 인증된 콘솔 `/api/acm/cal/video-capabilities`, 포털 `/api/portal/cal/video-capabilities`; 자격증명 미포함 |
| CAL | 학원 제공사 강제 검증, 정확한 Meet HTTPS 호스트·회의 경로 검증, 링크 변경 이력 저장 |
| BODA policy | 설정 상세·입장·상태·즉시강의·시뮬레이션·녹화·기록·재동기화·강제종료 사용자 API 차단; 기존 녹화 티켓도 정책 확인 |
| Concurrency | PostgreSQL 학원별 advisory lock 공유. 일반 API DB 연결을 고갈시키지 않도록 잠금용 별도 최대 2개 연결 풀 사용 |
| Transition | 열려 있거나 폐쇄 전인 룸 및 최근 2분 내 발급한 입장 컨텍스트가 있으면 409로 전환 제한 |
| History | webhook·백그라운드 기록 처리는 유지; 제공사 설정 변경만으로 과거 데이터 삭제 없음 |
| Notification | 비활성 보다 일정의 새 초대 알림에는 보다 URL 제외. 구글 일정은 저장된 Meet URL 사용 |

상담의 자동 체험수업 생성 경로도 반영했다. 구글 모드에서 링크 미등록 일정으로 먼저 생성하여 일정 누락을 방지하고, CAL 편집에서 링크를 보완한다. 일반 등록 API는 링크 누락을 허용하지 않는다. CLS의 반별 설정은 신규 CAL 설정을 우회해 보다 기능을 활성화하지 않는다. 현재 코드에는 설계 문서의 독립 고정 강의실 구현이 없어 별도 신규 기능을 추가하지 않았다.

## 3. Validation (검증)

| Check | Result (결과) |
|---|---|
| Backend focused tests | CAL 및 상담 캘린더 연동 14 suites / 158 tests 통과 |
| PostgreSQL integration | 임시 독립 컨테이너에서 4 tests 통과: migration 재실행, 제약/trigger, 학원 격리·감사, 활성 룸/입장 handoff·동시성 |
| Backend build | `npm run build` 통과 |
| Frontend build | `npm run build` 통과; Vite 번들 크기 경고 존재 |
| Browser smoke | Playwright + 실제 로컬 Vite + fixture API로 설정 왕복 변경, 잘못된 URL 거부, 구글 수업 저장·직접 링크 입장, 기존 보다 일반 편집 보존·명시적 전환, 포털/직접 런처 차단, 모바일 가로 넘침 없음 확인 |
| Side effects | 브라우저 검증에서 운영 API·외부 Google/BODA 요청 차단, 이메일 발송 없음. 운영 DB 변경 없음 |

테스트 소스:

- `backend/src/modules/acm-cal/application/{meeting-url,video-config.service,cal-event-video}.spec.ts`
- `backend/src/modules/acm-cal/presentation/video-policy.spec.ts`
- `backend/test/integration/acm/it-cal-video-config.int-spec.ts`
- `frontend-acm/test/video-provider.smoke.cjs` (Playwright 설치 또는 `PLAYWRIGHT_MODULE` 경로 필요, Vite `127.0.0.1:5173` 사용)

재실행 명령:

```sh
npm test --prefix backend -- --runInBand --silent --testPathPatterns='acm-cal|csl-cal-linker'
npm run test:int --prefix backend -- --testPathPatterns=it-cal-video-config
npm run build --prefix backend
npm run build --prefix frontend-acm
node frontend-acm/test/video-provider.smoke.cjs
```

## 4. Deployment and Limits (배포 및 한계)

**운영 반영은 아직 하지 않았다.** 기존 `910` trigger 함수 및 `965` 감사 테이블이 있는 PG 환경에서 `999t` migration을 먼저 적용한 뒤 backend→frontend 순서로 배포한다. 관리자가 설정을 저장하기 전까지 기존 보다 동작을 유지한다.

- Google Meet 링크는 사용자가 직접 생성한다. OAuth·회의 자동 생성·Google 녹화/출결 수집은 이번 범위에 없다.
- 실제 Google/BODA 서비스 입장 및 운영 테넌트 설정 변경은 수행하지 않았다. 로컬 브라우저 테스트는 fixture 데이터로 수행했다.
- 이미 사용자에게 전달된 외부 서비스 링크·입장 자격은 소급 회수할 수 없다. 서버 정책은 새 앱 요청을 차단하며 2분 handoff 제한은 개설 webhook 전 경합을 줄인다. 장시간 열어둔 외부 강의 클라이언트까지 종료하는 기능은 아니다.
- 구글 일정을 생성한 후에는 수업을 보다로 강제하는 구버전 프론트로 단순 롤백하지 않는다. 제공사 호환 코드와 일정 데이터를 함께 보존해야 한다.

## 5. References (참조)

- [Requirements (요구사항)](../analysis/REQ-260928-cal-video-provider.md)
- [Work plan (작업계획)](../plan/PLN-260928-cal-video-provider.md)
