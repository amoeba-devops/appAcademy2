---
document_id: PLN-260604-ama-tenant-auth-and-user-directory
version: 1.0.0
status: draft
created: 2026-06-04
authors:
  - gray.kim@amoeba.group
related:
  - docs/analysis/REQ-260604-ama-tenant-auth-and-user-directory.md
---

# 작업 계획서 — AMA 테넌트 인증 + 사용자 디렉터리 (PLN-260604)

> [REQ-260604](../analysis/REQ-260604-ama-tenant-auth-and-user-directory.md) 의 FR-1 ~ FR-6 을 3 트랙 (T1 구독체크 / T2 디렉터리 / T3-4 UI 통합) 으로 분해.

---

## 1. 개요

```
Track T1   Subscription Guard            ~ 1.5h   BE
T1-01  AcademySubscriptionGuard 서비스      0.5h
T1-02  exchangeAmaToken 에 가드 삽입        0.3h
T1-03  i18n 에러 메시지 (4 locale)          0.2h
T1-04  Login page 에러 UX                   0.3h
T1-05  단위 테스트 + smoke                  0.2h

Track T2   AMA Directory Client          ~ 2.5h   BE
T2-01  ama-user-directory module/scaffold  0.3h
T2-02  AmaDirectoryHttpClient (mock-first) 0.6h
T2-03  AmaUserDirectoryService + LRU cache 0.5h
T2-04  GET /api/acm/ama/users 컨트롤러     0.4h
T2-05  AmaTokenVerifier 통합 (인증)         0.3h
T2-06  단위/E2E 테스트                     0.4h

Track T3   Frontend Picker 공통 컴포넌트  ~ 1.5h   FE
T3-01  ama-user-picker.tsx 컴포넌트         0.6h
T3-02  ama-user-api.ts (frontend client)   0.2h
T3-03  i18n key 12개 × 4 locale            0.4h
T3-04  UX: skeleton/empty/error            0.3h

Track T4   Teacher/Staff Form 통합        ~ 1h     FE
T4-01  TchFormModal 에 Picker 통합          0.3h
T4-02  StfFormModal 에 Picker 통합          0.3h
T4-03  POST 본문에 amaUserId 전달           0.2h
T4-04  smoke + visual                      0.2h

Track T5   AMA 팀 계약 + 실연동           외부 의존
T5-01  AMA 디렉터리 API 계약 협의 (URL/auth/shape)
T5-02  AMA_SERVICE_TOKEN 발급
T5-03  mock → real client 전환
T5-04  staging 통합 테스트
```

**합계**: 핵심 ≈ 6.5h (T1+T2+T3+T4 mock-first 기준), AMA 합의 후 T5 ≈ 추가 1h.

---

## 2. UI 목업

### 2.1 로그인 차단 화면 (T1-04)

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│                      ACM admin login                           │
│                                                                │
│         ⚠️  구독이 일시정지되었습니다                            │
│                                                                │
│   결제 정보를 확인하거나 AMA App Store 관리자에게 문의해 주세요. │
│                                                                │
│   [   AMA App Store 열기  →   ]   [  break-glass 로그인  ]      │
│                                                                │
│   상태: SUSPENDED  ·  Entity: tpi-...4f8a                      │
│   마지막 활성: 2026-05-28 02:14 KST                            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**텍스트 매트릭스** (i18n keys `auth.subscription.*`):

| 상태 | line1 | line2 |
|------|-------|-------|
| SUSPENDED | 구독이 일시정지되었습니다 | 결제 정보를 확인해 주세요 |
| CANCELED | 구독이 취소되었습니다 | AMA App Store 에서 재구독 가능합니다 |
| DEPROVISIONED | 이 테넌트의 데이터가 회수되었습니다 | 새로 구독 시 데이터는 복구되지 않습니다 |
| NO_ACADEMY | 등록되지 않은 테넌트입니다 | AMA App Store 에서 app-academy 를 활성화하세요 |

