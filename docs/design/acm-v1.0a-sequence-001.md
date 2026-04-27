---
document_id: ACM-SEQ-001
version: 1.0.0
status: DRAFT
authors:
  - 김태윤 팀장 (PO)
related_designs:
  - ACM-FN-CSL-001 v1.0.0
  - ACM-FN-DSH-001 v1.0.0
  - ACM-FN-SCH-001 v1.0.0
  - ACM-FN-REF-001 v1.0.0
  - ACM-FN-QNA-001 v1.0.0
change_log:
  - version: 1.0.0
    date: 2026-04-26
    author: 김태윤 팀장
    description: Sequence diagrams for 8 critical end-to-end flows.
---

# ACM-SEQ-001 — Sequence Diagrams (시퀀스 다이어그램)

> Cross-module end-to-end flows. Each section uses Mermaid `sequenceDiagram`. Actors are labeled by clean-architecture layer where relevant.

---

## 1. CSL — 신규상담 등록 → 학생 매칭 → MAP 점수 → Gap Analysis

```mermaid
sequenceDiagram
  autonumber
  actor Advisor as 어드바이저 (User)
  participant FE as React SPA<br/>(<CslIntakeForm/>)
  participant API as NestJS Controller<br/>(/api/acm/csl)
  participant UC as CreateInquiryUseCase
  participant Dom as InquiryDomainService
  participant Repo as InquiryRepository
  participant DB as PostgreSQL
  participant SchSvc as ISchSchoolService<br/>(REF DI port)
  participant Bus as EventEmitter (in-process)
  participant DSH as DshKpiAggregator
  participant RefSvc as IRefBenchmarkService
  participant Cache as Redis

  Advisor->>FE: 폼 입력 (학부모/학생/학교/검색기준)
  FE->>FE: Zod 검증 + RHF submit
  FE->>API: POST /csl/inquiries (JWT)
  API->>API: AuthGuard + OwnEntityGuard (entId 주입)
  API->>UC: execute(dto, ctx)
  UC->>SchSvc: findById(entId, schId) - 검증
  SchSvc-->>UC: SchoolDto | null
  alt 학교 없음 (freetext fallback C-105)
    UC->>UC: schoolNameSnapshot 사용
  end
  UC->>Dom: validate(dto) - VR-CSL-001..010
  Dom-->>UC: ok
  UC->>Repo: save(inquiry, students[])
  Repo->>DB: BEGIN; INSERT csl_inquiries; INSERT csl_students[]; COMMIT
  DB-->>Repo: inq_id
  Repo-->>UC: Inquiry
  UC->>Bus: emit('acm.csl.inquiry.created', {entId, inqId})
  par 비동기 핸들러
    Bus->>DSH: handle inquiry.created
    DSH->>DB: UPDATE dsh_kpi_snapshots SET volume_count++
  and
    Bus->>Cache: invalidate('csl:list:'+entId)
  end
  UC-->>API: InquiryDto
  API-->>FE: 201 Created
  FE-->>Advisor: 상담 카드 생성 + 학생 목록 표시

  Note over Advisor,FE: --- MAP 점수 입력 단계 ---
  Advisor->>FE: MAP 점수 입력 (Reading 215, Math 222, G3)
  FE->>API: POST /csl/students/{id}/map-scores
  API->>UC: RecordMapScoreUseCase
  UC->>Repo: save mapScore
  UC->>RefSvc: gapAnalysis({examType:MAP, grade:G3, reading:215, math:222})
  RefSvc->>Cache: GET ref:benchmark:{entId}:MAP:G3:2026-04-26
  alt cache miss
    RefSvc->>DB: SELECT benchmark WHERE effective_from<=NOW AND (effective_to IS NULL OR >NOW)
    DB-->>RefSvc: BenchmarkRow
    RefSvc->>Cache: SET (TTL 1h)
  end
  RefSvc-->>UC: GapAnalysisDto {axes, modifierApplied}
  UC-->>API: {mapScore, gapAnalysis}
  API-->>FE: 201
  FE-->>Advisor: Gap 패널 렌더 (READING -5 BELOW, MATH +2 ABOVE)
```

---

## 2. CSL — 상담 → 등록 전환 (Convert to Enrolled)

