import type {
  ApplyPurpose,
  SourceSite,
} from '../infrastructure/typeorm/inquiry.typeorm-entity';

/**
 * REQ-260903G — external intake site registry (imweb 3 sites).
 *
 * The site key travels in the browser (imweb code-widget JS), so it is an
 * identifier, not a secret — spam defense is the throttle + honeypot +
 * origin allowlist, not the key. Rotate via ACM_INTAKE_SITE_KEYS:
 *   ACM_INTAKE_SITE_KEYS=TPI:<key>,TRINITY:<key>,SANTACROCE:<key>
 */
export interface ExternalIntakeSite {
  code: SourceSite;
  /** Display name — school_freetext fallback when the form has no school field. */
  displayName: string;
  /** Allowed browser Origins for this site's form. */
  origins: readonly string[];
  /** Form checkbox label → standard apply-purpose code. Unmapped labels go to applyPurposeOther verbatim. */
  purposeMap: Readonly<Record<string, ApplyPurpose>>;
}

const SITES: readonly ExternalIntakeSite[] = [
  {
    code: 'TPI',
    displayName: 'TPI 웹 접수',
    origins: ['https://www.tpi.co.kr', 'https://tpi.co.kr'],
    purposeMap: {
      'MAP TEST 튜터링': 'MAP_TEST_TUTORING',
      'ISEE 튜터링': 'ISEE_TUTORING',
      '국제학교/외국인학교 입학 준비': 'INTL_SCHOOL_PREP',
      '맞춤형 GPA 관리': 'GPA_MGMT',
    },
  },
  {
    code: 'TRINITY',
    displayName: '트리니티 웹 접수',
    origins: ['https://trinityacademy.imweb.me'],
    purposeMap: {
      '인가 국제학교 입학 준비': 'INTL_SCHOOL_PREP',
      '비인가 국제학교 입학 준비': 'INTL_SCHOOL_PREP',
      '외국인학교 입학 준비': 'INTL_SCHOOL_PREP',
    },
  },
  {
    code: 'SANTACROCE',
    displayName: '산타크로체 웹 접수',
    origins: ['https://santacroce.co.kr', 'https://www.santacroce.co.kr'],
    purposeMap: {
      '외국인·국제학교 컨설팅': 'INTL_SCHOOL_PREP',
    },
  },
] as const;

const DEFAULT_KEYS =
  'TPI:dev-intake-tpi,TRINITY:dev-intake-trinity,SANTACROCE:dev-intake-santacroce';

function parseKeys(raw: string): Map<string, SourceSite> {
  const map = new Map<string, SourceSite>();
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const code = pair.slice(0, idx).trim() as SourceSite;
    const key = pair.slice(idx + 1).trim();
    if (key && SITES.some((s) => s.code === code)) map.set(key, code);
  }
  return map;
}

/** key → site code (from ACM_INTAKE_SITE_KEYS; dev defaults otherwise). */
export function resolveSiteByKey(key: string): ExternalIntakeSite | undefined {
  const keys = parseKeys(process.env.ACM_INTAKE_SITE_KEYS ?? DEFAULT_KEYS);
  const code = keys.get(key);
  return code ? SITES.find((s) => s.code === code) : undefined;
}

/** All external form origins — appended to the CORS allowlist in main.ts. */
export function externalIntakeOrigins(): string[] {
  const extra = (process.env.ACM_INTAKE_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...SITES.flatMap((s) => [...s.origins]), ...extra])];
}