### 2.2 AMA User Picker (T3-01)

**검색 시작 전 (empty state)**:
```
┌── 교사 추가 ─────────────────────────────────────────────┐
│                                                          │
│  AMA 사용자 *                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 이름 또는 이메일로 검색…                         │  │
│  └────────────────────────────────────────────────────┘  │
│  └→ AMA App Store 에 등록된 법인 구성원만 검색됩니다     │
│                                                          │
│  이메일                                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ (사용자 선택 후 자동 입력)            [disabled]    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  과목          [국어 ▾]                                  │
│  연락처        [____________]                            │
│  근무형태      [정규직 ▾]                                │
│                                                          │
│         [  취소  ]              [  추가  ] (disabled)    │
└──────────────────────────────────────────────────────────┘
```

**검색 중 (loading)**:
```
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 김  ⟳                                            │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ░░░░░░░░░  ░░░░░░░     [skeleton]                  │  │
│  │  ░░░░░░░░░  ░░░░░░░                                 │  │
│  └────────────────────────────────────────────────────┘  │
```

**결과 리스트**:
```
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 김                                              ✕│  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 👤 김교사    kim.teach@tpi.kr        [MANAGER]      │  │
│  │ 👤 김민지    minji@tpi.kr            [MEMBER]       │  │
│  │ 👤 김주영    jy.kim@tpi.kr           [VIEWER]       │  │
│  │ — 더보기 (3 of 8)                                   │  │
│  └────────────────────────────────────────────────────┘  │
```

**선택 후**:
```
│  AMA 사용자 *  ✓ 김교사 (MANAGER)                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 김교사 · kim.teach@tpi.kr                       [✕]│  │
│  └────────────────────────────────────────────────────┘  │
│  이메일                                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ kim.teach@tpi.kr                       [auto-fill]│  │
│  └────────────────────────────────────────────────────┘  │
```

**에러 / fallback**:
```
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔍 …                                                │  │
│  └────────────────────────────────────────────────────┘  │
│  ⚠️ 디렉터리 검색을 사용할 수 없습니다 — 수동 입력          │
│                                                          │
│  이름 *        [____________]    (수동 입력 모드)         │
│  이메일 *      [____________]                            │
```

### 2.3 흐름도

```
[Login flow]
 entry  ──► /admin/login?ama_token=…
  │
  ▼
 POST /api/acm/auth/ama-exchange { amaToken }
  │
  ├─ AmaTokenVerifier  (FR-1, 기존)
  │    ✗ invalid → 401/403
  │
  ├─ SubscriptionGuard (FR-1, NEW)
  │    ✗ no academy / not ACTIVE → 403 SUBSCRIPTION_*
  │
  ├─ upsertAmaUser
  │
  └─ signJwt + return ACM token  → /admin/dashboard


[Teacher add flow]
 /admin/tch ──► "교사 추가" 클릭
  │
  ▼
 <TchFormModal>
   <AmaUserPicker  // T3-01
      onSelect={(amaUser) => setFields({name, email, amaUserId})}
      levels={['MANAGER','MEMBER','VIEWER']}
      placeholder="이름 또는 이메일로 검색"
   />
   ... 나머지 필드 ...
  │  (300ms debounce 후)
  ▼
 GET /api/acm/ama/users?level=MANAGER,MEMBER,VIEWER&q=김
   ↓
 Backend: AmaUserDirectoryService.search(entId, q, levels)
   ↓ LRU cache miss
 AMA HTTP client → AMA stg-apps API
   ↓
 [{ amaUserId, name, email, level }, ...] (max 10)
   ↓ 60s cache write
 Frontend: 리스트 렌더 → 선택 → 폼 자동 채움
   ↓
 POST /api/acm/tch/teachers { tchName, tchEmail, tchAmaUserId, ... }
```

---

## 3. Task 상세

