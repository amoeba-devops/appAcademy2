import { MetricDefinitionTypeormEntity } from '../infrastructure/typeorm/metric-definition.typeorm-entity';
export function withLifecycleMetrics(
  rows: MetricDefinitionTypeormEntity[],
): MetricDefinitionTypeormEntity[] {
  const extra = [
    ['cs_scheduling', 'CS', '스케줄 조율 중', 'Scheduling', 'STATUS_SNAPSHOT'],
    ['cs_scheduled', 'CS', '스케줄 조율 완료', 'Scheduled', 'STATUS_SNAPSHOT'],
    ['cs_new_class', 'CS', '수업시작 학생', 'New Class', 'DAILY_DISTINCT'],
    [
      'ops_returning_st',
      'OPERATING',
      '복귀 학생',
      'Returning St.',
      'DAILY_DISTINCT',
    ],
    [
      'ops_referral_st',
      'OPERATING',
      '소개 학생',
      'Referral St.',
      'DAILY_DISTINCT',
    ],
  ];
  const result = [...rows];
  for (const [code, category, labelKr, labelEn, aggregationType] of extra)
    if (!result.some((r) => r.code === code))
      result.push(
        Object.assign(new MetricDefinitionTypeormEntity(), {
          id: code,
          code,
          category,
          labelKr,
          labelEn,
          aggregationType,
          unit: '명',
          format: 'INT',
          active: true,
          dashboardVisible: true,
          supportsDrillDown: true,
          displayOrder: 0,
        }),
      );
  const order = [
    'cs_counseling',
    'cs_apply',
    'cs_beginning',
    'cs_scheduling',
    'cs_scheduled',
    'cs_missing',
    'cs_trial_class',
    'cs_complain',
    'cs_new_class',
  ];
  return result.map((r) => ({
    ...r,
    displayOrder:
      r.category === 'CS' ? order.indexOf(r.code) + 1 : r.displayOrder * 10,
    ...(r.code === 'ops_new_st'
      ? {
          labelKr: '첫 납부 후 수업 대기',
          aggregationType: 'STATUS_SNAPSHOT' as const,
        }
      : {}),
    ...(r.code === 'ops_returning_st' || r.code === 'ops_referral_st'
      ? {
          displayOrder:
            (rows.find((x) => x.code === 'ops_new_st')?.displayOrder ?? 1) *
              10 +
            (r.code === 'ops_returning_st' ? 1 : 2),
        }
      : {}),
  }));
}
