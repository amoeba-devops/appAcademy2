export const OPS_ST = ['ops_new_st', 'ops_out_st', 'ops_count_st'] as const;
export const OPS_TC = ['ops_new_tc', 'ops_out_tc', 'ops_count_tc'] as const;
export const OPS_METRICS = [...OPS_ST, ...OPS_TC] as const;
export type OpsMetric = (typeof OPS_METRICS)[number];
export interface Period {
  id: string | null;
  kind: 'STUDENT' | 'TEACHER';
  subjectId: string | null;
  site: string | null;
  start: string | null;
  end: string | null;
  confirmed: boolean;
  revision: number;
  cancelled: boolean;
}
export interface ManualValue {
  date: string;
  site: string;
  metric: OpsMetric;
  value: number | null;
}
export interface OpsCell {
  calculated: number | null;
  manual: number | null;
  manualPresent: boolean;
  quality: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
}
const sites = ['TPI', 'TRINITY', 'SANTACROCE'];
export function calculateOperating(
  periods: Period[],
  manual: ManualValue[],
  from: string,
  to: string,
  site: string,
  today: string,
) {
  const actualThrough = to < today ? to : today;
  const metrics: OpsMetric[] = site === 'ALL' ? [...OPS_METRICS] : [...OPS_ST];
  const bySite = Object.fromEntries(
    sites.map((s) => [
      s,
      periods.filter(
        (p) =>
          p.kind === 'STUDENT' &&
          p.site === s &&
          p.confirmed &&
          !p.cancelled &&
          p.start,
      ),
    ]),
  );
  const students =
    site === 'ALL' ? sites.flatMap((s) => bySite[s]) : (bySite[site] ?? []);
  const teachers = periods.filter(
    (p) => p.kind === 'TEACHER' && p.confirmed && !p.cancelled && p.start,
  );
  const missingTeachers = periods.filter(
    (p) => p.kind === 'TEACHER' && !p.cancelled && (!p.confirmed || !p.start),
  ).length;
  const unclassified = periods.filter(
    (p) => p.kind === 'STUDENT' && !p.cancelled && !p.site,
  ).length;
  const unresolved = periods.filter(
    (p) =>
      p.kind === 'STUDENT' &&
      !p.cancelled &&
      sites.includes(p.site ?? '') &&
      (site === 'ALL' || p.site === site) &&
      (!p.confirmed || !p.start),
  ).length;
  const manualMap = new Map(
    manual
      .filter((m) => m.site === site)
      .map((m) => [`${m.date}:${m.metric}`, m.value]),
  );
  const counts = (ps: Period[], date: string) => [
    ps.filter((p) => p.start === date).length,
    ps.filter((p) => p.end === date).length,
    ps.filter((p) => p.start! <= date).length -
      ps.filter((p) => p.end && p.end <= date).length,
  ];
  const rows: { date: string; values: Partial<Record<OpsMetric, OpsCell>> }[] =
    [];
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 86400000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    // ALL is explicitly the sum of the three site series, including opening balances.
    const st =
      site === 'ALL'
        ? sites
            .map((s) => counts(bySite[s], date))
            .reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0])
        : counts(students, date);
    const tc = counts(teachers, date);
    const values: Partial<Record<OpsMetric, OpsCell>> = {};
    metrics.forEach((metric, i) => {
      const unavailable =
        date > actualThrough || (i >= 3 && missingTeachers > 0);
      const m = manualMap.get(`${date}:${metric}`) ?? null;
      values[metric] = {
        calculated: unavailable ? null : i < 3 ? st[i] : tc[i - 3],
        manual: m,
        manualPresent: m !== null,
        quality: unavailable
          ? 'UNAVAILABLE'
          : i < 3 && unresolved > 0
            ? 'PARTIAL'
            : 'COMPLETE',
      };
    });
    rows.push({ date, values });
  }
  const observed = rows.filter((r) => r.date <= actualThrough);
  const summary: Partial<Record<OpsMetric, OpsCell & { manualDays: number }>> =
    {};
  metrics.forEach((metric) => {
    const cells = observed.map((r) => r.values[metric]!);
    const last = cells.at(-1);
    const snapshot = metric.includes('count');
    const valid = cells.filter((c) => c.calculated !== null);
    const manuals = cells.filter((c) => c.manualPresent);
    summary[metric] = {
      calculated: snapshot
        ? (last?.calculated ?? null)
        : valid.length
          ? valid.reduce((n, c) => n + c.calculated!, 0)
          : null,
      manual: snapshot
        ? (last?.manual ?? null)
        : manuals.length
          ? manuals.reduce((n, c) => n + c.manual!, 0)
          : null,
      manualPresent: snapshot
        ? (last?.manualPresent ?? false)
        : manuals.length > 0,
      quality:
        valid.length === 0
          ? 'UNAVAILABLE'
          : cells.some((c) => c.quality !== 'COMPLETE')
            ? 'PARTIAL'
            : 'COMPLETE',
      manualDays: manuals.length,
    };
  });
  const prev = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  return {
    definitionVersion: 'operating-period-v1',
    site,
    from,
    to,
    actualThrough,
    metrics,
    rows,
    summary,
    openingBalance: {
      students: counts(students, prev)[2],
      teachers: missingTeachers ? null : counts(teachers, prev)[2],
    },
    quality: { unclassified, unresolved, missingTeachers },
  };
}
