import type { EntityManager } from 'typeorm';
import {
  monthBounds,
  resolveMonthlyStudents,
  siteMatches,
  studentEvidence,
  type MonthlyBill,
  type StudentEvidence,
} from './monthly-pay';
import type { Period } from '../../acm-dsh/application/operating-calculation';
export interface StatusEvidence {
  studentId: string;
  status: string;
  date: string | null;
  site: string | null;
  source: string;
  recorded: string;
}
export function statistics(
  month: string,
  site: string,
  students: StudentEvidence[],
  periods: Period[],
  history: StatusEvidence[],
  bills: MonthlyBill[],
) {
  const months = [-2, -1, 0].map((offset) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + offset);
    return d.toISOString().slice(0, 7);
  });
  const studentIds = new Set(students.map((s) => s.id));
  const events = history.filter((h) => studentIds.has(h.studentId));
  const population = months.map((m) => {
    const { start, next } = monthBounds(m);
    const roster = resolveMonthlyStudents(students, periods, m, site);
    const inMonth = (date: string | null) =>
      !!date && date >= start && date < next;
    const dated = events.filter(
      (h) => siteMatches(h.site, site) && inMonth(h.date),
    );
    const count = (status: string) =>
      new Set(dated.filter((h) => h.status === status).map((h) => h.studentId))
        .size;
    // Before tracking began a missing pause is unknown, never a fabricated zero.
    const incomplete = events.some(
      (h) =>
        siteMatches(h.site, site) &&
        (!h.date ||
          (h.source === 'BASELINE' && start <= h.recorded.slice(0, 10))),
    );
    const reviewIds = new Set(roster.filter((s) => s.review).map((s) => s.id));
    events
      .filter((h) => siteMatches(h.site, site) && !h.date)
      .forEach((h) => reviewIds.add(h.studentId));
    const newStudents = students.filter(
      (s) =>
        inMonth(s.admission) &&
        (site === 'ALL' ||
          periods.some(
            (p) =>
              p.subjectId === s.id &&
              !p.cancelled &&
              p.confirmed &&
              siteMatches(p.site, site) &&
              p.start === s.admission,
          ) ||
          (!periods.some((p) => p.subjectId === s.id && !p.cancelled) &&
            siteMatches(s.site, site))),
    );
    return {
      month: m,
      enrolled: roster.filter((s) => s.enrolled).length,
      newStudents: newStudents.length,
      paused: incomplete ? null : count('INACTIVE'),
      knownPaused: count('INACTIVE'),
      withdrawn: incomplete ? null : count('WITHDRAWN'),
      knownWithdrawn: count('WITHDRAWN'),
      historyIncomplete: incomplete,
      review: reviewIds.size,
    };
  });
  const collections = months.slice(1).map((m) => {
    const selected = bills.filter(
      (b) => b.month === m && siteMatches(b.site, site),
    );
    const eligible = selected.filter(
      (b) =>
        b.state !== 'CANCELED' &&
        b.state !== 'DRAFT' &&
        b.amount !== null &&
        (b.net || 0) > 0,
    );
    const paid = eligible.filter((b) => b.unpaid === 0).length;
    return {
      month: m,
      paid,
      unpaid: eligible.length - paid,
      total: eligible.length,
      drafts: selected.filter(
        (b) =>
          b.state !== 'CANCELED' && (b.amount === null || b.state === 'DRAFT'),
      ).length,
      canceled: selected.filter((b) => b.state === 'CANCELED').length,
      free: selected.filter(
        (b) =>
          b.state !== 'CANCELED' &&
          b.state !== 'DRAFT' &&
          b.amount !== null &&
          (b.net || 0) <= 0,
      ).length,
    };
  });
  return {
    month,
    site,
    population,
    collections,
    asOf: new Date().toISOString(),
  };
}
export async function topStatistics(
  m: EntityManager,
  ent: string,
  month: string,
  site: string,
  billSql: string,
) {
  const { students, periods } = await studentEvidence(m, ent);
  const history: StatusEvidence[] = await m.query(
    `SELECT std_id AS "studentId",ssh_status status,ssh_date::text date,ssh_site site,ssh_source source,created_at::text recorded FROM amb_acm_std_status_history WHERE ent_id=$1`,
    [ent],
  );
  const from = new Date(`${month}-01T00:00:00Z`);
  from.setUTCMonth(from.getUTCMonth() - 1);
  const bills: MonthlyBill[] = await m.query(
    `${billSql} AND b.pbl_month BETWEEN $2 AND $3`,
    [ent, from.toISOString().slice(0, 7), month],
  );
  return statistics(month, site, students, periods, history, bills);
}
