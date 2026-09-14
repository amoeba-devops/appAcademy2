import { BadRequestException } from '@nestjs/common';

/**
 * PLN-260914B — dashboard site dimension.
 * Sites are the three imweb brands; COMMON collects data with no site
 * attribution (phone / kakao / homepage inquiries, tenant-level manual input).
 */
export const DSH_SITES = ['TPI', 'TRINITY', 'SANTACROCE'] as const;
export type DshSite = (typeof DSH_SITES)[number];
export const DSH_SITE_COMMON = 'COMMON';
export type DshSiteOrCommon = DshSite | typeof DSH_SITE_COMMON;
export const DSH_SITE_ROWS: readonly DshSiteOrCommon[] = [
  ...DSH_SITES,
  DSH_SITE_COMMON,
];

export function isDshSite(v: unknown): v is DshSite {
  return typeof v === 'string' && (DSH_SITES as readonly string[]).includes(v);
}

/** Query-param parser: undefined | 'ALL' → undefined (tenant total); site code → site. */
export function parseSiteParam(raw?: string): DshSite | undefined {
  if (!raw || raw === 'ALL') return undefined;
  if (isDshSite(raw)) return raw;
  throw new BadRequestException(
    `site must be one of ALL, ${DSH_SITES.join(', ')}`,
  );
}

/** SQL fragment resolving an inquiry's site (alias `i` = amb_acm_csl_inquiry). */
export const INQ_SITE_SQL = `COALESCE(i.inq_site_override, i.inq_source_site, 'COMMON')`;
