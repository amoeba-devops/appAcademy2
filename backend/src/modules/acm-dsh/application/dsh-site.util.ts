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

/**
 * 요구 260914H — 삭제된 상담은 통계·대시보드에서 제외한다.
 *
 * 상담은 소프트 삭제(`deleted_at`)이고 하위 행(등록·전환·데모수업·MAP)에는
 * 별도 삭제 표시가 없다. 그래서 상담을 지워도 파생 지표는 그대로 남는다.
 * 하위 테이블에서 집계할 때 이 EXISTS 로 부모 상담의 생존을 확인한다.
 *
 * 사용하는 쿼리는 하위 테이블을 별칭 `e` 로 두고 `inq_id` 를 가져야 한다.
 */
export const NOT_DELETED_INQ = `EXISTS (
  SELECT 1 FROM amb_acm_csl_inquiry i
   WHERE i.inq_id = e.inq_id AND i.deleted_at IS NULL)`;
