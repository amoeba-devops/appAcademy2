---
document_id: ACM-IT-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_designs:
  - ACM-FN-CSL-001
  - ACM-FN-DSH-001
  - ACM-FN-SCH-001
  - ACM-FN-REF-001
  - ACM-FN-QNA-001
  - ACM-SEQ-001
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: 12 end-to-end integration test scenarios spanning all 5 modules.
---

# ACM-IT-001 — Integration Test Scenarios (통합 테스트 시나리오)

> End-to-end 테스트 시나리오 — Jest + Supertest (backend) + Playwright (frontend). Cross-module 흐름 검증 우선. 단위 테스트는 별도 케이스(use-case 단위)로 100% 커버리지 목표, 본 문서는 **integration**만 다룬다.

---

## 1. Test Infrastructure

### 1.1 Stack
| 레이어 | 도구 |
|---|---|
| Backend integration | Jest + `@nestjs/testing` + Supertest |
| DB | Testcontainers (PostgreSQL 15) — per-suite ephemeral |
| Redis | ioredis-mock (or testcontainers redis:7) |
| BullMQ | inline executor (synchronous mode for tests) |
| Frontend e2e | Playwright (Chromium) |
| Test data | factory functions (`faker-js`) per module |

### 1.2 Test DB 시드 표준
```ts
// tests/fixtures/seed.ts
async function seedTenant(): Promise<TestContext> {
  return {
    entId: 'ent-test-001',
    adminUser: { id: '...', role: 'admin' },
    advisorUser: { id: '...', role: 'advisor' },
    teamLeadUser: { id: '...', role: 'team_lead' },
    schoolHansan: { schId: '...', schName: '한산초' },
    benchmark_MAP_G3_v1: { sbmId: '...', effectiveFrom: '2025-03-01', effectiveTo: '2026-04-01' },
    benchmark_MAP_G3_v2: { sbmId: '...', effectiveFrom: '2026-04-01', effectiveTo: null },
    qnaCategory_GENERAL: { catId: '...' },
  };
}
```

### 1.3 Authentication
JWT bearer token 발급은 `tests/helpers/auth.ts` 의 `signToken(userId, entId, role)` 사용. AMB Core auth bypass.

---

## 2. Scenario Index

| # | Title | 모듈 | 우선순위 |
|---|---|---|---|
| IT-01 | 신규상담 등록 → 학생/MAP 점수 → Gap Analysis | CSL+SCH+REF | P0 |
| IT-02 | 신규상담 → 등록 전환 (state machine) | CSL | P0 |
| IT-03 | CSL → QNA 크로스링크 + 학생 타임라인 | CSL+QNA | P0 |
| IT-04 | QNA UNSATISFIED → DSH 컴플레인 자동 prefill | QNA+DSH | P0 |
| IT-05 | REF 새 버전 발행 → 캐시 무효화 → 과거 시점 lookup (Q-003) | REF+CSL | P0 |
| IT-06 | DSH 일일 KPI 재집계 cron | DSH | P1 |
| IT-07 | SCH autocomplete 캐싱 + 신규 등록 시 invalidate | SCH+CSL | P1 |
| IT-08 | QNA 마이그레이션 (cleanse + 그룹 분리 + ambiguous review) | QNA | P0 |
| IT-09 | Multi-tenancy 격리 (OwnEntityGuard) | all | P0 |
| IT-10 | RBAC 매트릭스 (5 roles × 핵심 endpoint) | all | P0 |
| IT-11 | C-105 freetext fallback (학교 자동완성 미사용) | CSL+SCH | P1 |
| IT-12 | QNA `responseInternal` 포털 노출 금지 (PII 가드) | QNA | P0 |

---

## 3. IT-01 — 신규상담 등록 → MAP 점수 → Gap Analysis

### 3.1 Goal
학생 등록 + MAP 점수 입력 시 REF 벤치마크 lookup이 올바르게 적용되어 gap analysis 결과가 반환되는지 검증.

