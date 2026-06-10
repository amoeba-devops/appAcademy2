---
document_id: RPT-260610-acm-cal-boda-integration
version: 1.0.0
status: complete
created: 2026-06-10
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260526-acm-cal-boda-integration.md (v2.0.0)
  - docs/plan/PLN-260526-acm-cal-boda-integration.md (v1.0.0)
  - docs/reference/MANUAL-260610-boda-classroom-user-flow.md (v1.0.0)
---

# 완료 보고서 — BODA(보다에듀) 화상 강의실 연동 (REQ-260526 v2)

> PLN-260526 v1 의 7 트랙 중 **T1–T7 (mock-first 범위) 모두 완료**. staging + production (acm.amoeba.site) 까지 배포·smoke 검증. 외부 vendor (㈜새하컴즈) Q1·Q2 회신 + Webhook URL 등록 후 `BODA_MODE=mock → http` 토글 한 줄로 cutover.

---

## 1. Summary (요약)

| 항목 | 값 |
|---|---|
| 트랙 | T1–T7 (7/7) |
| 백엔드 신규 파일 | 16 |
| 프론트엔드 신규/수정 | 6 + i18n 4 locale |
| 테스트 추가 | +98 BODA-specific specs (8 spec files), 모두 pass |
| 빌드 | backend `nest build` clean, frontend `tsc + vite build` clean |
| 배포 | cd-staging run 27252653386 ✅ / cd-production run 27252854697 ✅ |
| 도메인 검증 | acm.amoeba.site 4 endpoint smoke 200/400/401 OK |

```
PENDING ──evt 1──▶ OPEN ──evt 2──▶ STARTED ──evt 3──▶ PAUSED
                    │                │                   │
                    └────evt 4───────┴───── (resume) ────┘
                                         │
                                         ▼
                                       ENDED ──evt 5/10──▶ CLOSED
                                                            ▲
                                                            └─ admin 강제폐쇄 / cron auto_reconcile
```

---

## 2. Commit map (커밋 매핑)

