import {
  monthBounds,
  resolveMonthlyStudents,
  monthlyRows,
  applyMonthNotes,
  summarize,
  type MonthlyBill,
} from './monthly-pay';
import type { Period } from '../../acm-dsh/application/operating-calculation';
const student = {
  id: 'a',
  name: 'Student',
  site: 'TPI',
  grade: null,
  status: 'ACTIVE',
  admission: '2026-09-01',
};
const period: Period = {
  id: 'p',
  kind: 'STUDENT',
  subjectId: 'a',
  site: 'TPI',
  start: '2026-10-01',
  end: null,
  confirmed: true,
  revision: 1,
  cancelled: false,
};
describe('monthly payment membership and aggregation', () => {
  it('uses calendar boundaries including leap years', () => {
    expect(monthBounds('2028-02')).toEqual({
      start: '2028-02-01',
      next: '2028-03-01',
    });
    expect(monthBounds('2026-12').next).toBe('2027-01-01');
  });
  it('does not resurrect explicitly canceled periods', () => {
    const [r] = resolveMonthlyStudents(
      [student],
      [{ ...period, cancelled: true }],
      '2026-10',
    );
    expect(r.enrolled).toBe(false);
  });
  it('separates unresolved withdrawal from proven enrollment', () => {
    const [r] = resolveMonthlyStudents(
      [{ ...student, status: 'WITHDRAWN' }],
      [period],
      '2026-10',
    );
    expect(r.enrolled).toBe(false);
    expect(r.review).toBe(true);
  });
  it('does not infer historical enrollment without an admission date', () => {
    const [r] = resolveMonthlyStudents(
      [{ ...student, admission: null }],
      [period],
      '2026-10',
    );
    expect(r.enrolled).toBe(false);
    expect(r.review).toBe(true);
  });
  it('recognizes unassigned enrollment without adopting current site', () => {
    const [r] = resolveMonthlyStudents(
      [student],
      [{ ...period, site: null }],
      '2026-10',
      'UNASSIGNED',
    );
    expect(r.enrolled).toBe(true);
    expect(r.periods[0].site).toBeNull();
  });
  it('leaves unassigned enrollment out of all sites (REQ-261102)', () => {
    const [r] = resolveMonthlyStudents(
      [{ ...student, site: null }],
      [{ ...period, site: null }],
      '2026-10',
    );
    expect(r.enrolled).toBe(false);
  });
  it('flags overlapping evidence', () => {
    const [r] = resolveMonthlyStudents(
      [student],
      [period, { ...period, id: 'q', site: 'TRINITY', start: '2026-10-10' }],
      '2026-10',
    );
    expect(r.review).toBe(true);
  });
  it('distinguishes draft-only, absent and zero-value bills', () => {
    const people = resolveMonthlyStudents([student], [period], '2026-10');
    const bill: MonthlyBill = {
      id: 'b',
      studentId: 'a',
      studentName: 'Student',
      site: 'TPI',
      grade: null,
      month: '2026-10',
      amount: null,
      net: null,
      received: 0,
      unpaid: null,
      state: 'DRAFT',
      version: 1,
      discount: 0,
      due: null,
      title: '10월 수업료',
      memo: '',
    };
    const none = monthlyRows(people, [], '2026-10', 'ALL');
    expect(none[0].status).toBe('NONE');
    expect(none[0].bill).toBeNull();
    const draft = monthlyRows(people, [bill], '2026-10', 'ALL');
    expect(draft[0].net).toBeNull();
    // REQ-261027B — the only bill is exposed for inline amount entry.
    expect(draft[0].bill).toMatchObject({ id: 'b', version: 1, amount: null });
    // REQ-261027C — row sums for the list columns.
    const two = monthlyRows(
      people,
      [
        {
          ...bill,
          amount: 300,
          discount: 20,
          net: 280,
          received: 100,
          unpaid: 180,
          refunded: 10,
          state: 'ACTIVE',
        },
        {
          ...bill,
          id: 'c',
          amount: 50,
          discount: 0,
          net: 50,
          received: 50,
          unpaid: 0,
          refunded: 0,
          state: 'ACTIVE',
        },
      ],
      '2026-10',
      'ALL',
    )[0];
    expect(two).toMatchObject({
      amount: 350,
      discount: 20,
      received: 150,
      unpaid: 180,
      refunded: 10,
    });
    // REQ-261112 — 합계 줄: 납부한 학생 수·청구액·할인액·실납부·미납·환불.
    expect(summarize([two, none[0]])).toMatchObject({
      count: 2,
      paidStudents: 1,
      amount: 350,
      discount: 20,
      received: 150,
      unpaid: 180,
      refunded: 10,
    });
    expect(none[0]).toMatchObject({
      amount: null,
      discount: null,
      refunded: null,
    });
    expect(
      monthlyRows(people, [bill, { ...bill, id: 'c' }], '2026-10', 'ALL')[0]
        .bill,
    ).toBeNull();
    expect(summarize(draft).rate).toBeNull();
    const free = monthlyRows(
      people,
      [{ ...bill, amount: 0, net: 0, unpaid: 0, state: 'ACTIVE' }],
      '2026-10',
      'ALL',
    );
    expect(free[0].status).toBe('FREE');
    expect(summarize(free).drafts).toBe(0);
    // REQ-261112C — 미납 상위 경과일: 미납이 남은 확정 청구의 가장 이른 납부기한.
    const due = monthlyRows(
      people,
      [
        {
          ...bill,
          amount: 100,
          net: 100,
          unpaid: 100,
          due: '2026-10-20',
          state: 'ACTIVE',
        },
        {
          ...bill,
          id: 'c',
          amount: 100,
          net: 100,
          unpaid: 50,
          due: '2026-10-10',
          state: 'ACTIVE',
        },
        {
          ...bill,
          id: 'd',
          amount: 100,
          net: 100,
          unpaid: 0,
          due: '2026-10-01',
          state: 'ACTIVE',
        },
      ],
      '2026-10',
      'ALL',
    );
    expect(due[0].oldestUnpaidDue).toBe('2026-10-10');
    expect(free[0].oldestUnpaidDue).toBeNull();
  });
  it('attaches month memo and exclusion, never hiding a student with bills (REQ-261114)', () => {
    const people = resolveMonthlyStudents([student], [period], '2026-10');
    const plain = applyMonthNotes(
      monthlyRows(people, [], '2026-10', 'ALL'),
      [],
    );
    expect(plain[0]).toMatchObject({ note: null, excluded: false });
    const noted = applyMonthNotes(monthlyRows(people, [], '2026-10', 'ALL'), [
      { studentId: 'a', excluded: true, memo: '휴원' },
    ]);
    expect(noted[0]).toMatchObject({ note: '휴원', excluded: true });
    const bill: MonthlyBill = {
      id: 'b',
      studentId: 'a',
      studentName: 'Student',
      site: 'TPI',
      grade: null,
      month: '2026-10',
      amount: 100,
      net: 100,
      received: 0,
      unpaid: 100,
      state: 'ACTIVE',
      version: 1,
      discount: 0,
      due: null,
      title: '10월 수업료',
      memo: '',
    };
    const billed = applyMonthNotes(
      monthlyRows(people, [bill], '2026-10', 'ALL'),
      [{ studentId: 'a', excluded: true, memo: null }],
    );
    expect(billed[0].excluded).toBe(false);
  });
  it('lists a student without admission from the class start date, flagged for review (REQ-261114B)', () => {
    const fresh = { ...student, admission: null, start: '2026-11-16' };
    const fallback: Period = { ...period, id: null as unknown as string, start: '2026-11-16' };
    const [nov] = resolveMonthlyStudents([fresh], [fallback], '2026-11');
    expect(nov.enrolled).toBe(true);
    expect(nov.review).toBe(true);
    const [oct] = resolveMonthlyStudents([fresh], [fallback], '2026-10');
    expect(oct.enrolled).toBe(false);
    const [none] = resolveMonthlyStudents(
      [{ ...fresh, start: null }],
      [{ ...fallback, start: null }],
      '2026-11',
    );
    expect(none.enrolled).toBe(false);
  });
});