### T1-01 — AcademySubscriptionGuard 서비스
**파일**: `backend/src/modules/acm-auth/application/academy-subscription.guard.ts` (NEW)

```ts
@Injectable()
export class AcademySubscriptionGuard {
  constructor(
    @InjectRepository(AcademyEntity) private repo: Repository<AcademyEntity>,
  ) {}

  async ensureActive(amaEntityId: string): Promise<void> {
    const academy = await this.repo.findOne({
      where: { acdAmaTenantId: amaEntityId },
    });
    if (!academy) {
      throw new HttpException(
        { code: 'NO_ACADEMY', message: 'Tenant not provisioned' },
        HttpStatus.FORBIDDEN,
      );
    }
    const status = academy.acdSubscriptionStatus;
    if (!['ACTIVE', 'TRIALING'].includes(status)) {
      throw new HttpException(
        {
          code: `SUBSCRIPTION_${status}`,
          message: `Subscription is ${status}`,
          data: { entityId: amaEntityId, status },
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
```

### T1-02 — exchangeAmaToken 통합
**파일**: `backend/src/modules/acm-auth/application/acm-auth.service.ts:202` (MOD)

```diff
   async exchangeAmaToken(amaToken: string): Promise<AcmLoginResponse> {
     // ...
     payload = this.amaVerifier.verify(amaToken);
+    await this.subscriptionGuard.ensureActive(payload.entityId);
     const user = await this.upsertAmaUser(payload);
```

### T1-04 — Login page 에러 UX
**파일**: `frontend-acm/src/modules/auth/pages/login-page.tsx`

`exchangeAmaToken()` catch 분기에서 error.code 가 `SUBSCRIPTION_*` 또는 `NO_ACADEMY` 면 전용 카드 렌더 (기본 break-glass 폼 위에 stack).

### T2-01..T2-05 — AMA Directory Module
**파일**:
```
backend/src/modules/acm-auth/ama-directory/
├── ama-directory.module.ts                  [NEW]
├── ama-directory.types.ts                   [NEW]  AmaDirectoryUser, etc
├── infrastructure/
│   ├── ama-directory-http.client.ts         [NEW]  HTTP client
│   └── ama-directory-mock.client.ts         [NEW]  fixture for dev (T5 전)
├── application/
│   └── ama-user-directory.service.ts        [NEW]  search() + LRU
└── presentation/
    └── ama-user.controller.ts                [NEW]  GET /api/acm/ama/users
```

**Controller skeleton**:
```ts
@Controller('acm/ama/users')
@UseGuards(AcmJwtGuard, OwnEntityGuard)
export class AmaUserController {
  constructor(private dir: AmaUserDirectoryService) {}

  @Get()
  async search(
    @CurrentAcmUser() u: AcmUserCtx,
    @Query('level') levelCsv: string,
    @Query('q') q: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<AmaDirectoryUser[]> {
    const levels = (levelCsv ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => ['MANAGER', 'MEMBER', 'VIEWER'].includes(s));
    if (!levels.length) levels.push('MANAGER', 'MEMBER', 'VIEWER');
    return this.dir.search(u.amaEntityId, { q, levels, limit });
  }
}
```

