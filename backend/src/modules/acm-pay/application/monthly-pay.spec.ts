import {
  monthBounds,
  resolveMonthlyStudents,
  monthlyRows,
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
    };
    expect(monthlyRows(people, [], '2026-10', 'ALL')[0].status).toBe('NONE');
    const draft = monthlyRows(people, [bill], '2026-10', 'ALL');
    expect(draft[0].net).toBeNull();
    expect(summarize(draft).rate).toBeNull();
    const free = monthlyRows(
      people,
      [{ ...bill, amount: 0, net: 0, unpaid: 0, state: 'ACTIVE' }],
      '2026-10',
      'ALL',
    );
    expect(free[0].status).toBe('FREE');
    expect(summarize(free).drafts).toBe(0);
  });
});
