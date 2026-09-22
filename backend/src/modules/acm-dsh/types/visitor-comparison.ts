import type { DshSite } from '../application/dsh-site.util';
export interface VisitorObservation {
  id: string;
  date: string;
  site: DshSite;
  source: 'IMWEB' | 'GA4';
  definition: string;
  metric: string;
  timezone: string;
  value: number | null;
  note: string;
  revision: number;
  updatedAt: string;
}
export interface VisitorComparisonRow {
  date: string;
  site: DshSite;
  imweb: VisitorObservation | null;
  ga4: VisitorObservation | null;
  difference: number | null;
  differencePercent: number | null;
}
export interface VisitorCoverage {
  value: number | null;
  observedSum: number | null;
  observed: number;
  expected: number;
  mixedDefinition: boolean;
}
export interface VisitorComparisonResult {
  from: string;
  to: string;
  site: DshSite | 'ALL';
  rows: VisitorComparisonRow[];
  summary: { imweb: VisitorCoverage; ga4: VisitorCoverage };
}
