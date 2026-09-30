import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRecurrenceDto } from './recurrence.dto';
const valid = {
  requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  event: {
    evtTitle: 'Class',
    evtStartAt: '2030-10-01T00:00Z',
    evtEndAt: '2030-10-01T01:00Z',
  },
  rule: {
    kind: 'DAILY',
    interval: 1,
    excludeWeekends: true,
    end: 'COUNT',
    count: 5,
  },
};
const check = (input: unknown) =>
  validate(plainToInstance(CreateRecurrenceDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
describe('recurrence API input', () => {
  it('accepts a typed rule and rejects omitted nested payloads', async () => {
    expect(await check(valid)).toHaveLength(0);
    expect(
      (await check({ requestId: valid.requestId })).length,
    ).toBeGreaterThan(0);
  });
  it('rejects unsupported fields, unbounded counts, and invalid weekday values', async () => {
    for (const rule of [
      { ...valid.rule, count: 100001 },
      { ...valid.rule, interval: 0 },
      { ...valid.rule, weekdays: [7] },
      { ...valid.rule, admin: true },
    ])
      expect((await check({ ...valid, rule })).length).toBeGreaterThan(0);
  });
});
