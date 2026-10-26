import {
  lifecycleRange,
  LifeEvent,
  LifeStudent,
} from './lifecycle-calculation';
const event = (
  kind: string,
  date: string,
  person = 'a',
  payload: LifeEvent['payload'] = {},
): LifeEvent => ({
  id: `${kind}-${date}-${person}`,
  person,
  subjectKind: 'STUDENT',
  subjectId: person,
  kind,
  date,
  site: 'TPI',
  createdAt: date,
  payload,
});
const range = (events: LifeEvent[], students: LifeStudent[] = []) =>
  lifecycleRange(events, students, '2026-09-01', '2026-09-03', '2026-09-02');
describe('Dashboard lifecycle definitions', () => {
  it('uses student start date without requiring a held session; future actuals remain unknown', () => {
    const r = range(
      [],
      [
        { id: 'a', site: 'TPI', start: '2026-09-02' },
        { id: 'b', site: 'TPI', start: '2026-08-30' },
      ],
    );
    expect(r.rows[1].values.cs_new_class.calculated).toBe(1);
    expect(r.members['2026-09-02'].cs_new_class).toEqual(['a']);
    expect(r.rows[2].values.cs_new_class.calculated).toBeNull();
  });
  it('counts coordination and confirmation on their own dates (class start does not matter)', () => {
    const r = range([
      event('SCHEDULE', '2026-09-01', 'a', { status: 'SCHEDULING' }),
      event('SCHEDULE', '2026-09-02', 'a', { status: 'SCHEDULED' }),
      event('FIRST_CLASS', '2026-09-02', 'a', { verified: true }),
    ]);
    expect(r.rows[0].values.cs_scheduling.calculated).toBe(1);
    expect(r.rows[1].values.cs_scheduling.calculated).toBe(0);
    expect(r.summary.cs_scheduled.calculated).toBe(1);
  });
  // FIX-261026 — 스케줄 조율/완료는 기록한 날짜 하루만 센다.
  it('counts a schedule record only on its own date, not on later days', () => {
    const r = range([
      event('SCHEDULE', '2026-09-01', 'a', {
        status: 'SCHEDULED',
        courseKey: 'math',
      }),
    ]);
    expect(r.rows[0].values.cs_scheduled.calculated).toBe(1);
    expect(r.rows[1].values.cs_scheduled.calculated).toBe(0);
    expect(r.summary.cs_scheduled.calculated).toBe(1); // period total = distinct people
  });
  it('counts both when coordination and confirmation happen the same day', () => {
    const r = range([
      event('SCHEDULE', '2026-09-01', 'a', {
        status: 'SCHEDULED',
        courseKey: 'math',
      }),
      event('SCHEDULE', '2026-09-01', 'a', {
        status: 'SCHEDULING',
        courseKey: 'english',
      }),
    ]);
    expect(r.summary.cs_scheduling.calculated).toBe(1);
    expect(r.summary.cs_scheduled.calculated).toBe(1);
  });
  it('includes pre-period payments and excludes after actual first class or refund', () => {
    const r = range([
      event('FIRST_PAYMENT', '2026-08-20', 'a', { verified: true }),
      event('FIRST_CLASS', '2026-09-02', 'a', { verified: true }),
      event('FIRST_PAYMENT', '2026-08-20', 'b', { verified: true }),
      event('PAYMENT_ENDED', '2026-09-02', 'b', { verified: true }),
      event('FIRST_PAYMENT', '2026-09-01', 'c', { verified: false }),
    ]);
    expect(r.rows[0].values.ops_new_st.calculated).toBe(2);
    expect(r.summary.ops_new_st.calculated).toBe(0);
  });
  it('counts repeat returns once per period instead of summing daily totals', () => {
    const r = range([
      event('RETURN', '2026-09-01', 'a', { verified: true }),
      event('RETURN', '2026-09-02', 'a', { verified: true }),
    ]);
    expect(
      r.rows.slice(0, 2).map((r) => r.values.ops_returning_st.calculated),
    ).toEqual([1, 1]);
    expect(r.summary.ops_returning_st.calculated).toBe(1);
  });
  it('filters site and flags unverified historical coverage', () => {
    const events = [
      event('REFERRAL', '2026-09-02', 'a', { verified: true }),
      event('FIRST_PAYMENT', '2026-09-02', 'a', { verified: true }),
    ];
    expect(range(events).summary.ops_referral_st).toMatchObject({
      calculated: 1,
      quality: 'PARTIAL',
    });
    expect(range(events).summary.ops_new_st.calculated).toBe(1);
    expect(
      lifecycleRange(
        events,
        [],
        '2026-09-01',
        '2026-09-02',
        '2026-09-02',
        'TRINITY',
      ).summary.ops_referral_st.calculated,
    ).toBe(0);
  });
  it('a later CLOSED does not erase an earlier day, and the same-day last record wins', () => {
    const later = range([
      event('SCHEDULE', '2026-09-01', 'a', { status: 'SCHEDULED' }),
      event('SCHEDULE', '2026-09-02', 'a', { status: 'CLOSED' }),
    ]);
    expect(later.rows[0].values.cs_scheduled.calculated).toBe(1);
    expect(later.rows[1].values.cs_scheduled.calculated).toBe(0);
    const sameDay = range([
      event('SCHEDULE', '2026-09-02', 'a', { status: 'SCHEDULED' }),
      {
        ...event('SCHEDULE', '2026-09-02', 'a', { status: 'CLOSED' }),
        id: 'closed',
        createdAt: '2026-09-02T09:00',
      },
    ]);
    expect(sameDay.rows[1].values.cs_scheduled.calculated).toBe(0);
  });
});