### 3.2 Steps
```ts
describe('IT-01 신규상담 + MAP + Gap', () => {
  it('Given seeded benchmark MAP_G3, When advisor creates inquiry + MAP score, Then gap analysis returns BELOW for reading', async () => {
    // ARRANGE
    const ctx = await seedTenant();
    const token = signToken(ctx.advisorUser.id, ctx.entId, 'advisor');

    // ACT 1: 신규상담 생성
    const inq = await api.post('/api/acm/csl/inquiries', {
      parentName: '김학부모',
      parentPhone: '010-1234-5678',
      registeredAt: '2026-04-26T14:30:00Z',
      route: 'BLOG',
      students: [{
        studentName: '박학생',
        currentGrade: 'G3',
        currentSchoolId: ctx.schoolHansan.schId,
        isForeignSchool: false,
      }],
      dataPrivacyConsent: { granted: true, grantedAt: new Date().toISOString() },
    }).set('Authorization', `Bearer ${token}`).expect(201);

    // ACT 2: MAP 점수 입력
    const studentId = inq.body.students[0].stuId;
    const scoreRes = await api.post(`/api/acm/csl/students/${studentId}/map-scores`, {
      testedOn: '2026-04-20',
      gradeAtTest: 'G3',
      readingScore: 215,
      mathScore: 222,
    }).set('Authorization', `Bearer ${token}`).expect(201);

    // ASSERT
    expect(scoreRes.body.gapAnalysis).toBeDefined();
    const reading = scoreRes.body.gapAnalysis.axes.find(a => a.name === 'READING');
    expect(reading.benchmarkScore).toBe(220); // v2 GENERAL
    expect(reading.delta).toBe(-5);
    expect(reading.status).toBe('BELOW');
    expect(reading.tier).toBe('GENERAL');

    const math = scoreRes.body.gapAnalysis.axes.find(a => a.name === 'MATH');
    expect(math.status).toBe('ABOVE');
    expect(scoreRes.body.gapAnalysis.modifierApplied).toBeNull();
  });
});
```

### 3.3 Acceptance
- 201 응답
- `gapAnalysis.axes` 4종(READING/MATH/LANGUAGE/PERCENTILE) 중 입력 영역 채워짐
- `delta = student - benchmark`, `status` 정확
- `tier=GENERAL` (학생 점수가 GENERAL 범위)

---

## 4. IT-02 — 등록 전환 state machine

### 4.1 Goal
ACTIVE → ENROLLED 정상 전환 + 잘못된 전환(예: DROPPED → ENROLLED) 거부.

### 4.2 Steps
```ts
describe('IT-02 등록 전환', () => {
  it('Given ACTIVE inquiry, When TL converts, Then status=ENROLLED, event emitted', async () => {
    const inq = await createInquiry({ status: 'ACTIVE' });
    const eventSpy = jest.fn();
    eventEmitter.on('acm.csl.inquiry.enrolled', eventSpy);

    const res = await api.post(`/api/acm/csl/inquiries/${inq.inqId}/convert`, {})
      .set('Authorization', tlToken).expect(200);

    expect(res.body.inqStatus).toBe('ENROLLED');
    expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
      entId: ctx.entId, inqId: inq.inqId,
    }));
  });

  it('Given DROPPED inquiry, When TL tries convert, Then 422 BIZ_INVALID_TRANSITION', async () => {
    const inq = await createInquiry({ status: 'DROPPED' });
    await api.post(`/api/acm/csl/inquiries/${inq.inqId}/convert`, {})
      .set('Authorization', tlToken)
      .expect(422)
      .then(res => expect(res.body.error.code).toBe('BIZ_INVALID_TRANSITION'));
  });
});
```

---

## 5. IT-03 — CSL → QNA 크로스링크

### 5.1 Goal
QNA 생성 시 `qnaRelatedInquiryId` 가 CSL DI port로 검증 + 학생 타임라인에서 두 모듈 통합 조회.

