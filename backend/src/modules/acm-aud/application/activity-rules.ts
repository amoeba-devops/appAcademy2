import type { AuditMeta } from '../../acm-common/decorators/audit.decorator';

/** PLN-261022 — pure rules: which requests become activity-log rows and how they are labelled. */
export type ActivityAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'READ'
  | 'DOWNLOAD';
export interface ActivityDecision {
  action: ActivityAction;
  menu: string;
  actorKind: 'CONSOLE' | 'PORTAL';
  targetType: string | null;
  targetId: string | null;
}

/** Handled elsewhere (access log), public, or pure noise. Matched against the route path without `/api`. */
const EXCLUDE: RegExp[] = [
  /^\/(acm|portal)\/auth(\/|$)/,
  /^\/auth\/parent(\/|$)/,
  /^\/webhooks\//,
  /^\/web(\/|$)/,
  /^\/acm\/audit(\/|$)/,
  /^\/health/,
  /\/(read|read-all|seen|mark-read|typing|heartbeat|ping)$/,
  /\/push(-|\/|$)|\/subscriptions?(\/|$)/,
];

const PLURAL_TYPES: Record<string, string> = {
  students: 'student',
  parents: 'parent',
  teachers: 'teacher',
  staff: 'staff',
  users: 'user',
  inquiries: 'inquiry',
  classes: 'class',
  events: 'event',
  projects: 'project',
  items: 'item',
  issues: 'item',
  materials: 'material',
  posts: 'post',
  'map-applications': 'mapApply',
  bills: 'bill',
  questions: 'question',
  schools: 'school',
  tenants: 'tenant',
  invites: 'invite',
  'portal-accounts': 'portalAccount',
  attachments: 'attachment',
  sessions: 'session',
};

const SENSITIVE_KEY =
  /pass(word)?|token|secret|api_?key|private|phone|mobile|birth|resident|ssn|card|otp|pin$/i;

export function stripApi(path: string): string {
  const p = path.split('?')[0];
  return p.startsWith('/api/') ? p.slice(4) : p === '/api' ? '/' : p;
}

export function menuOf(path: string): string {
  const s = stripApi(path).split('/').filter(Boolean);
  if (s[0] === 'acm' && s[1] === 'admin') return 'config';
  if (s[0] === 'acm' || s[0] === 'admin' || s[0] === 'portal')
    return (s[1] ?? s[0]).slice(0, 30);
  if (s[0] === 'cal') return 'cal';
  return (s[0] ?? 'unknown').slice(0, 30);
}

export function isPortalPath(path: string): boolean {
  return /^\/(portal|my)(\/|$)/.test(stripApi(path));
}

/** Last `:param` of the route pattern and the literal segment just before it. */
export function lastParam(
  routePattern: string,
): { name: string; noun: string | null } | null {
  const segs = stripApi(routePattern).split('/').filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i--)
    if (segs[i].startsWith(':')) {
      const prev =
        segs
          .slice(0, i)
          .reverse()
          .find((x) => !x.startsWith(':')) ?? null;
      return { name: segs[i].slice(1), noun: prev };
    }
  return null;
}

export function typeOfNoun(noun: string | null | undefined): string | null {
  if (!noun) return null;
  return PLURAL_TYPES[noun] ?? null;
}

export function isExcluded(routePattern: string): boolean {
  const route = stripApi(routePattern);
  return EXCLUDE.some((r) => r.test(route));
}

export function decide(input: {
  method: string;
  routePattern: string;
  params: Record<string, string | string[] | undefined>;
  meta?: AuditMeta;
}): ActivityDecision | null {
  const method = input.method.toUpperCase();
  const route = stripApi(input.routePattern);
  if (input.meta?.skip) return null;
  if (EXCLUDE.some((r) => r.test(route))) return null;
  const actorKind = isPortalPath(route) ? 'PORTAL' : 'CONSOLE';
  let action: ActivityAction | null = input.meta?.action ?? null;
  if (!action) {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
      return null;
    if (method === 'DELETE') action = 'DELETE';
    else if (method === 'PUT' || method === 'PATCH') action = 'UPDATE';
    else {
      // POST: a sub-collection (…/:id/items) creates; a verb on an entity (…/:id/lock) updates.
      const segs = route.split('/').filter(Boolean);
      const last = segs.at(-1) ?? '';
      const hasParam = segs.some((x) => x.startsWith(':'));
      action =
        hasParam &&
        !last.startsWith(':') &&
        !PLURAL_TYPES[last] &&
        !last.endsWith('s')
          ? 'UPDATE'
          : 'CREATE';
    }
  }
  // Q-C — portal reads are not recorded (writes and downloads are).
  if (action === 'READ' && actorKind === 'PORTAL') return null;
  const lp = lastParam(route);
  const paramName = input.meta?.param ?? lp?.name;
  const raw = paramName ? input.params[paramName] : undefined;
  const targetId = (Array.isArray(raw) ? raw[0] : raw) ?? null;
  // No route param (e.g. POST /acm/std/students): the trailing collection names the type.
  const trailing = route.split('/').filter(Boolean).at(-1) ?? null;
  const targetType =
    input.meta?.target ?? typeOfNoun(lp ? lp.noun : trailing) ?? null;
  return {
    action,
    menu: menuOf(route),
    actorKind,
    targetType,
    targetId: targetId?.slice(0, 64) ?? null,
  };
}

/** Top-level body keys only — values are never recorded (Q-A); sensitive key names are masked. */
export function changedFields(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body as Record<string, unknown>).filter(
    (k) => k !== 'entId',
  );
  if (!keys.length) return null;
  const out = keys.map((k) => (SENSITIVE_KEY.test(k) ? '***' : k));
  const joined = [...new Set(out)].join(',');
  return joined.length > 500 ? `${joined.slice(0, 497)}...` : joined;
}

/** `{ id }`, `{ data: { id } }` or common `<prefix>Id`/`<prefix>_id` keys on the created object. */
export function createdId(body: unknown): string | null {
  const pick = (o: unknown): string | null => {
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    if (typeof r.id === 'string' || typeof r.id === 'number')
      return String(r.id);
    const k = Object.keys(r).find(
      (x) => /^[a-z]{2,4}(Id|_id)$/.test(x) && typeof r[x] === 'string',
    );
    return k ? String(r[k]) : null;
  };
  const b = body as { data?: unknown } | null;
  return (pick(b?.data) ?? pick(body))?.slice(0, 64) ?? null;
}

export function resultOf(status: number): 'SUCCESS' | 'FAILURE' | 'DENIED' {
  if (status < 400) return 'SUCCESS';
  if (status === 401 || status === 403) return 'DENIED';
  return 'FAILURE';
}

/** `attachment; filename="x.csv"; filename*=UTF-8''%EC…` → decoded file name. */
export function fileNameOf(disposition: unknown): string | null {
  if (typeof disposition !== 'string') return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try {
      return decodeURIComponent(star[1]).slice(0, 200);
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].slice(0, 200) : null;
}
