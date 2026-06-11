---
document_id: RPT-260610B-acm-cal-boda-instant-classroom
version: 1.0.0
status: complete
created: 2026-06-11
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260610-acm-cal-boda-instant-classroom.md (v1.0.0)
  - docs/plan/PLN-260610-acm-cal-boda-instant-classroom.md (v1.0.0)
  - docs/implementation/RPT-260610-acm-cal-boda-integration.md (v1.0.0)
  - docs/reference/MANUAL-260610-boda-classroom-user-flow.md (v1.1.0)
---

# 완료 보고서 — 즉시 BODA 화상 강의 개설 (REQ-260610)

> PLN-260610 의 6 트랙 중 **T1–T5a (MVP 범위) 완료**. T5b (학생 LIVE 카드) 는 기존 알림 경로가 사용 흐름을 커버하므로 v1.1 로 의도적 연기. staging + production (acm.amoeba.site) 까지 배포·smoke 검증.

---

## 1. Summary (요약)

| 항목 | 값 |
|---|---|
| 트랙 | T1–T5a (5/6 — T5b 의도적 deferred) |
| 백엔드 신규 파일 | 7 (service ×2 + spec ×2 + controller ×2 + DTO ×1) |
| 프론트엔드 신규/수정 | 2 신규 + 4 수정 + i18n × 4 locale |
| SQL 마이그레이션 | `930-acm-cal-event-source-instant.sql` (자동 적용) |
| 테스트 추가 | +13 specs (Instant 8 + InviteeSuggestions 4 + 인접 1), pass |
| 빌드 | BE `nest build` clean, FE `tsc + vite build` clean |
| 배포 | cd-staging run 27346541425 ✅ / cd-production run 27346779572 ✅ |
| 도메인 검증 | acm.amoeba.site instant + suggestions endpoint 401/401 OK |

```
강사 클릭 (캘린더 헤더)
   │
   │ POST /api/admin/cal/events/instant
   │   X-Idempotency-Key (auto UUID)
   │   { title?, durationMin (30/60/90/120), invitees? }
   ▼
백엔드
   ├─ cal_event INSERT (source=INSTANT, provider=BODASCHOOL)
   ├─ BodaRoomService.createPending() → boda_room PENDING
   ├─ invitee 알림 (AmoebaTalk + Email) 즉시 송부
   └─ launcherUrl = /web/classroom/{evtId}?autoStart=1
   ▼
강사 브라우저 — window.open(launcherUrl, '_blank')
   ▼
런처 페이지: ?autoStart=1 + UTy=11 → useEffect 가 bodaOpen() 즉시 호출
   ▼
BODA 클라이언트 새 데스크톱 창
```

---

## 2. Commit map (커밋 매핑)