### 5.2 Steps
```ts
it('Given inquiry+student, When advisor creates QNA linked, Then student timeline has both inquiry and qna', async () => {
  const inq = await createInquiry({ studentName: '박학생' });
  const studentId = inq.students[0].stuId;
  const studentUserId = inq.students[0].studentUserId;

  await api.post('/api/acm/qna/records', {
    qnaChannel: 'PHONE',
    qnaCategoryId: ctx.qnaCategory_GENERAL.catId,
    qnaIsGeneral: false,
    qnaQuestionText: '점수 문의',
    qnaResponseStatus: 'DRAFT',
    students: [{ qrsStudentUserId: studentUserId, qrsStudentNameSnapshot: '박학생' }],
    qnaRelatedInquiryId: inq.inqId,
  }).set('Authorization', advToken).expect(201);

  // 잘못된 inquiryId — 다른 tenant
  await api.post('/api/acm/qna/records', {
    ...,
    qnaRelatedInquiryId: 'inq-from-other-tenant',
  }).expect(422).then(res => expect(res.body.error.code).toBe('VAL_THREAD_TENANT'));

  // student timeline
  const timeline = await api.get(`/api/acm/qna/students/${studentUserId}/qna`)
    .set('Authorization', advToken).expect(200);
  expect(timeline.body.data).toHaveLength(1);
  expect(timeline.body.data[0].related.inquiryId).toBe(inq.inqId);
});
```

---

## 6. IT-04 — UNSATISFIED → DSH 컴플레인 자동 prefill

### 6.1 Steps
```ts
it('Given QNA, When resolved UNSATISFIED, Then dsh.complaint.hint event emitted with prefill', async () => {
  const qna = await createQna({ studentUserId: 'stu-1' });
  const eventSpy = jest.fn();
  eventEmitter.on('acm.qna.unsatisfied', eventSpy);

  await api.post(`/api/acm/qna/records/${qna.qnaId}/resolve`, {
    qnaResolutionStatus: 'UNSATISFIED',
    promptComplaintLog: true,
  }).set('Authorization', advToken).expect(200);

  expect(eventSpy).toHaveBeenCalledWith({
    entId: ctx.entId,
    qnaId: qna.qnaId,
    studentIds: ['stu-1'],
  });

  // DSH 컴플레인 hint queue 확인
  const hints = await api.get('/api/acm/dsh/complaints?status=PENDING_REVIEW')
    .set('Authorization', tlToken).expect(200);
  expect(hints.body.data.find(h => h.relatedQnaId === qna.qnaId)).toBeDefined();
});
```

---

## 7. IT-05 — REF 버전 + Q-003 historical lookup

### 7.1 Goal
새 벤치마크 버전 발행 후 과거 시점 CSL 조회 시 **이전 버전**이 적용되는지 검증 — Q-003 핵심 acceptance.

### 7.2 Steps
```ts
it('Given CSL inquiry with registeredAt=2026-03-15, When new benchmark v2 takes effect 2026-04-01, Then 과거 조회는 v1 적용', async () => {
  // v1 active 2025-03-01 ~ 
  // 신규상담 등록 (2026-03-15)
  const inq = await createInquiry({ registeredAt: '2026-03-15T00:00:00Z' });
  const score = await addMapScore(inq, { testedOn: '2026-03-15', readingScore: 215 });
  const v1GapDelta = score.gapAnalysis.axes[0].delta;

  // v2 발행 (2026-04-01)
  await api.post(`/api/acm/ref/benchmarks/${ctx.benchmark_MAP_G3_v1.sbmId}/new-version`, {
    sbmEffectiveFrom: '2026-04-01',
    sbmMapReadingScore: 230, // v2: 더 엄격
    sbmMapMathScore: 228,
    grades: [{ gradeLabel: 'G3', gradeMin: 9, gradeMax: 9, curriculumSystem: 'KR' }],
  }).set('Authorization', tlToken).expect(201);

  // 과거 시점(2026-03-15) 조회 — 여전히 v1
  const refetched = await api.get(`/api/acm/csl/inquiries/${inq.inqId}?asOf=2026-03-15`)
    .set('Authorization', advToken).expect(200);
  // gap analysis는 lookup 시 effective_at 기준
  const gap = await api.get(`/api/acm/ref/benchmarks/gap-analysis?examType=MAP&grade=G3&reading=215&effectiveAt=2026-03-15`)
    .set('Authorization', advToken).expect(200);
  expect(gap.body.benchmark.versionNo).toBe(1);

  // 현재 시점 — v2
  const gapNow = await api.get(`/api/acm/ref/benchmarks/gap-analysis?examType=MAP&grade=G3&reading=215`)
    .set('Authorization', advToken).expect(200);
  expect(gapNow.body.benchmark.versionNo).toBe(2);

  // PATCH v1 — 거부 (historical reference 존재)
  await api.patch(`/api/acm/ref/benchmarks/${ctx.benchmark_MAP_G3_v1.sbmId}`, {
    sbmMapReadingScore: 999,
  }).set('Authorization', tlToken).expect(422)
    .then(res => expect(res.body.error.code).toBe('BIZ_VERSION_LOCKED'));
});
```