| Commit | Track | Scope |
|---|---|---|
| [`7319184`](https://github.com/amoeba-devops/appAcademy2/commit/7319184) | T1 | DB schema — 4 tables + UNIQUE expression index for webhook dedup, set_updated_at trigger reuse |
| [`16e65b4`](https://github.com/amoeba-devops/appAcademy2/commit/16e65b4) | T2 | `BodaeduModule` — mock/http server clients (Basic auth, 5s timeout, 1 retry), AES-256-GCM credential crypto, shared-secret + IP allowlist webhook utils |
| [`8a2a17d`](https://github.com/amoeba-devops/appAcademy2/commit/8a2a17d) | T3 | Admin BODA-CFG CRUD — `GET/PUT /api/admin/cal/boda/config`, secrets BYTEA-encrypted, response exposes `*IsSet` booleans only |
| [`4a19310`](https://github.com/amoeba-devops/appAcademy2/commit/4a19310) | T4 | BODA-ROOM lifecycle — `createPending` / `applyEvent` / `closeAndDelete` / `forceClose`, cal-event service `BODASCHOOL` branch |
| [`909e1df`](https://github.com/amoeba-devops/appAcademy2/commit/909e1df) | T5 | Launcher backend (`/api/cal/boda/launch-context` + `/rooms/:evtId/status`) + `WebClassroomPage` (4 states, 9 error cards, `loadBodaAppApi()` 10s timeout) + i18n × 4 locales |
| [`2b4b34c`](https://github.com/amoeba-devops/appAcademy2/commit/2b4b34c) | T6 | Webhook receiver `POST /api/webhooks/boda` — shared-secret header + IP allowlist + DB UNIQUE dedup, room state dispatch, participant join/leave UPSERT, out-of-order leave-only fallback |
| [`a334732`](https://github.com/amoeba-devops/appAcademy2/commit/a334732) | T7 | `BodaReconcileService` 5-min cron sweep (ENDED → auto_reconcile → CLOSED) + admin endpoints (close / reconcile) + cal-event-modal `BodaRoomPanel` (status badge + 2 action buttons + i18n × 4) |

---

## 3. Architecture (아키텍처)

### 3.1 모듈 경계
```
┌───────────────── frontend-acm (Vite SPA) ─────────────────┐
│ /admin/cal           — BodaRoomPanel (badge + actions)     │
│ /web/classroom/:evtId — Launcher (teacher CTA / student wait) │
└──────────────────────────────────────────────────────────────┘
                        │ JSON over HTTPS (nginx)
                        ▼
┌─────────────────── backend (NestJS) ──────────────────────┐
│ presentation/         ├─ BodaConfigController   (admin CRUD)│
│                       ├─ BodaLaunchController   (launcher) │
│                       ├─ BodaAdminController    (close/reconcile)│
│                       └─ BodaWebhookController  (POST /webhooks/boda)│
│ application/          ├─ BodaConfigService                 │
│                       ├─ BodaRoomService       (state machine)│
│                       ├─ BodaLaunchContextService          │
│                       ├─ BodaWebhookService    (dedup + dispatch)│
│                       └─ BodaReconcileService  (@Cron 5min)│
│ infrastructure/external/bodaedu/                           │
│      mock/http clients · AES-GCM crypto · webhook utils    │
└────────────────────────────────────────────────────────────┘
       │ ACM_DS (postgres-acm)
       ▼
┌─────── PostgreSQL `db_acm` (4 tables) ─────────────────────┐
│ amb_acm_cal_boda_config       — 테넌트 설정 + BYTEA 비밀  │
│ amb_acm_cal_boda_room         — 룸 1:1 매핑 + 상태머신    │
│ amb_acm_cal_boda_participant  — 입·퇴장 기록 (1:N)        │
│ amb_acm_cal_boda_event_log    — webhook 원본 + dedup unique│
└────────────────────────────────────────────────────────────┘
```

### 3.2 핵심 설계 결정
| 결정 | 이유 |
|---|---|
| **AES-256-GCM BYTEA** 자격증명 | NFR-3: authKey/eventSecret 평문 저장 금지. `BODA_CRYPTO_KEY` 32바이트 hex env 로 derive |
| **DB UNIQUE expression index** dedup | webhook 재전송 (vendor 정책상 5xx 시 재시도) — `(COALESCE(meet_idx,''), event_code, event_at, COALESCE(user_id,''))` 로 NULL 매칭까지 처리 |
| **mock-first 토글** (`BODA_MODE=mock\|http`) | vendor 회신 대기 동안 dev/staging 즉시 시연. fixture client 는 meetKey 끝글자로 시나리오 분기 |
| **shared-secret + IP allowlist (HMAC 미지원)** | Q2 회신 전 임시 방어. `verifyAmaWebhook` HMAC 패턴 차용해 향후 deprecate |
| **5분 cron + tenant `reconcileDelayMin`** | webhook 누락 보정 (NFR-2 출결 반영 ≤10분). SERVER API `getJoinLog` 가 권위 |
| **`tac-{evtId hex 32}` meetKey** | 전역 유일 + 불변. UUID dash 제거 + `tac-` prefix — 룸 재생성 시 충돌 방지 |

---

## 4. Endpoint inventory (엔드포인트 목록)

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/api/admin/cal/boda/config` | JWT + ADMIN | 테넌트 BODA 설정 조회 (secrets 미포함) |
| PUT | `/api/admin/cal/boda/config` | JWT + ADMIN | 설정 upsert (비밀은 BYTEA 암호화) |
| GET | `/api/cal/boda/launch-context?evtId=&lang=` | JWT | 런처 페이지 진입 payload (owner / invitee / ADMIN) |
| GET | `/api/cal/boda/rooms/:evtId/status` | JWT | 학생 대기 화면 10s 폴링 |
| POST | `/api/admin/cal/events/:evtId/boda/close` | JWT + ADMIN | 강제 폐쇄 (SERVER API `/svr/meet/close`) |
| POST | `/api/admin/cal/events/:evtId/boda/reconcile` | JWT + ADMIN | 단건 출결 재동기화 (cron 외 즉시) |
| POST | `/api/webhooks/boda` | Shared-secret + IP | BODA → ACM 이벤트 수신 |

---

## 5. Test footprint (테스트 영향)

| Spec file | New tests | Note |
|---|---|---|
| `boda-credential.crypto.spec.ts` (T2) | 7 | AES-GCM round-trip + tamper detection |
| `bodaedu-event-shared-secret.util.spec.ts` (T2) | 6 | timingSafeEqual + reason codes |
| `bodaedu-webhook-allowlist.util.spec.ts` (T2) | 8 | IPv4 + CIDR boundary |
| `bodaedu-server-mock.client.spec.ts` (T2) | 6 | mock convention (-0/-1/-2/-f) |
| `boda-config.service.spec.ts` (T3) | 10 | upsert + getDecrypted* + 503 fail-closed |
| `boda-room.service.spec.ts` (T4) | 21 | createPending idempotency + 8-state machine + forceClose |
| `boda-launch-context.service.spec.ts` (T5) | 13 | owner/invitee/ADMIN 권한 + 시간창 + UTy 분류 |
| `boda-webhook.service.spec.ts` (T6) | 11 | verifyAuth × 4 + handle × 7 (dedup, JOIN/LEAVE, out-of-order, error) |
| `boda-reconcile.service.spec.ts` (T7) | 6 | sweep + reconcileRoom × 3 + vendor-down branch |
| **Total** | **88 BODA + 10 incidental** = **98** | 전부 pass |

---

## 6. Deploy (배포)

```
2026-06-09 13:43 KST   c44b640  staging  ── REQ-260609C 환경변수 문서화
2026-06-09 16:43 KST   488819a  staging  ── REQ-260609C (ama_session) + T5
2026-06-10 03:18 KST   5ede4cd  staging  ── REQ-260609D (local_config mode)
2026-06-10 04:12 KST   a334732  staging  ── T6 + T7 (이 보고서 범위)
2026-06-10 04:25 KST   a334732  production ✅  cd-prod run 27252854697
```

### Smoke 결과 (acm.amoeba.site)

| Endpoint | Expected | Actual |
|---|---|---|
| `POST /api/webhooks/boda` (empty body) | 400 `MISSING_COMPANY_CODE` | ✅ |
| `POST /api/webhooks/boda` (unknown Ccd) | 401 `INVALID_TOKEN` | ✅ |
| `POST /api/admin/cal/events/{uuid}/boda/close` | 401 `Unauthorized` | ✅ |
| `GET /api/admin/cal/boda/config` | 401 `Unauthorized` | ✅ |

---

## 7. Follow-ups (후속 작업)

### 7.1 T8 — Vendor cutover (BODA_MODE=mock → http)
**Blocker:** ㈜새하컴즈 회신 대기
- [ ] Q1: `AuCd` (테넌트 부여 코드) 자동 발급 방식
- [ ] Q2: Webhook HMAC 서명 명세 (현재는 shared-secret 임시 정책)
- [ ] Webhook URL `https://acm.amoeba.site/api/webhooks/boda` 를 BODA 측에 등록
- [ ] 회신 도착 시 staging 에서:
  ```
  PUT /api/admin/cal/boda/config  (per-tenant: companyCode/Id/roomCode/URLs/authKey/eventSecret/allowCidrs)
  BODA_MODE=http  ← env 토글 + 재시작
  ```

### 7.2 `BODA_CRYPTO_KEY` 로테이션
프로덕션 배포 세션 중 채팅에 노출되었음. 신규 키 발급 → 기존 BYTEA 컬럼 re-encrypt 마이그레이션 (이중 키 deriveBodaKey 지원으로 0-downtime 가능).

### 7.3 운영자 온보딩 매뉴얼
[MANUAL-260610-boda-classroom-user-flow.md](../reference/MANUAL-260610-boda-classroom-user-flow.md) — 본 보고서와 함께 작성. 강사 수업 등록 → 학생 입장 흐름까지.

### 7.4 nice-to-have (스코프 외)
- 출석 리포트: BODA participant.total_seconds 를 CLS attendance 와 join 해서 학부모 대시보드에 노출
- BODA 룸 자동 녹화 (vendor 옵션 — SPEC_823 §6) 활성화 + 다운로드 URL 보안
- Q3: BODA Client 미설치 사용자 fallback (현재 9-state error card 만)

---

## 8. Lessons (회고)

### 8.1 What worked
- **mock-first**: vendor 답신 0건 상태에서 7 트랙 전부 dev/staging/prod 동작. cutover 는 env 한 줄.
- **DB UNIQUE expression dedup**: 애플리케이션 코드에서 dedup 로직 짜는 대신 PG SQLSTATE 23505 로 분기 — race-free.
- **상태머신 enum 강제**: CHECK 제약으로 invalid 전이 자체를 거부 → 코드 분기 줄어듦.

### 8.2 Watch-outs
- 채팅 중 `BODA_CRYPTO_KEY` 가 평문으로 한 번 노출됨 — 다음에는 운영 키 생성·전달은 도구(1Password share-link 등) 경유 원칙.
- `frontend/` (Next.js) deprecated 후 staging compose 가 여전히 frontend 서비스 참조해 첫 배포 실패. compose drift 잡기 위해 PR 시 `docker compose config` 검증 step 추가 가치 있음.
- SUDO_PASS env 우회는 임시 패턴. `/etc/sudoers.d/appacademy-deploy` 영구 NOPASSWD 등록이 다음 deploy hardening 우선순위.

---

## 9. Sign-off

- 작성: gray.kim@amoeba.group
- 배포 확인: 2026-06-10 04:25 KST (production smoke 통과)
- 다음 마일스톤: 벤더 Q1·Q2 회신 + Webhook URL 등록 → T8 cutover