**Service (LRU cache)**:
```ts
@Injectable()
export class AmaUserDirectoryService {
  private cache = new LRUCache<string, AmaDirectoryUser[]>({ max: 1000, ttl: 60_000 });
  constructor(private http: AmaDirectoryHttpClient) {}
  async search(amaEntityId: string, opts: SearchOpts): Promise<AmaDirectoryUser[]> {
    const key = `${amaEntityId}|${opts.levels.sort().join(',')}|${opts.q ?? ''}|${opts.limit}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const result = await this.http.searchUsers(amaEntityId, opts);
    this.cache.set(key, result);
    return result;
  }
}
```

**Mock client (T5 전)**:
```ts
@Injectable()
export class AmaDirectoryMockClient implements AmaDirectoryHttpClient {
  async searchUsers(entId: string, { q, levels, limit }: SearchOpts) {
    const fixture: AmaDirectoryUser[] = [
      { amaUserId: 'ama-1', name: '김교사', email: 'kim.teach@tpi.kr', level: 'MANAGER' },
      { amaUserId: 'ama-2', name: '이민지', email: 'minji@tpi.kr', level: 'MEMBER' },
      { amaUserId: 'ama-3', name: '박조회', email: 'view@tpi.kr', level: 'VIEWER' },
      { amaUserId: 'ama-4', name: 'Chris', email: 'chris@tpi.kr', level: 'OWNER' },
    ];
    return fixture
      .filter((u) => levels.includes(u.level))
      .filter((u) => !q || u.name.includes(q) || u.email.includes(q))
      .slice(0, limit);
  }
}
```

### T3-01 — AmaUserPicker 컴포넌트
**파일**: `frontend-acm/src/modules/common/components/ama-user-picker.tsx` (NEW)

Props:
```ts
interface Props {
  value?: AmaDirectoryUser | null;
  onChange: (user: AmaDirectoryUser | null) => void;
  levels?: Array<'MANAGER' | 'MEMBER' | 'VIEWER'>;
  required?: boolean;
  label?: string;
}
```

UX:
- 300ms debounce (`useDebouncedValue`)
- 빈 검색어 → 결과 없음 (안내문만)
- 검색 중 → skeleton
- 결과 ≤ 10 → 리스트 (이름/이메일/level 뱃지)
- 에러 → `<button>수동 입력 모드</button>` 노출 → onChange(null) 후 부모 form 이 manual fields 전환

### T4-01/02 — TchFormModal / StfFormModal 통합

`tchName` / `stfName` + `tchEmail` / `stfEmail` 필드를 AmaUserPicker 로 대체. Picker 결과의 `amaUserId` 를 form state 에 보관, POST payload 에 `tchAmaUserId` / `stfAmaUserId` 로 전달. (스키마 변경 없이 nullable 새 컬럼 추가는 별건)

### T1-05 / T2-06 — 테스트

- `academy-subscription.guard.spec.ts` — ACTIVE/SUSPENDED/CANCELED/missing 각 케이스
- `ama-user-directory.service.spec.ts` — cache hit/miss, level filter, OWNER 제외
- `ama-user.controller.e2e-spec.ts` — entId 격리, levels query parsing
- frontend smoke: `/admin/tch` → 모달 → 검색 + 선택 → POST 페이로드 확인

---

## 4. 일정 (단일 개발자, AMA 합의 전 mock 우선)

```
Day 1 (오후 3h)
  13:00 ~ 13:30  T1-01 SubscriptionGuard
  13:30 ~ 13:50  T1-02 통합
  13:50 ~ 14:10  T1-03 i18n
  14:10 ~ 14:30  T1-04 Login UX
  14:30 ~ 14:50  T1-05 테스트
  14:50 ~ 15:30  T2-01..02 module + mock client
  15:30 ~ 16:00  T2-03..05 service + controller

Day 2 (오전 4h)
  09:00 ~ 09:30  T2-06 backend tests
  09:30 ~ 10:00  T3-01 AmaUserPicker
  10:00 ~ 10:30  T3-02..04 client + i18n + UX
  10:30 ~ 11:00  T4-01/02 Tch/Stf modal 통합
  11:00 ~ 11:30  T4-03 POST payload
  11:30 ~ 12:00  T4-04 smoke + visual + RPT