---

## 8. IT-06 — DSH 일일 KPI 재집계 cron

```ts
it('Given mixed CSL/QNA data, When dsh recompute job runs, Then snapshot row created with correct counts', async () => {
  // 시드: 5 inquiries, 3 qna
  await Array.from({ length: 5 }).map(() => createInquiry({ registeredAt: today() }));
  await Array.from({ length: 3 }).map(() => createQna({ consultedAt: today() }));

  // 잡 실행 (테스트는 inline)
  await dshRecomputeJob.run({ entId: ctx.entId, date: today() });

  const snap = await api.get('/api/acm/dsh/dashboard?dateRange=TODAY')
    .set('Authorization', advToken).expect(200);
  expect(snap.body.columns.find(c => c.metricKey === 'CSL_NEW_INQUIRY_COUNT').currentValue).toBe(5);
  expect(snap.body.columns.find(c => c.metricKey === 'QNA_DAILY_COUNT').currentValue).toBe(3);
});
```

---

## 9. IT-08 — QNA 마이그레이션 cleanse

```ts
it('Given xlsx with 100 rows (50 valid, 30 empty, 20 ambiguous group), When import, Then result counts match', async () => {
  const file = await loadFixture('qna-migration-100.xlsx');
  const submit = await api.post('/api/acm/qna/migration/import')
    .set('Authorization', adminToken)
    .attach('file', file).expect(202);

  // 동기 worker (테스트 모드)
  await runPendingJobs();

  const status = await api.get(`/api/acm/qna/migration/jobs/${submit.body.jobId}`)
    .set('Authorization', adminToken).expect(200);
  expect(status.body.status).toBe('COMPLETED');
  expect(status.body.report.imported).toBe(50);
  expect(status.body.report.dropped).toBe(30);  // BR-QNA-002
  expect(status.body.report.ambiguous).toBe(20);

  // ambiguous review queue
  const queue = await api.get('/api/acm/qna/migration/review-queue')
    .set('Authorization', adminToken).expect(200);
  expect(queue.body.data).toHaveLength(20);

  // 그룹 분리 검증
  const groupRow = queue.body.data.find(r => r.originalStudentName.includes(','));
  expect(groupRow.candidateStudents.length).toBeGreaterThanOrEqual(2);
});
```

---

## 10. IT-09 — Multi-tenancy 격리

```ts
it('Given tenant A inquiry, When tenant B advisor reads, Then 404', async () => {
  const ctxA = await seedTenant({ entId: 'ent-A' });
  const ctxB = await seedTenant({ entId: 'ent-B' });
  const inqA = await createInquiry(ctxA);

  await api.get(`/api/acm/csl/inquiries/${inqA.inqId}`)
    .set('Authorization', signToken(ctxB.advisorUser.id, ctxB.entId, 'advisor'))
    .expect(404);
});
```

---

## 11. IT-10 — RBAC 매트릭스

각 endpoint에 대해 5개 role × {허용/거부} = 매트릭스 검증. 데이터 드라이븐:

