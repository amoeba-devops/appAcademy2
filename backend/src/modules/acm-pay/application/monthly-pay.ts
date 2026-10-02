import { EntityManager } from 'typeorm';
import { OPERATING_PERIOD_SQL } from '../../acm-dsh/application/operating.service';
import {
  studentEnrollmentIntervals,
  type Period,
} from '../../acm-dsh/application/operating-calculation';
import type { MonthlyPayQuery } from './dto/collections.dto';

export interface MonthlyStudent {
  id: string;
  name: string;
  site: string | null;
  grade: string | null;
  enrolled: boolean;
  review: boolean;
  periods: { site: string | null; start: string | null; end: string | null }[];
}
export const siteMatches = (actual: string | null, site = 'ALL') =>
  site === 'ALL' || (actual || 'UNASSIGNED') === site;
export function monthBounds(month: string) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number, 1));
  return { start: `${month}-01`, next: date.toISOString().slice(0, 10) };
}
interface StudentEvidence {
  id: string;
  name: string;
  site: string | null;
  grade: string | null;
  status: string;
  admission: string | null;
}
export function resolveMonthlyStudents(
  students: StudentEvidence[],
  periods: Period[],
  month: string,
  site = 'ALL',
): MonthlyStudent[] {
  const { start, next } = monthBounds(month);
  const byStudent = new Map<string, Period[]>();
  for (const p of periods)
    if (p.kind === 'STUDENT' && p.subjectId) {
      const list = byStudent.get(p.subjectId) || [];
      list.push(p);
      byStudent.set(p.subjectId, list);
    }
  return students.map((s) => {
    const history = byStudent.get(s.id) || [];
    const relevant = history.filter(
      (p) => !p.cancelled && siteMatches(p.site, site),
    );
    const valid = history.map((p) =>
      s.status !== 'ACTIVE' && !p.end ? { ...p, confirmed: false } : p,
    );
    const intervals = studentEnrollmentIntervals(
      valid,
      [{ subjectId: s.id, site: s.site, date: s.admission }],
      ['TPI', 'TRINITY', 'SANTACROCE', null],
    );
    const overlap = intervals.filter(
      (p) =>
        (!p.end || p.end > p.start) &&
        siteMatches(p.site, site) &&
        p.start < next &&
        (!p.end || p.end > start),
    );
    const conflict = intervals.some((a, i) =>
      intervals.some(
        (b, j) =>
          i < j &&
          a.start < (b.end || '9999-12-31') &&
          b.start < (a.end || '9999-12-31'),
      ),
    );
    const review =
      (conflict && intervals.some((p) => siteMatches(p.site, site))) ||
      (!s.admission && (relevant.length > 0 || siteMatches(s.site, site))) ||
      relevant.some(
        (p) =>
          !p.confirmed ||
          (!p.start && !s.admission) ||
          (p.end !== null && p.start !== null && p.end < p.start) ||
          (s.status !== 'ACTIVE' && !p.end),
      );
    return {
      id: s.id,
      name: s.name,
      site: s.site,
      grade: s.grade,
      enrolled: overlap.length > 0,
      review,
      periods: overlap.map((p) => ({
        site: p.site,
        start: p.start,
        end: p.end,
      })),
    };
  });
}
async function studentEvidence(m: EntityManager, ent: string) {
  const periods: Period[] = await m.query(
    `${OPERATING_PERIOD_SQL} SELECT * FROM periods WHERE kind='STUDENT'`,
    [ent],
  );
  const students: StudentEvidence[] = await m.query(
    `SELECT std_id id,std_name name,std_site site,std_grade grade,std_status status,std_admission_date::text admission FROM amb_acm_std_student WHERE ent_id=$1 AND deleted_at IS NULL`,
    [ent],
  );
  return { periods, students };
}
export async function monthlyStudents(
  m: EntityManager,
  ent: string,
  month: string,
  site = 'ALL',
): Promise<MonthlyStudent[]> {
  const evidence = await studentEvidence(m, ent);
  return resolveMonthlyStudents(
    evidence.students,
    evidence.periods,
    month,
    site,
  );
}
export interface MonthlyBill {
  id: string;
  studentId: string;
  studentName: string;
  grade: string | null;
  site: string | null;
  month: string;
  amount: number | null;
  net: number | null;
  received: number;
  unpaid: number | null;
  state: string;
}
export interface MonthlyRow extends MonthlyStudent {
  billIds: string[];
  billCount: number;
  drafts: number;
  net: number | null;
  received: number | null;
  unpaid: number | null;
  status: string;
}
export function monthlyRows(
  students: MonthlyStudent[],
  bills: MonthlyBill[],
  month: string,
  site: string,
): MonthlyRow[] {
  const grouped = new Map<string, MonthlyBill[]>();
  const people = new Map(students.map((s) => [s.id, s]));
  for (const b of bills) {
    if (
      b.month !== month ||
      !siteMatches(b.site, site) ||
      b.state === 'CANCELED'
    )
      continue;
    const group = grouped.get(b.studentId) || [];
    group.push(b);
    grouped.set(b.studentId, group);
    if (!people.has(b.studentId))
      people.set(b.studentId, {
        id: b.studentId,
        name: b.studentName,
        grade: b.grade,
        site: b.site,
        enrolled: false,
        review: false,
        periods: [],
      });
  }
  return [...people.values()].map((s) => {
    const bs = grouped.get(s.id) || [],
      fixed = bs.filter((b) => b.amount !== null);
    const sum = (key: 'net' | 'received' | 'unpaid') =>
      fixed.length ? fixed.reduce((n, b) => n + (b[key] || 0), 0) : null;
    const net = sum('net'),
      received = sum('received'),
      unpaid = sum('unpaid'),
      drafts = bs.length - fixed.length;
    const status = !bs.length
      ? 'NONE'
      : !fixed.length
        ? 'DRAFT'
        : unpaid! > 0
          ? received! > 0
            ? 'PARTIAL'
            : 'UNPAID'
          : net === 0
            ? 'FREE'
            : 'PAID';
    return {
      ...s,
      billIds: bs.map((b) => b.id),
      billCount: bs.length,
      drafts,
      net,
      received,
      unpaid,
      status,
    };
  });
}
export function summarize(rows: MonthlyRow[]) {
  const net = rows.reduce((n, r) => n + (r.net || 0), 0),
    received = rows.reduce((n, r) => n + (r.received || 0), 0);
  return {
    count: rows.length,
    enrolled: rows.filter((r) => r.enrolled).length,
    review: rows.filter((r) => r.review).length,
    missing: rows.filter((r) => !r.billCount).length,
    draftStudents: rows.filter((r) => r.drafts > 0).length,
    drafts: rows.reduce((n, r) => n + r.drafts, 0),
    billed: rows.filter((r) => r.net !== null).length,
    unpaidStudents: rows.filter((r) => (r.unpaid || 0) > 0).length,
    net,
    received,
    unpaid: rows.reduce((n, r) => n + (r.unpaid || 0), 0),
    rate: net > 0 ? (received / net) * 100 : null,
  };
}
export async function monthlyPay(
  m: EntityManager,
  ent: string,
  q: MonthlyPayQuery,
  billSql: string,
  exportAll = false,
) {
  const site = q.site || 'ALL',
    { start, next } = monthBounds(q.month);
  const first = new Date(`${start}T00:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() - 11);
  const from = first.toISOString().slice(0, 7);
  const bills: MonthlyBill[] = await m.query(
    `${billSql} AND b.pbl_month BETWEEN $2 AND $3 AND b.pbl_status<>'CANCELED'`,
    [ent, from, q.month],
  );
  const evidence = await studentEvidence(m, ent);
  const students = resolveMonthlyStudents(
    evidence.students,
    evidence.periods,
    q.month,
    site,
  );
  const all = monthlyRows(students, bills, q.month, site);
  const scope = (rows: MonthlyRow[]) =>
    rows.filter((r) =>
      q.scope === 'REVIEW'
        ? r.review
        : q.scope === 'ALL'
          ? r.enrolled || r.review || r.billCount > 0
          : r.enrolled,
    );
  const search = (rows: MonthlyRow[]) =>
    rows.filter(
      (r) =>
        !q.q || r.name.toLocaleLowerCase().includes(q.q.toLocaleLowerCase()),
    );
  const scoped = search(scope(all));
  const filtered = scoped.filter(
    (r) =>
      !q.status ||
      (q.status === 'DRAFT'
        ? r.drafts > 0
        : q.status === 'UNPAID'
          ? (r.unpaid || 0) > 0
          : q.status === 'FINALIZED'
            ? r.net !== null
            : r.status === q.status),
  );
  filtered.sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
  const cash: {
    month: string;
    site: string | null;
    paid: number;
    refunded: number;
    received: number;
  }[] = await m.query(
    `SELECT to_char(c.pcl_date,'YYYY-MM') AS month,b.pbl_site site,
    sum(CASE WHEN c.pcl_type='PAYMENT' THEN c.pcl_amount ELSE 0 END)::float8 paid,
    sum(CASE WHEN c.pcl_type<>'PAYMENT' THEN c.pcl_amount ELSE 0 END)::float8 refunded,
    sum(CASE WHEN c.pcl_type='PAYMENT' THEN c.pcl_amount ELSE -c.pcl_amount END)::float8 received
    FROM amb_acm_pay_collection c JOIN amb_acm_pay_bill b ON b.ent_id=c.ent_id AND b.pbl_id=c.pbl_id
    WHERE c.ent_id=$1 AND c.pcl_date>=$2::date AND c.pcl_date<$3::date GROUP BY 1,2`,
    [ent, `${from}-01`, next],
  );
  const cashSum = (month: string, s: string) =>
    cash
      .filter((c) => c.month === month && siteMatches(c.site, s))
      .reduce(
        (n, c) => ({
          paid: n.paid + c.paid,
          refunded: n.refunded + c.refunded,
          received: n.received + c.received,
        }),
        { paid: 0, refunded: 0, received: 0 },
      );
  const trend = [];
  for (let i = 0; i < 12; i++) {
    const date = new Date(first);
    date.setUTCMonth(date.getUTCMonth() + i);
    const month = date.toISOString().slice(0, 7);
    const selected = bills.filter(
      (b) =>
        b.month === month && siteMatches(b.site, site) && b.amount !== null,
    );
    trend.push({
      month,
      net: selected.reduce((n, b) => n + (b.net || 0), 0),
      received: selected.reduce((n, b) => n + b.received, 0),
      unpaid: selected.reduce((n, b) => n + (b.unpaid || 0), 0),
      cash: cashSum(month, site),
    });
  }
  const sites = [];
  for (const s of ['TPI', 'TRINITY', 'SANTACROCE', 'UNASSIGNED']) {
    const roster = resolveMonthlyStudents(
      evidence.students,
      evidence.periods,
      q.month,
      s,
    );
    const rows = monthlyRows(roster, bills, q.month, s);
    sites.push({
      site: s,
      summary: summarize(rows.filter((r) => r.enrolled)),
      ledger: summarize(rows.filter((r) => r.billCount > 0)),
      cash: cashSum(q.month, s),
    });
  }
  const page = q.page || 1;
  return {
    month: q.month,
    site,
    scope: q.scope || 'ENROLLED',
    currency: 'KRW',
    asOf: new Date().toISOString(),
    items: exportAll ? filtered : filtered.slice((page - 1) * 50, page * 50),
    total: filtered.length,
    page,
    summary: summarize(filtered),
    reviewCount: all.filter((r) => r.review).length,
    ledger: summarize(all.filter((r) => r.billCount > 0)),
    cash: cashSum(q.month, site),
    trend,
    sites,
    topUnpaid: scoped
      .filter((r) => (r.unpaid || 0) > 0)
      .sort((a, b) => (b.unpaid || 0) - (a.unpaid || 0))
      .slice(0, 10),
  };
}
