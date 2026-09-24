export const AD_PROVIDERS = [
  "META",
  "GOOGLE",
  "NAVER_SEARCH",
  "NAVER_GFA",
] as const;
export type AdProvider = (typeof AD_PROVIDERS)[number];
export const AD_SITES = ["TPI", "TRINITY", "SANTACROCE"] as const;
export type AdSite = (typeof AD_SITES)[number];
export interface AdConnection {
  adc_id: string;
  provider: AdProvider;
  account_id: string;
  name: string;
  revision: number;
  active: boolean;
  credentialsSet: boolean;
  config: {
    startDate: string;
    mappingEffectiveFrom?: string;
    defaultSite?: AdSite;
    campaigns: Record<string, AdSite>;
    managerId?: string;
  };
  tested_revision: number | null;
  test_result: {
    ok: boolean;
    code?: string;
    unmapped?: number;
    campaigns?: Array<{ id: string; name: string }>;
    totalMicros?: string;
  } | null;
  last_success_at: string | null;
  last_error: string | null;
}
export interface AdRun {
  adr_id: string;
  from_date: string;
  to_date: string;
  status: string;
  error_code: string | null;
  created_at: string;
  result: { rows?: number; unmapped?: number };
}