```ts
const rbacMatrix = [
  { endpoint: 'POST /csl/inquiries',          viewer: 403, advisor: 201, team_lead: 201, senior_manager: 201, admin: 201 },
  { endpoint: 'DELETE /csl/inquiries/{id}',   viewer: 403, advisor: 403, team_lead: 204, senior_manager: 204, admin: 204 },
  { endpoint: 'POST /qna/records/{id}/promote-faq', viewer: 403, advisor: 403, team_lead: 200, senior_manager: 200, admin: 200 },
  { endpoint: 'POST /ref/benchmarks/{id}/new-version', viewer: 403, advisor: 403, team_lead: 201, senior_manager: 201, admin: 201 },
  { endpoint: 'POST /sch/schools',            viewer: 403, advisor: 403, team_lead: 403, senior_manager: 403, admin: 201 },
  // ... 핵심 30+ endpoints
];

describe.each(rbacMatrix)('RBAC: $endpoint', (row) => {
  it.each(['viewer', 'advisor', 'team_lead', 'senior_manager', 'admin'] as const)(
    '%s expects status %i', async (role) => {
      const expected = row[role];
      // ... 호출 + 상태 코드 검증
    }
  );
});
```

---

## 12. IT-11 — C-105 freetext fallback

```ts
it('Given new inquiry with currentSchoolId=null + currentSchoolNameSnapshot="Unknown School ABC", Then 201 + record stored as freetext', async () => {
  const res = await api.post('/api/acm/csl/inquiries', {
    parentName: '...',
    students: [{
      studentName: '박학생',
      currentGrade: 'G3',
      currentSchoolId: null,
      currentSchoolNameSnapshot: 'Unknown School ABC',
      isForeignSchool: true,
    }],
    ...
  }).set('Authorization', advToken).expect(201);

  const stu = res.body.students[0];
  expect(stu.currentSchoolId).toBeNull();
  expect(stu.currentSchoolNameSnapshot).toBe('Unknown School ABC');

  // SCH 자동 생성 안 됨 (현재 정책)
  const schools = await api.get('/api/acm/sch/schools?q=Unknown School ABC')
    .set('Authorization', advToken).expect(200);
  expect(schools.body.data).toHaveLength(0);
});
```

---

## 13. IT-12 — `qnaResponseInternal` 포털 노출 금지

```ts
it('Given QNA record with internal note, When portal endpoint accessed, Then internal field absent', async () => {
  const qna = await createQna({
    qnaResponseInternal: 'INTERNAL: 학부모 클레임 가능성 높음',
    qnaResponseExternal: '안녕하세요. 답변드립니다 :)',
  });

  // v2.0 portal endpoint mock
  const portalRes = await api.get(`/api/portal/qna/${qna.qnaId}`)
    .set('Authorization', portalParentToken).expect(200);
  expect(portalRes.body.qnaResponseExternal).toBeDefined();
  expect(portalRes.body.qnaResponseInternal).toBeUndefined();

  // 응답 본문에 'INTERNAL:' 문자열 절대 포함 금지
  const raw = JSON.stringify(portalRes.body);
  expect(raw).not.toContain('INTERNAL:');
});
```

---

## 14. Test Coverage Targets

| 레벨 | 도구 | 커버리지 목표 |
|---|---|---|
| 단위 (use-case) | Jest | **90%+ statements, 85% branches** |
| 통합 (cross-module) | Jest+Supertest+Testcontainers | **모든 P0 시나리오 통과** |
| Frontend e2e | Playwright | **핵심 사용자 여정 5종 + smoke** |
| 성능 | k6 | NFR-* SLO 검증 (벤치마크 lookup, QNA 검색) |

### 14.1 CI Pipeline
```yaml
# .github/workflows/ci.yml
jobs:
  test-backend:
    services:
      postgres: image: postgres:15
      redis: image: redis:7
    steps:
      - run: pnpm test:unit
      - run: pnpm test:integration
      - run: pnpm test:cov -- --coverage-threshold='{"global":{"statements":90,"branches":85}}'
  test-frontend-e2e:
    steps:
      - run: pnpm playwright test
```

---

## 15. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| QA Lead | TBD | — |
| Backend Lead | TBD | — |

_End of ACM-IT-001 v1.0.0._
