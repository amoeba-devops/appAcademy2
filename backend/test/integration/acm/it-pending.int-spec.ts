/**
 * IT-01..IT-12 skeleton placeholders. Implement progressively.
 * Cross-references: docs/design/acm-v1.0a-integration-test-001.md
 */
import { bootAcmTestEnv, teardownAcmTestEnv, AcmTestEnv } from './setup';

const cases = [
  ['IT-01', '신규상담 등록 → 학생/MAP 점수 → Gap Analysis (CSL+SCH+REF)'],
  ['IT-03', 'CSL → QNA 크로스링크 + 학생 타임라인 (CSL+QNA)'],
  ['IT-04', 'QNA UNSATISFIED → DSH 컴플레인 자동 prefill (QNA+DSH)'],
  ['IT-05', 'REF 새 버전 발행 → 캐시 무효화 → 과거 시점 lookup (REF+CSL)'],
  ['IT-06', 'DSH 일일 KPI 재집계 cron (DSH)'],
  ['IT-07', 'SCH autocomplete 캐싱 + 신규 등록 시 invalidate (SCH+CSL)'],
  ['IT-08', 'QNA 마이그레이션 (cleanse + 그룹 분리 + ambiguous review)'],
  ['IT-10', 'RBAC 매트릭스 (5 roles × 핵심 endpoint)'],
  ['IT-11', 'C-105 freetext fallback (학교 자동완성 미사용)'],
  ['IT-12', 'QNA responseInternal 포털 노출 금지'],
];

describe.each(cases)('%s %s — TBD', (_id, _label) => {
  let env: AcmTestEnv;
  beforeAll(async () => { env = await bootAcmTestEnv(); }, 180_000);
  afterAll(async () => { await teardownAcmTestEnv(env); });

  it.todo('implement scenario');
});
