import { SessionService } from './session.service';

// REQ-261119 — 반복 규칙 '월 15:00' 은 한국시간 월요일 15:00 (= UTC 06:00) 회차가 되어야 한다.
describe('SessionService.generateForClass (KST)', () => {
  afterEach(() => jest.useRealTimers());

  it('규칙 시각을 한국시간으로 해석하고 한국 날짜로 요일을 센다', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-15T16:00:00Z') }); // KST 11-16(월) 01:00
    const inserted: { scheduledAt: Date }[] = [];
    const sesRepo = {
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn(async (x: { scheduledAt: Date }) => inserted.push(x)),
    };
    const clsRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'c', status: 'ACTIVE', startedAt: '2026-11-01', endedAt: null }),
    };
    const recRepo = {
      find: jest.fn().mockResolvedValue([
        { dayOfWeek: 'MON', startTime: '15:00:00', durationMin: 60, effectiveFrom: '2026-11-01', effectiveTo: null, exceptions: [], defaultMode: 'ONLINE' },
      ]),
    };
    const svc = new SessionService(
      {} as never,
      sesRepo as never,
      clsRepo as never,
      recRepo as never,
      {} as never,
      { emit: jest.fn() } as never,
    );
    await svc.generateForClass('ent', 'c', 14);
    expect(inserted.map((s) => s.scheduledAt.toISOString())).toEqual([
      '2026-11-16T06:00:00.000Z',
      '2026-11-23T06:00:00.000Z',
    ]);
  });
});
