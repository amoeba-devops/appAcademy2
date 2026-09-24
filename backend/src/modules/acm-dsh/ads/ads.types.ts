export const PROVIDERS = [
  'META',
  'GOOGLE',
  'NAVER_SEARCH',
  'NAVER_GFA',
] as const;
export type Provider = (typeof PROVIDERS)[number];
export const SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;
export type Site = (typeof SITES)[number];
export interface AdsConfig {
  startDate: string;
  mappingEffectiveFrom?: string;
  defaultSite?: Site;
  campaigns: Record<string, Site>;
  managerId?: string;
  apiVersion?: string;
}
export interface AdsConnection {
  adc_id: string;
  ent_id: string;
  provider: Provider;
  account_id: string;
  name: string;
  credentials_enc: string | null;
  config: AdsConfig;
  revision: number;
  active: boolean;
  tested_revision: number | null;
  test_result: unknown;
  last_success_at: string | null;
  last_error: string | null;
}
export type Credentials = Record<string, string>;
export interface Spend {
  date: string;
  campaignId: string;
  campaignName: string;
  micros: string;
}
export interface Report {
  currency: string;
  timeZone: string;
  rows: Spend[];
  campaigns: Array<{ id: string; name: string }>;
}
export class AdsError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function micros(value: unknown): string {
  const s = String(value);
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new AdsError('INVALID_AMOUNT');
  const [whole, fraction = ''] = s.split('.');
  return (
    BigInt(whole) * 1000000n +
    BigInt(fraction.padEnd(6, '0'))
  ).toString();
}
export function days(from: string, to: string): string[] {
  for (const d of [from, to])
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !Number.isFinite(Date.parse(d)) ||
      new Date(d).toISOString().slice(0, 10) !== d
    )
      throw new AdsError('INVALID_DATE');
  if (from > to) throw new AdsError('INVALID_RANGE');
  const out: string[] = [];
  for (
    let d = from;
    d <= to;
    d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)
  ) {
    out.push(d);
    if (out.length > 31) throw new AdsError('RANGE_LIMIT');
  }
  return out;
}