(이후) T5: AMA 팀 합의 후 1차 fix-up (mock → real client 전환만)
```

---

## 5. 환경 변수

신규 (모두 production `.env.production` 에 추가 필요):

```bash
# AMA Directory API
AMA_DIRECTORY_BASE_URL=https://stg-apps.amoeba.site
AMA_DIRECTORY_USE_MOCK=true                    # T5 전: true, T5 후: false
AMA_SERVICE_TOKEN=                              # AMA 팀 발급 후 채움
```

---

## 6. 리스크 → 완화 매핑

| RID (REQ §9) | 완화 task |
|--------------|----------|
| R-1 AMA API 미존재 | T2-02 mock client + `AMA_DIRECTORY_USE_MOCK` 토글 |
| R-2 webhook 누락 stale | (별건 cron 보강, 본 PLN 범위 외) |
| R-3 break-glass 우회 | T1-02: break-glass 경로는 가드 통과 안 함 (의도) |
| R-4 OWNER 노출 | T2-04 컨트롤러에서 levels 화이트리스트 강제 |
| R-5 latency | T2-03 LRU 60s + T3-01 debounce 300ms |

---

## 7. 변경 파일 매니페스트 (예상)

```
backend/src/modules/acm-auth/
├── application/
│   ├── academy-subscription.guard.ts                         [NEW]
│   ├── academy-subscription.guard.spec.ts                    [NEW]
│   └── acm-auth.service.ts                                   [MOD]
├── acm-auth.module.ts                                        [MOD]
└── ama-directory/                                            [NEW dir]
    ├── ama-directory.module.ts                               [NEW]
    ├── ama-directory.types.ts                                [NEW]
    ├── infrastructure/
    │   ├── ama-directory-http.client.ts                      [NEW]
    │   └── ama-directory-mock.client.ts                      [NEW]
    ├── application/
    │   ├── ama-user-directory.service.ts                     [NEW]
    │   └── ama-user-directory.service.spec.ts                [NEW]
    └── presentation/
        └── ama-user.controller.ts                            [NEW]

frontend-acm/src/
├── modules/auth/pages/login-page.tsx                         [MOD]
├── modules/common/components/ama-user-picker.tsx             [NEW]
├── modules/common/api/ama-user-api.ts                        [NEW]
├── modules/tch/components/tch-form-modal.tsx                 [MOD]
├── modules/stf/components/stf-form-modal.tsx                 [MOD]
└── i18n/locales/{ko,en,vi,zh-CN}/auth.json                   [MOD] × 4
    + {ko,en,vi,zh-CN}/common.json                            [MOD] × 4

docs/
├── analysis/REQ-260604-ama-tenant-auth-and-user-directory.md [NEW]
├── plan/PLN-260604-ama-tenant-auth-and-user-directory.md     [NEW] (본 파일)
└── implementation/RPT-260604-…                               [NEW] (완료 후)
```

**총**: 신규 14 + 변경 5 + 문서 3 = **22 파일** (mock-first 기준).

---

## 8. 사용자 승인 필요 항목

진행 전에 확인 부탁드립니다:

1. **REQ-260604 § 6 USER_LEVEL 매핑** (OWNER 제외 / MANAGER·MEMBER·VIEWER 노출) — 정확한가요?
2. **AMA 팀 컨택 경로** — 누가 디렉터리 API 발급 담당자인지?
3. **mock-first 진행** OK? (실 API 합의는 T5 별건 진행)
4. **구독 차단 UX** — § 2.1 의 4종 메시지 카피 OK? (CANCELED/DEPROVISIONED 의 "재구독 불가" 톤 등)
5. **`AMA_SERVICE_TOKEN`** — service-to-service 인증을 ACM ↔ AMA 어떻게 할지 — AMA 팀과 협의 필요 (REQ § 5)

---

## 9. 다음 단계

1. 본 PLN 사용자 승인 ← 현재 단계
2. T1 (구독 가드) 구현 + smoke (mock 데이터 사용)
3. T2 (디렉터리 mock client) 구현 + backend test
4. T3 (Picker 컴포넌트) + T4 (모달 통합) + i18n
5. localhost + staging smoke test
6. RPT-260604 작성 + 사용자 검수
7. (별건 T5) AMA 팀 API 합의 후 mock → real 전환 PR
