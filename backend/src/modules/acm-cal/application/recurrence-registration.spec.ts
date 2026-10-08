import { RecurrenceService } from './recurrence.service';
import type { RecurrencePreviewDto } from './dto/recurrence.dto';
import type { TenantSettingsService } from '../../acm-system/application/tenant-settings.service';
import { expandRecurrence } from './recurrence-calculator';

const dto = (): RecurrencePreviewDto => ({
  event: {
    evtTitle: 'Class',
    evtStartAt: '2026-10-01T16:00:00Z',
    evtEndAt: '2026-10-01T17:00:00Z',
  },
  rule: {
    kind: 'DAILY',
    interval: 1,
    excludeWeekends: false,
    end: 'UNTIL',
    until: '2026-10-04',
  },
});
const service = () =>
  new RecurrenceService(
    null!,
    null!,
    null!,
    {
      getTimezone: async () => 'Asia/Seoul',
    } as unknown as TenantSettingsService,
    null!,
    null!,
  );

describe('manual repeat registration end date', () => {
  it.each(['DAILY', 'WEEKLY', 'MONTHLY'] as const)(
    'requires an end date for %s',
    async (kind) => {
      for (const end of ['NEVER', 'COUNT', 'UNTIL'] as const) {
        const input = dto();
        input.rule = { ...input.rule, kind, end, until: undefined, count: 5 };
        await expect(service().preview('tenant', input)).rejects.toThrow(
          'REPEAT_UNTIL_REQUIRED',
        );
        await expect(
          service().create(
            { entId: 'tenant', id: 'user', role: 'ADMIN' },
            { ...input, requestId: 'request' },
          ),
        ).rejects.toThrow('REPEAT_UNTIL_REQUIRED');
      }
    },
  );
  it.each(['2026-02-30', '2026-13-01', '2026-10-01T12:00:00Z'])(
    'rejects invalid calendar date %s',
    async (until) => {
      const input = dto();
      input.rule.until = until;
      await expect(service().preview('tenant', input)).rejects.toThrow();
    },
  );
  it('uses tenant local date, accepts same-day termination, includes end day', async () => {
    const input = dto();
    input.rule.until = '2026-10-01';
    await expect(service().preview('tenant', input)).rejects.toThrow(
      'REPEAT_UNTIL_BEFORE_START',
    );
    input.rule.until = '2026-10-02';
    expect((await service().preview('tenant', input)).items).toHaveLength(1);
    input.rule.until = '2026-10-04';
    expect((await service().preview('tenant', input)).items).toHaveLength(3);
  });
  it('allows finite explicit dates but rejects an empty list', async () => {
    const input = dto();
    input.rule = {
      ...input.rule,
      kind: 'DATES',
      end: 'NEVER',
      until: undefined,
      dates: ['2026-10-03', '2026-10-07'],
    };
    expect((await service().preview('tenant', input)).items).toHaveLength(2);
    input.rule.dates = [];
    await expect(service().preview('tenant', input)).rejects.toThrow(
      'REPEAT_DATES_REQUIRED',
    );
  });
  it('continues expanding previously stored unbounded rules', () => {
    const input = dto();
    input.rule.end = 'NEVER';
    input.rule.until = undefined;
    expect(
      expandRecurrence(
        input.event.evtStartAt,
        input.event.evtEndAt,
        'Asia/Seoul',
        input.rule,
        new Date('2026-10-06'),
        10,
      ),
    ).toHaveLength(5);
  });
});
