---
document_id: PLN-261022
version: 1.0.1
status: APPROVED
change_log:
  - 2026-10-22 v1.0.1 — approved as proposed (Q-A field names only, Q-B chat without content, Q-C no portal reads)
  - 2026-10-22 v1.0.0 — P2 plan (activity log)
---

# PLN-261022 Site audit P2 — activity log (사이트 감사 2단계 — 활동 로그)

## 1. Requirement (요구사항)
요청: "감사 - 활동로그 구현". [REQ-261021B](../analysis/REQ-261021B-site-audit.md) v1.1 §4.2 FR-A-1~10, §4.5 FR-P-1~3 (P2). P1(접속 로그·잠금·실제 IP)은 2026-10-21 운영 배포 완료([PLN-261021B](PLN-261021B-site-audit-p1.md)).

| 포함 (P2) | 제외 (후속) |
| --- | --- |
| 쓰기 API 전체(콘솔·포털) 자동 기록 — 생성·수정·삭제 | 이전 값 → 새 값 전체 비교(§5 Q-A) |
| 개인정보 화면 조회 기록(학생·학부모·교사·직원·상담·맵테스트 신청·청구 상세, 연락처 열람) | 모든 GET 기록 (데이터 과다, Q2 결정) |
| 다운로드 기록: 서버 다운로드 20여 곳 + 브라우저 생성 파일(대시보드 CSV·워크북) | 웹훅·배치(SYSTEM) 행위 — P4 |
| 활동 로그 화면(필터·목록·상세·CSV) + 학생·교사 상세에서 "감사 이력" 바로가기 | 보관 2년·압축 이동·해시 체인 (P4) |
| 대상 표시명 스냅숏 → 삭제된 대상도 이름으로 남음 | |

## 2. As-Is (현황, main `a155775`)
- 쓰기 API **315개**(컨트롤러 89개). 모듈별: prj 36 · csl 36 · system 33 · cal 28 · dsh 22 · talk 21 · std 20 · cls 15 · auth 14 · …
- `amb_acm_audit_log` 기록처 4곳(상담 첨부 다운로드, Google 앱 설정, P1 접속 로그 CSV·잠금 정책 변경). 화면 없음.
- 요청 문맥(실제 IP·UA)은 P1 `currentRequestMeta()` 로 이미 확보.

## 3. Mockup (화면 구성안)

### 3.1 활동 로그 `/admin/audit/activity`
```
┌ 🛡 감사 ─────────────────────────────────────────────────────────────────┐
│ [활동 로그]  접속 로그  접속 통제                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ ┌오늘 활동┐ ┌오늘 삭제┐ ┌오늘 다운로드┐ ┌오늘 거부·실패┐                    │
│ │  312   │ │   4    │ │     9      │ │      2       │                    │
│ └────────┘ └────────┘ └────────────┘ └──────────────┘                    │
├ 필터 ────────────────────────────────────────────────────────────────────┤
│ 기간 [10-16]~[10-22]  행위자 [이름 검색]  행위 [전체 ▾]  메뉴 [전체 ▾]       │
│ 대상 [이름·ID]  결과 [전체|성공|거부·실패]  IP [        ]   [조회] [CSV]     │
├──────────────────────────────────────────────────────────────────────────┤
│ 1,284건                                                          1/26 ▸ │
│ 일시             행위자            행위      메뉴     대상            결과   │
│ 10-22 14:02:11  배예리(관리자)    수정      학생     정이태            성공   │
│ 10-22 13:58:40  배예리(관리자)    다운로드  결제     청구 내보내기(CSV) 성공   │
│ 10-22 13:50:02  김OO(교사)        조회      상담     상담 · 홍길동       성공   │
│ 10-22 13:41:19  박OO(직원)        삭제      수업     수학A 10/23        거부   │
└──────────────────────────────────────────────────────────────────────────┘
 행 클릭 → 상세: 변경 항목(입학일, 사이트) · 요청 경로(PATCH /acm/std/students/…)
              · 응답 코드 · IP · 기기 · 요청 ID
 모바일: 카드(일시·행위자 / 행위·메뉴·대상 / 결과·IP)
```