| Commit | Scope |
|---|---|
| [`4ba5118`](https://github.com/amoeba-devops/appAcademy2/commit/4ba5118) | T1 SQL + entity / T2 InstantEventService (+8 specs) / T3 InviteeSuggestionsService (+4 specs) / T4 InstantClassModal + 캘린더 헤더 진입 / T5a autoStart 런처 / i18n × 4 cal+classroom 네임스페이스 |

---

## 3. Endpoint inventory (엔드포인트)

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| POST | `/api/admin/cal/events/instant` | JWT + `TEACHER`\|`ADMIN` + Throttle 10/min | 즉시 강의 개설 — Boda 룸 PENDING + invitee 알림 |
| GET | `/api/admin/cal/invitee-suggestions?limit=12` | JWT + `TEACHER`\|`ADMIN` | 추천 학생 (CLASS + RECENT 7d 합집합) |

---

## 4. Acceptance criteria 확인

| AC | 상태 | 비고 |
|---|---|---|
| AC-INSTANT-1 — 모달 기본값 채워짐 | ✅ | `durationMin=90` 기본 선택, title placeholder 자동 생성 |
| AC-INSTANT-2 — 학생 0명·90분 default | ✅ | 200 응답, cal_event 1행, boda_room PENDING |
| AC-INSTANT-3 — 학생 N명 알림 | ✅ | InviteeNotifierService 재사용, 응답에 notifySummary 포함 |
| AC-INSTANT-4 — 학부모/학생 직접 호출 차단 | ✅ | RolesGuard 가 `TEACHER`\|`ADMIN` 외 403 |
| AC-INSTANT-5 — 자동 reconcile/close | ✅ | T7 인프라 재사용 (별도 분기 없음) |
| AC-INSTANT-6 — 더블 클릭 dedup | ✅ | 프론트가 `X-Idempotency-Key` 자동 생성 → Redis SET NX 600s |
| AC-INSTANT-7 — 학생 LIVE 진입 | 🔁 v1.1 deferred | 알림 링크 (`/web/classroom/{evtId}`) 가 동일 경로 제공 |
| AC-INSTANT-8 — vendor 변경 차단 | 🚧 v1.1 follow-up | 모달 자체에서 vendor 노출 안 함. 일정 다이얼로그의 vendor 잠금은 별도 |
| AC-INSTANT-9 — i18n 4 locale | ✅ | ko/en/vi/zh-CN 모두 누락 없음 |

---

## 5. Test footprint

| Spec file | New tests | Note |
|---|---|---|
| `instant-event.service.spec.ts` | 8 | BODASCHOOL/INSTANT 기본값 / title autogen / duration math / launcherUrl `?autoStart=1` / idempotency cache hit + miss / invitee fan-out / meetKey 포맷 |
| `invitee-suggestions.service.spec.ts` | 4 | class-only / recent-only / overlap CLASS-win / limit 트런케이트 |
| **합계** | **+12** | (BODA T1–T7 기존 98 → 110 + 1 incidental = **111**) |

---

## 6. Deploy (배포)

```
2026-06-11 12:25 KST   4ba5118  staging    ✅ cd-staging run 27346541425
2026-06-11 12:34 KST   4ba5118  production ✅ cd-production run 27346779572
```

### Smoke 결과 (acm.amoeba.site)

| Endpoint | Expected | Actual |
|---|---|---|
| `POST /api/admin/cal/events/instant` (no JWT) | 401 | ✅ |
| `GET /api/admin/cal/invitee-suggestions` (no JWT) | 401 | ✅ |

### 마이그레이션
- `sql/acm/930-acm-cal-event-source-instant.sql` 자동 적용 — `deploy-staging.sh` / `deploy-production.sh` 가 `sql/_applied/acm/` 마커로 idempotent 처리. 기존 `MANUAL`/`CLS_SESSION` 행 영향 없음.

---

## 7. Out-of-scope (의도적 v1.1 이연)

| 항목 | 사유 |
|---|---|
| T5b 학생 시간표 LIVE 카드 (FR-INSTANT-6) | InviteeNotifierService 가 이미 즉시 알림 + 직접 launcherUrl 을 제공해 학생/학부모는 1-클릭 입장 가능. 별도 banner UI 는 가치 대비 1~2시간 추가 작업 |
| 검색 (추천 그리드 외) | 추천 12명 + 0명 직접 시작 가능으로 MVP UX 충분. 향후 invitee-candidates 와 동일 백엔드 재사용 |
| 5분 단위 custom duration | Q-INSTANT-1 미결. 30/60/90/120 4-opt 로 우선 출시 |
| KPI 대시보드 분기 (Q-INSTANT-4) | DSH PO 결정 후 v1.1+ |
| 강사 동시 INSTANT 강의 차단 (Q-INSTANT-3) | 벤더 정책 확인 후 |
| AmoebaTalk vs Email 우선순위 (Q-INSTANT-2) | 기존 NotificationService 정책 그대로 |

---

## 8. Follow-ups

### 8.1 즉시 결정 필요 없음 (운영 중 관찰)
- 강사가 INSTANT 강의를 종료하지 않고 떠나는 비율 → T7 reconcile cron 이 보정. 분기별 로그 확인.
- Idempotency-key 충돌률 (Redis instant-event:idem:* prefix) → 0 expected, 1+ 면 클라이언트 UUID 생성 버그.

### 8.2 RPT-260610 (BODA T1–T7) 의 follow-up 과 합집합
- T8 vendor cutover (㈜새하컴즈 Q1·Q2 + Webhook URL)
- BODA_CRYPTO_KEY rotation

### 8.3 v1.1 candidates
- 학생 LIVE 카드 — `/my/timetable` 상단에 active INSTANT events 노출.
- 즉시 강의 모달 내 학생 검색 (현재는 추천 12명만).
- Custom duration (Q-INSTANT-1 운영자 회의 후 결정).

---

## 9. Lessons (회고)

### 9.1 What worked
- **얇은 wrapper 설계**: `InstantEventService` 가 단순히 `CalEventService.create()` 를 호출 — 신규 코드 < 200 LOC. BODA 룸 발급·alert·webhook·reconcile 모두 기존 인프라가 자동 처리.
- **CHECK 제약 relax 패턴**: 기존 enum 컬럼에 새 값 추가는 DROP+ADD CHECK 한 줄 — DEFAULT 변경 없이 무중단.
- **Idempotency-key**: Redis SET NX EX 600 + 클라이언트 자동 UUID 헤더. 더블 클릭 / 네트워크 재시도 양쪽 한 줄에 처리.

### 9.2 Watch-outs
- 모달 안 search 박스가 placeholder hint 만 있고 아직 동작 안 함 — 사용자 혼란 가능성 ↑. v1.1 에서 빠르게 wiring 권장.
- AC-INSTANT-8 (vendor lock) — 즉시 강의 모달 자체에서는 vendor 선택 자체가 없으므로 직접 위반 케이스 없지만, 운영자가 cal-event-modal 로 INSTANT 이벤트를 편집할 때 vendor 드롭다운을 disable 해야 일관됨. 다음 PR.

---

## 10. Sign-off

- 작성: gray.kim@amoeba.group
- 배포 확인: 2026-06-11 12:34 KST production smoke 통과
- 다음 마일스톤: BODA vendor (T8) cutover + REQ-260610 v1.1 (학생 LIVE 카드 + 모달 search)
