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
    // imweb does not force HTTPS on this domain (verified 2026-09-11) — a
    // visitor on plain http would otherwise get 403 and lose the lead.
    origins: [
      'https://www.tpi.co.kr',
      'https://tpi.co.kr',
      'http://www.tpi.co.kr',
      'http://tpi.co.kr',
    ],
    purposeMap: {
      'MAP TEST 튜터링': 'MAP_TEST_TUTORING',
      'ISEE 튜터링': 'ISEE_TUTORING',
      '국제학교/외국인학교 입학 준비': 'INTL_SCHOOL_PREP',
      '맞춤형 GPA 관리': 'GPA_MGMT',
      '심화 수업(SSAT / Duolingo / TOEFL / PSAT / AP / IB / ACT / SAT)':
        'ADVANCED_COURSES',
    },
  },
  {
    code: 'TRINITY',
    displayName: '트리니티 웹 접수',
    // Live site is served on the connected domain trinityacademy.kr (imweb
    // "내 사이트" 2026-09-11), not only the imweb.me subdomain; no HTTPS force.
    origins: [
      'https://trinityacademy.imweb.me',
      'https://trinityacademy.kr',
      'https://www.trinityacademy.kr',
      'http://trinityacademy.kr',
      'http://www.trinityacademy.kr',
    ],
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

/**
 * Default keys = the keys embedded in the published imweb snippets
 * (docs/implementation/snippets/external-intake-form-*.html). They are site
 * identifiers, not secrets; set ACM_INTAKE_SITE_KEYS to rotate them.
 */
const DEFAULT_KEYS =
  'TPI:tpi-8c094fefd4fd2314,TRINITY:trinity-51c0c40bd70ba964,SANTACROCE:santacroce-93d05af5a571f33a';

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

/**
 * key → site code. ACM_INTAKE_SITE_KEYS overrides; unset OR empty falls back
 * to DEFAULT_KEYS (docker compose passes `${ACM_INTAKE_SITE_KEYS:-}`, i.e. ""
 * when the .env has no value — `??` alone would then reject every key).
 */
export function resolveSiteByKey(key: string): ExternalIntakeSite | undefined {
  const keys = parseKeys(
    process.env.ACM_INTAKE_SITE_KEYS?.trim() || DEFAULT_KEYS,
  );
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