### 3.2 학생·교사 상세 → 감사 이력 바로가기
```
학생 상세  정이태                         [⋯ 더보기 ▾]
                                          ├ 감사 이력   ← 감사 권한자에게만
                                          └ …
→ /admin/audit/activity?targetType=student&targetId=<id>  (그 대상만 필터)
```

## 4. Design (설계)

### 4.1 Migration `sql/acm/1050-audit-activity-log.sql` (멱등)
`amb_acm_audit_log` 확장(append-only 트리거 유지):
```
+ adl_actor_kind VARCHAR(10)   CONSOLE / PORTAL
+ adl_actor_name VARCHAR(100)  스냅숏
+ adl_actor_role VARCHAR(20)
+ adl_menu       VARCHAR(30)   csl / std / tch / cls / cal / pay / prj / system …
+ adl_target_label VARCHAR(200) 대상 표시명 스냅숏
+ adl_result     VARCHAR(10)   SUCCESS / FAILURE / DENIED
+ adl_http_method VARCHAR(10), adl_http_path VARCHAR(300), adl_http_status SMALLINT
+ adl_request_id VARCHAR(40)
action CHECK += 'DOWNLOAD'
idx (ent_id, created_at DESC), (ent_id, adl_menu, created_at DESC), (ent_id, adl_action, created_at DESC)
```

### 4.2 Backend capture
- **`ActivityAuditInterceptor`** (전역 `APP_INTERCEPTOR`):
  - 대상: `/api/acm/**`, `/api/admin/**`, `/api/portal/**`, `/api/enrollments/**` 의 POST/PUT/PATCH/DELETE + `@AuditRead()`·`@AuditDownload()` 가 붙은 GET.
  - 제외: 접속 로그가 맡는 로그인·로그아웃·비밀번호(`acm/auth/*`, `portal/auth/*`, `auth/parent/*`), 웹훅·공개 접수(`webhooks/*`, `web/*`), 잡음(알림 읽음, 채팅 읽음·입력 중, 푸시 구독), 감사 API 자신의 조회.
  - 행위: POST→CREATE(또는 `@AuditAction('UPDATE')` 로 바꿈), PUT/PATCH→UPDATE, DELETE→DELETE, GET+`@AuditRead`→READ, 파일 응답→DOWNLOAD.
  - 메뉴: 경로 첫 구간(`/api/acm/std/...` → `std`).
  - 대상: 경로 파라미터 중 마지막 ID(`:id`, `:stdId`, `:inqId` …) + 종류(`@AuditTarget('student')` 또는 경로에서 추정). 생성은 응답의 `id` 를 대상 ID 로.
  - **대상 표시명**: 처리 **전에** 조회(삭제돼도 남도록) — 학생·학부모·교사·직원·사용자·상담·수업·일정·프로젝트·이슈·자료·게시글 12종 매핑, 그 외는 ID 만.
  - 변경 항목: 요청 본문 **최상위 키 이름만**(값 미기록), 민감 키(비밀번호·토큰·키·시크릿·연락처·생년월일 등) 이름도 `***` 로.
  - 결과: 2xx SUCCESS, 401/403 DENIED, 그 외 FAILURE (예외 경로도 기록).
  - 저장은 응답을 막지 않음(비동기, 실패 시 서버 로그 경고만).
- **조회 기록**: `@AuditRead('student')` 등을 상세 GET 8곳 + 연락처 열람(POST)에 부착.
- **다운로드 기록**: 다운로드 엔드포인트 20여 곳에 `@AuditDownload('...')` 부착(파일명/종류를 표시명으로). 기존 상담 첨부 다운로드 개별 기록은 이 방식으로 대체.
- **브라우저 생성 파일**: `POST /acm/audit/client-download {kind, label}` — 대시보드 CSV·운영 CSV·워크북 xlsx 저장 시 호출.
- **요청 ID**: 미들웨어에서 `X-Request-Id`(없으면 생성) → 응답 헤더·기록에 사용.

