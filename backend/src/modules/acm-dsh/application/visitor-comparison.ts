import { BadRequestException } from '@nestjs/common';
import { DSH_SITES, type DshSite } from './dsh-site.util';
import type {
  VisitorObservation,
  VisitorComparisonResult,
  VisitorCoverage,
} from '../types/visitor-comparison';

export function visitorDate(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('유효한 날짜(YYYY-MM-DD)를 입력하세요.');
  return value;
}
export function visitorDays(from: string, to: string): string[] {
  visitorDate(from);
  visitorDate(to);
  const count = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
  if (count < 1 || count > 365)
    throw new BadRequestException('조회 기간은 1~365일이어야 합니다.');
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10),
  );
}

export function compareVisitors(
  from: string,
  to: string,
  site: DshSite | undefined,
  observations: VisitorObservation[],
): VisitorComparisonResult {
  const byKey = new Map(
    observations.map((o) => [`${o.date}:${o.site}:${o.source}`, o]),
  );
  const rows = visitorDays(from, to).flatMap((date) =>
    (site ? [site] : DSH_SITES).map((s) => {
      const imweb = byKey.get(`${date}:${s}:IMWEB`) ?? null;
      const ga4 = byKey.get(`${date}:${s}:GA4`) ?? null;
      const difference =
        imweb?.value != null && ga4?.value != null
          ? imweb.value - ga4.value
          : null;
      return {
        date,
        site: s,
        imweb,
        ga4,
        difference,
        differencePercent:
          difference !== null && ga4?.value
            ? (difference / ga4.value) * 100
            : null,
      };
    }),
  );
  function coverage(source: 'imweb' | 'ga4'): VisitorCoverage {
    const values = rows
      .map((r) => r[source])
      .filter((o): o is VisitorObservation => o?.value != null);
    // Property/stream may differ between sites by design. Metric/timezone may not.
    // Within a site, a definition change also prevents a homogeneous total.
    const conditions = new Set(values.map((o) => `${o.metric}:${o.timezone}`));
    const bySite = new Map<string, Set<string>>();
    for (const o of values) {
      const definitions = bySite.get(o.site) ?? new Set<string>();
      definitions.add(o.definition);
      bySite.set(o.site, definitions);
    }
    const mixedDefinition =
      conditions.size > 1 || [...bySite.values()].some((s) => s.size > 1);
    const sum = values.length ? values.reduce((n, o) => n + o.value!, 0) : null;
    return {
      value: values.length === rows.length && !mixedDefinition ? sum : null,
      observedSum: mixedDefinition ? null : sum,
      observed: values.length,
      expected: rows.length,
      mixedDefinition,
    };
  }
  return {
    from,
    to,
    site: site ?? 'ALL',
    rows,
    summary: { imweb: coverage('imweb'), ga4: coverage('ga4') },
  };
}