```mermaid
sequenceDiagram
  autonumber
  actor TL as 팀장 (Team Lead)
  participant FE as React<br/>(<CslDetailView/>)
  participant API as Controller
  participant UC as ConvertToEnrolledUseCase
  participant InqRepo as InquiryRepository
  participant ClsSvc as ICls.EnrollmentService<br/>(v1.0b — fallback to noop in v1.0a)
  participant Bus as EventEmitter
  participant DB as PostgreSQL

  TL->>FE: "등록 전환" 클릭
  FE->>API: POST /csl/inquiries/{inqId}/convert
  API->>UC: execute({inqId, convertedClassId?})
  UC->>InqRepo: load(inqId)
  InqRepo->>DB: SELECT
  DB-->>InqRepo: Inquiry (status=ACTIVE)
  UC->>UC: state machine — ACTIVE → ENROLLED 허용?
  alt 허용
    UC->>InqRepo: update status=ENROLLED, converted_at=NOW
    InqRepo->>DB: UPDATE
    UC->>Bus: emit('acm.csl.inquiry.enrolled', {entId, inqId, studentIds})
    Bus->>ClsSvc: handle (v1.0b 자동 클래스 배정)
    Note over ClsSvc: v1.0a — 이벤트만 발행, 처리는 manual
    UC-->>API: InquiryDto
    API-->>FE: 200
  else 거부
    UC-->>API: 422 BIZ_INVALID_TRANSITION
  end
```

---

## 3. CSL → QNA 크로스 링크 (학생 정기상담 등록)

```mermaid
sequenceDiagram
  autonumber
  actor Adv as 어드바이저
  participant FE as <CslDetailView/>
  participant Modal as <QnaQuickAddButton/>
  participant API as /api/acm/qna
  participant UC as CreateQnaUseCase
  participant CslSvc as ICslInquiryService (DI)
  participant Bus as EventEmitter
  participant DSH as DshKpiAggregator

  Adv->>FE: CSL 상세 → "정기상담 추가" 클릭
  FE->>Modal: open(prefill: {studentUserId, inquiryId})
  Adv->>Modal: 카테고리 선택, 질문/응답 입력
  Modal->>API: POST /qna/records {related.inquiryId, students[], ...}
  API->>UC: execute(dto)
  UC->>CslSvc: findById(entId, related.inquiryId) — 검증
  CslSvc-->>UC: InquiryDto
  UC->>UC: VR-QNA-001..008 검증
  UC->>UC: 트랜잭션: INSERT qna_record + qna_record_students[]
  UC->>Bus: emit('acm.qna.record.created', {entId, qnaId})
  Bus->>DSH: increment Q&A count metric
  UC-->>API: QnaRecordDto
  API-->>Modal: 201
  Modal-->>FE: close + toast "정기상담 등록됨"
  FE->>FE: 우측 패널 <QnaTimelinePanel/> 자동 새로고침
```

---

## 4. QNA — Unsatisfied 해결 → DSH 컴플레인 자동 연결

```mermaid
sequenceDiagram
  autonumber
  actor Adv as 어드바이저
  participant FE as <QnaDetailView/>
  participant API as /api/acm/qna
  participant UC as ResolveQnaUseCase
  participant Bus as EventEmitter
  participant DshHandler as DshComplaintHandler
  participant DshUC as LogComplaintUseCase
  participant FE2 as <DshComplaintLogModal/>

  Adv->>FE: 해결 버튼 → "UNSATISFIED" 선택
  FE->>API: POST /qna/records/{id}/resolve {resolutionStatus:UNSATISFIED}
  API->>UC: execute
  UC->>UC: BR-QNA-006 — emit unsatisfied event
  UC->>Bus: emit('acm.qna.unsatisfied', {entId, qnaId, studentIds})
  Bus->>DshHandler: handle
  DshHandler->>DshUC: createComplaintHint({qnaId, status:PENDING_REVIEW})
  Note over DshHandler: hint = 자동 PoolItem; 사용자 검토 후 최종 등록
  UC-->>API: 200 {qnaId, resolutionStatus}
  API-->>FE: 200
  FE-->>Adv: "🔔 컴플레인 로그가 대기열에 추가되었습니다" 토스트
  Adv->>FE: "지금 등록" 클릭 (선택)
  FE->>FE2: open prefilled
  Adv->>FE2: 분류/원인 보강 후 제출
  FE2->>API: POST /dsh/complaints
  API-->>FE2: 201
```