### 4.3 Backend API (`acm/audit/*`, P1 과 같은 권한: TENANT_MASTER·AUDIT_VIEWER)
- `GET activity-logs?from&to&q(행위자)&action&menu&target&targetType&targetId&result&ip&page` (366일, 50/페이지)
- `GET activity-logs/summary` (오늘 활동·삭제·다운로드·거부/실패)
- `GET activity-logs/export.csv` (최대 10만 행, 내보내기 자체 기록)

### 4.4 Frontend
- `aud/pages/activity-log-page.tsx` — P1 접속 로그 화면과 같은 구성(StatCard·FilterBar·ResultBar·표/카드·상세 Dialog·CSV). URL 쿼리로 대상 필터 진입.
- 메뉴 이름은 사이드바 라벨(`common:nav.*`) 재사용.
- 학생·교사 상세 더보기 메뉴에 "감사 이력"(감사 권한자만).
- 대시보드 CSV·운영 CSV·워크북 저장에 `client-download` 호출.
- i18n `aud.activity.*` 4개 언어.

### 4.5 Tests
- unit: 경로→메뉴/대상/행위 판정, 민감 키 가림, 제외 목록.
- integration: 학생 수정 → UPDATE(변경 항목 이름만·값 없음), 학생 삭제 후에도 대상 표시명 유지, 권한 없는 수정 → DENIED, 상세 조회 → READ, CSV 다운로드 → DOWNLOAD, 로그인 → 활동 로그에 없음(접속 로그만), 활동 로그 API 권한(일반 ADMIN 403).

## 5. Decisions needed (결정 필요)

| Q | 질문 | 제안 |
| --- | --- | --- |
| Q-A | 수정 시 **값**까지 남길지 | **항목 이름만** 남김(개인정보·용량 안전). 값 비교가 꼭 필요한 화면(예: 학생 상태·입학일·사이트, 결제 금액)은 기존 모듈 이력(학생 상태/사이트 이력, 결제 원장)으로 확인 |
| Q-B | 채팅 메시지 보내기도 기록할지 | 기록(행위·대상 방만, **내용은 미기록**). 읽음·입력 중은 제외 |
| Q-C | 포털(학생·학부모) 조회 | P1 결정대로 미기록. 포털 쓰기·다운로드는 기록 |

## 6. Steps (작업 순서)
1. 마이그레이션 1050 + 요청 ID 미들웨어
2. 인터셉터·판정 규칙·표시명 조회 + 단위 테스트
3. 조회·다운로드 데코레이터 부착(약 30곳) + client-download API
4. 활동 로그 조회·요약·CSV API + 통합 테스트
5. 프론트 활동 로그 화면·바로가기·브라우저 다운로드 기록·i18n
6. PR → CI → 머지 → staging → 최신 sha 확인 후 production → 운영 DB 로 기록 확인(읽기 전용)

## 7. Impact & Risks (영향·위험)
| 항목 | 내용 | 대응 |
| --- | --- | --- |
| 성능 | 쓰기 요청마다 표시명 조회 1회 + 비동기 저장 1회 | 인덱스 조회만, 저장은 응답 후. 하루 수천~수만 행 예상 |
| 누락 | 새 API 추가 시 조회·다운로드 데코레이터를 빠뜨릴 수 있음 | 쓰기는 자동. 파일 응답(StreamableFile)은 데코레이터 없어도 DOWNLOAD 로 기록하는 안전망 |
| 개인정보 | 대상 표시명(학생 이름 등)이 기록에 남음 | 감사 권한자만 조회, 값은 미기록 |
| 기존 기록 | 상담 첨부 다운로드 개별 기록 → 공통 방식으로 교체 | 행위 EXPORT → DOWNLOAD (기존 행은 그대로) |
