import { statistics, type StatusEvidence } from './top-statistics';
import type { MonthlyBill } from './monthly-pay';
const student = {
  id: 'a',
  name: 'A',
  site: 'TPI',
  grade: null,
  status: 'ACTIVE',
  admission: '2026-09-01',
};
const bill: MonthlyBill = {
  id: 'b',
  studentId: 'a',
  studentName: 'A',
  site: 'TPI',
  grade: null,
  month: '2026-10',
  amount: 100,
  net: 100,
  received: 100,
  unpaid: 0,
  state: 'ACTIVE',
};
const event: StatusEvidence = {
  studentId: 'a',
  status: 'INACTIVE',
  date: '2026-10-01',
  site: 'TPI',
  source: 'CHANGE',
  recorded: '2026-10-01',
};
describe('top payment statistics', () => {
  it('counts bills, including partial payments and refunded balances, excluding drafts/canceled/zero', () => {
    const bs = [
      bill,
      { ...bill, id: 'partial', received: 50, unpaid: 50 },
      { ...bill, id: 'refunded', received: 0, unpaid: 100 },
      {
        ...bill,
        id: 'draft',
        state: 'DRAFT',
        amount: null,
        net: null,
        unpaid: null,
      },
      { ...bill, id: 'cancel', state: 'CANCELED' },
      { ...bill, id: 'zero', net: 0 },
      { ...bill, id: 'other', site: 'TRINITY' },
    ];
    expect(
      statistics('2026-10', 'TPI', [student], [], [], bs).collections[1],
    ).toEqual({
      month: '2026-10',
      paid: 1,
      unpaid: 2,
      total: 3,
      drafts: 1,
      canceled: 1,
      free: 1,
    });
  });
  it('keeps empty and draft-only months empty, rather than 100% paid', () => {
    expect(
      statistics(
        '2026-10',
        'ALL',
        [],
        [],
        [],
        [{ ...bill, amount: null, state: 'DRAFT' }],
      ).collections[1].total,
    ).toBe(0);
  });
  it('rolls across year boundaries and does not count returns as new admissions', () => {
    const r = statistics(
      '2027-01',
      'ALL',
      [student],
      [],
      [{ ...event, status: 'ACTIVE', date: '2027-01-02' }],
      [],
    );
    expect(r.population.map((p) => p.month)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    expect(r.population[2].newStudents).toBe(0);
  });
  it('deduplicates repeated pauses by student, uses event site, and excludes unrelated students', () => {
    const r = statistics(
      '2026-10',
      'TPI',
      [student],
      [],
      [
        event,
        { ...event, date: '2026-10-02' },
        { ...event, studentId: 'other' },
        { ...event, site: 'TRINITY' },
      ],
      [],
    );
    expect(r.population[2].paused).toBe(1);
    expect(
      statistics('2026-10', 'TRINITY', [student], [], [event], []).population[2]
        .paused,
    ).toBe(0);
  });
  it('preserves unknown pause history and surfaces date review instead of zero', () => {
    const r = statistics(
      '2026-10',
      'ALL',
      [student],
      [],
      [{ ...event, date: null, source: 'BASELINE' }],
      [],
    );
    expect(r.population[2]).toMatchObject({
      paused: null,
      knownPaused: 0,
      review: 1,
      historyIncomplete: true,
    });
  });
  it('does not use operating period ends as withdrawals', () => {
    const r = statistics(
      '2026-10',
      'ALL',
      [student],
      [
        {
          id: 'p',
          kind: 'STUDENT',
          subjectId: 'a',
          site: 'TPI',
          start: '2026-09-01',
          end: '2026-10-10',
          confirmed: true,
          cancelled: false,
          revision: 1,
        },
      ],
      [],
      [],
    );
    expect(r.population[2].withdrawn).toBe(0);
    expect(r.population[2].enrolled).toBe(1);
  });
  it('marks pre-tracking history incomplete even if baseline admission date is known', () => {
    expect(
      statistics(
        '2026-10',
        'ALL',
        [student],
        [],
        [
          {
            ...event,
            status: 'ACTIVE',
            source: 'BASELINE',
            date: '2026-09-01',
            recorded: '2026-10-03',
          },
        ],
        [],
      ).population[2].paused,
    ).toBeNull();
  });
});