---

## 5. REF — 벤치마크 새 버전 발행 → 캐시 무효화 → CSL 영향

```mermaid
sequenceDiagram
  autonumber
  actor TL as 팀장
  participant FE as <RefBenchmarkForm/>
  participant API as /api/acm/ref
  participant UC as NewVersionBenchmarkUseCase
  participant Repo as BenchmarkRepository
  participant DB as PostgreSQL
  participant Bus as EventEmitter
  participant Cache as Redis
  participant DshAgg as DshKpiAggregator

  TL->>FE: 기존 MAP_G3 → "새 버전" + effectiveFrom=2026-09-01
  FE->>API: POST /benchmarks/{sbmId}/new-version
  API->>UC: execute
  UC->>Repo: load(sbmId)
  Repo->>DB: SELECT
  DB-->>Repo: prior version
  UC->>UC: §4.1 — version_no = prior+1
  UC->>Repo: TX 시작
  Repo->>DB: UPDATE prior SET effective_to=2026-09-01
  Repo->>DB: INSERT new row (version_no=2, supersedes_id=prior, effective_to=NULL)
  Repo->>DB: COMMIT
  Repo-->>UC: newSbmId
  UC->>Bus: emit('acm.ref.benchmark.versioned', {entId, sbmId, version_no:2})
  par
    Bus->>Cache: DEL ref:benchmark:{entId}:MAP:*
  and
    Bus->>DshAgg: invalidate score-distribution metric
  end
  UC-->>API: BenchmarkDto
  API-->>FE: 201

  Note over FE,DB: --- 이전 CSL 조회 시 (Q-003 검증) ---
  participant CslAPI as /api/acm/csl
  participant CslUC as GetInquiryUseCase
  participant RefSvc as IRefBenchmarkService
  CslAPI->>CslUC: getInquiry({inqId, asOf:inq_registered_at})
  CslUC->>RefSvc: findByGradeBand(entId, MAP, G3, effectiveAt=2026-04-15)
  RefSvc->>DB: SELECT WHERE effective_from<=2026-04-15 AND (effective_to IS NULL OR >2026-04-15)
  DB-->>RefSvc: 이전 버전 (version_no=1)
  RefSvc-->>CslUC: 이전 벤치마크
  CslUC-->>CslAPI: 과거 시점 일관성 보장
```

---

## 6. DSH — 일일 KPI 재집계 (Cron)

```mermaid
sequenceDiagram
  autonumber
  participant Cron as BullMQ Scheduler<br/>(0 3 * * * Asia/Seoul)
  participant Job as DshRecomputeJob
  participant Agg as KpiAggregationService
  participant CslSvc as ICslInquiryService (DI)
  participant QnaSvc as IQnaSearchService (DI)
  participant ClsSvc as IClsClassService (DI v1.0b)
  participant DB as PostgreSQL
  participant Cache as Redis

  Cron->>Job: trigger(date=2026-04-26)
  Job->>Agg: recomputeAll(entId, date)
  loop 각 KPI 메트릭 (21개)
    Agg->>Agg: aggregationType 분기
    alt VOLUME_COUNT
      Agg->>CslSvc: countInquiries({entId, dateRange})
    else STATUS_SNAPSHOT
      Agg->>CslSvc: countByStatus({entId})
    else DAILY_DISTINCT
      Agg->>QnaSvc: countDistinctStudents({entId, date})
    else NET_DELTA
      Agg->>ClsSvc: countNetDelta({entId, dateRange})
    else COMPUTED
      Agg->>Agg: 파생 계산 (ratio, etc.)
    end
    Agg->>DB: UPSERT dsh_kpi_snapshots
  end
  Agg->>Cache: invalidate dsh:dashboard:{entId}
  Agg-->>Job: 완료
  Job-->>Cron: ack
```

---

