import { withLifecycleMetrics } from './lifecycle-metrics';
import { MetricDefinitionTypeormEntity } from '../infrastructure/typeorm/metric-definition.typeorm-entity';
it('positions all five metrics without requiring per-tenant seed rows', () => {
  const rows = [
    'cs_counseling',
    'cs_apply',
    'cs_beginning',
    'cs_missing',
    'cs_trial_class',
    'cs_complain',
  ].map((code, i) =>
    Object.assign(new MetricDefinitionTypeormEntity(), {
      code,
      category: 'CS',
      displayOrder: i,
    }),
  );
  const result = withLifecycleMetrics(rows);
  expect(
    result
      .filter((m) => m.category === 'CS')
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((m) => m.code),
  ).toEqual([
    'cs_counseling',
    'cs_apply',
    'cs_beginning',
    'cs_scheduling',
    'cs_scheduled',
    'cs_missing',
    'cs_trial_class',
    'cs_complain',
    'cs_new_class',
  ]);
  expect(result).toHaveLength(rows.length + 5);
});