## 7. SCH — 학교 마스터 등록 → CSL 자동완성 사용

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Admin
  participant FE as <SchSchoolForm/>
  participant SchAPI as /api/acm/sch
  participant SchUC as CreateSchoolUseCase
  participant Bus as EventEmitter
  participant Cache as Redis
  participant Adv as 어드바이저
  participant CslFE as <CslIntakeForm/>
  participant Auto as <SchoolAutocomplete/>

  Admin->>FE: 학교 입력 (이름, 학제, 학년대역)
  FE->>SchAPI: POST /sch/schools
  SchAPI->>SchUC: execute
  SchUC->>SchUC: VR-SCH-001..007
  SchUC->>SchUC: INSERT sch_schools + sch_grade_bands[] + sch_schedules[]
  SchUC->>Bus: emit('acm.sch.school.created')
  Bus->>Cache: invalidate sch:autocomplete:{entId}
  SchUC-->>FE: 201

  Note over Adv,Auto: --- 어드바이저가 신규상담 작성 ---
  Adv->>CslFE: 학교 입력란에 "한산" 타이핑
  CslFE->>Auto: 검색
  Auto->>SchAPI: GET /sch/schools/autocomplete?q=한산&limit=10
  SchAPI->>Cache: GET sch:autocomplete:{entId}:한산
  alt miss
    SchAPI->>SchAPI: pg_trgm 검색
    SchAPI->>Cache: SET (TTL 5m)
  end
  SchAPI-->>Auto: SchoolDto[]
  Auto-->>Adv: 드롭다운 표시
  Adv->>Auto: 선택
  Auto-->>CslFE: schId 주입
```

---

## 8. QNA — 마이그레이션 임포트 (Q-004 cleanse)

```mermaid
sequenceDiagram
  autonumber
  actor Admin as Admin
  participant FE as <QnaMigrationImport/>
  participant API as /api/acm/qna
  participant UC as ImportMigrationUseCase
  participant Worker as BullMQ Worker
  participant Parser as MigrationParserService
  participant DB as PostgreSQL
  participant Review as <QnaMigrationReview/>

  Admin->>FE: xlsx 업로드 (~1500 rows)
  FE->>API: POST /qna/migration/import (multipart)
  API->>UC: execute(file)
  UC->>DB: INSERT qna_migration_jobs (status=QUEUED)
  UC->>Worker: enqueue(jobId)
  UC-->>API: 202 Accepted {jobId}
  API-->>FE: jobId

  Worker->>Parser: parseAndCleanse(file)
  loop 각 row
    Parser->>Parser: BR-QNA-002 — 질문&응답 모두 비면 drop
    Parser->>Parser: BR-QNA-001 — 그룹 학생명 분리
    Parser->>Parser: BR-QNA-003 — response-only → thread parent 추적
    alt 분명한 매칭
      Parser->>DB: INSERT qna_records (migration_quality_flag=CLEAN)
    else 모호
      Parser->>DB: INSERT migration_review_queue (flag=AMBIGUOUS)
    end
  end
  Parser-->>Worker: report {imported, dropped, ambiguous}
  Worker->>DB: UPDATE jobs SET status=COMPLETED, report=...

  Admin->>FE: jobId 폴링 (GET /migration/jobs/{jobId})
  FE->>API: GET
  API-->>FE: {status:COMPLETED, report}
  FE-->>Admin: 결과 표시 + "검토 대기 N건" 배지

  Admin->>Review: 검토 화면
  Review->>API: GET /migration/review-queue
  loop 각 ambiguous row
    Admin->>Review: 학생 매칭 결정
    Review->>API: POST /migration/review-queue/{rowId}/resolve
    API->>DB: INSERT qna_record + DELETE review_queue row
  end
```

---

## 9. Sequence Diagram Index

| § | Flow | 주요 모듈 | 핵심 검증 |
|---|---|---|---|
| 1 | 신규상담 + MAP + Gap | CSL → SCH → REF | Q-003 versioning, BR-CSL-010 |
| 2 | 등록 전환 | CSL (→ CLS v1.0b) | state machine |
| 3 | CSL → QNA 크로스 | CSL → QNA | DI port |
| 4 | UNSATISFIED → DSH | QNA → DSH | event-driven hint |
| 5 | REF 새 버전 + 캐시 | REF → DSH/CSL | Q-003 historical lookup |
| 6 | DSH 일일 재집계 | DSH ← all modules | DI ports |
| 7 | SCH 등록 → autocomplete | SCH → CSL | pg_trgm |
| 8 | QNA 마이그레이션 | QNA | Q-004 cleanse |

---

## 10. Approval

| Role | Name | Status |
|---|---|---|
| PO | 김태윤 팀장 | _Pending_ |
| Architect | TBD | — |

_End of ACM-SEQ-001 v1.0.0._
