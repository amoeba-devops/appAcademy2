import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * REQ-260903 — 테넌트 타임존 유틸 (라이브러리 미도입, Intl 기반).
 *
 * 원칙: 저장은 항상 UTC ISO, 표시·입력은 테넌트 TZ 벽시계.
 * 기존 date-utils 의 로컬 산술을 재사용하기 위해 "시프트 기법"을 쓴다 —
 * toZonedShift(d, tz) 는 로컬 필드가 tz 벽시계와 같은 Date 를 만들고,
 * fromZonedShift 가 역변환한다. DST 지역도 2-pass 오프셋 보정으로 안전.
 */
export const DEFAULT_TZ = 'Asia/Seoul';

export interface WallClock {
  y: number;
  m: number; // 1-12
  d: number;
  hh: number;
  mm: number;
  ss: number;
}

const partFmtCache = new Map<string, Intl.DateTimeFormat>();

function partFmt(tz: string): Intl.DateTimeFormat {
  let f = partFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partFmtCache.set(tz, f);
  }
  return f;
}

/** UTC 시각의 tz 벽시계 파츠. */
export function wallClock(date: Date, tz: string): WallClock {
  const parts = partFmt(tz).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    hh: get('hour'),
    mm: get('minute'),
    ss: get('second'),
  };
}

/** 해당 시각의 tz UTC 오프셋(ms). UTC+9 → +9h. */
function tzOffsetMs(date: Date, tz: string): number {
  const wc = wallClock(date, tz);
  const asUtc = Date.UTC(wc.y, wc.m - 1, wc.d, wc.hh, wc.mm, wc.ss);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** tz 벽시계 → UTC Date (DST 안전 2-pass). */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  tz: string,
  ss = 0,
): Date {
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss);
  let ts = utcGuess - tzOffsetMs(new Date(utcGuess), tz);
  ts = utcGuess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** UTC 시각 → 로컬 필드가 tz 벽시계와 일치하는 "시프트된" Date. */
export function toZonedShift(date: Date, tz: string): Date {
  const wc = wallClock(date, tz);
  return new Date(wc.y, wc.m - 1, wc.d, wc.hh, wc.mm, wc.ss);
}

/** 시프트된 Date(로컬 필드 = tz 벽시계) → 실제 UTC Date. */
export function fromZonedShift(shifted: Date, tz: string): Date {
  return zonedToUtc(
    shifted.getFullYear(),
    shifted.getMonth() + 1,
    shifted.getDate(),
    shifted.getHours(),
    shifted.getMinutes(),
    tz,
    shifted.getSeconds(),
  );
}

/** 현재 시각의 tz 기준 yyyy-mm-dd. */
export function todayYmd(tz: string, base: Date = new Date()): string {
  const wc = wallClock(base, tz);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${wc.y}-${p2(wc.m)}-${p2(wc.d)}`;
}

/** REQ-260903 — 테넌트 타임존 조회 (fail-open: Asia/Seoul). */
export function useTenantTz(): string {
  const { data } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () =>
      (await apiClient.get<{ timezone: string }>('/acm/me/tenant-settings')).data,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  return data?.timezone || DEFAULT_TZ;
}

// ── REQ-261015C — 사용자 타임존 병기 ─────────────────────────────────────────

/** "Asia/Ho_Chi_Minh" → "Ho Chi Minh" (짧은 도시 표기). */
export function tzCity(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

/** tz 기준 포맷. 잘못된 tz 는 DEFAULT_TZ 로 대체한다. */
export function formatInTz(
  date: Date | string,
  tz: string,
  locale: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: DEFAULT_TZ }).format(d);
  }
}

/**
 * 테넌트 기본 타임존 기준으로 표시하고, 사용자 타임존이 다르면 괄호로 병기한다.
 * 예) "10/16 19:00 (10/16 17:00 Ho Chi Minh)". 표시 결과가 같으면 한 번만.
 */
export function formatDual(
  date: Date | string,
  zones: { tenantTz: string; userTz?: string | null },
  locale: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  const base = formatInTz(date, zones.tenantTz, locale, opts);
  const userTz = zones.userTz;
  if (!userTz || userTz === zones.tenantTz) return base;
  const mine = formatInTz(date, userTz, locale, opts);
  return mine === base ? base : `${base} (${mine} ${tzCity(userTz)})`;
}

/** 시작–종료를 한 덩어리로 병기: "19:00–20:00 (17:00–18:00 Ho Chi Minh)". */
export function formatDualRange(
  start: Date | string,
  end: Date | string,
  zones: { tenantTz: string; userTz?: string | null },
  locale: string,
  startOpts: Intl.DateTimeFormatOptions,
  endOpts: Intl.DateTimeFormatOptions = startOpts,
): string {
  const range = (tz: string) =>
    `${formatInTz(start, tz, locale, startOpts)}–${formatInTz(end, tz, locale, endOpts)}`;
  const base = range(zones.tenantTz);
  const userTz = zones.userTz;
  if (!userTz || userTz === zones.tenantTz) return base;
  const mine = range(userTz);
  return mine === base ? base : `${base} (${mine} ${tzCity(userTz)})`;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
};
const HM_OPTS: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/**
 * 일정 일시 표시(시작~종료). 종일은 테넌트 기준 날짜만, 시간 일정은 사용자 타임존 병기.
 * 같은 날 종료면 종료는 시:분만 표시한다.
 */
export function formatEventWhen(
  startAt: string,
  endAt: string,
  allDay: boolean,
  zones: { tenantTz: string; userTz?: string | null },
  locale: string,
): string {
  const ymd = (v: string) =>
    formatInTz(v, zones.tenantTz, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (allDay) {
    // 종일 일정의 endAt 은 다음날 0시(배타)일 수 있어 1ms 빼서 마지막 날을 구한다.
    const last = new Date(new Date(endAt).getTime() - 1).toISOString();
    const s = formatInTz(startAt, zones.tenantTz, locale, DATE_OPTS);
    return ymd(startAt) >= ymd(last) ? s : `${s} ~ ${formatInTz(last, zones.tenantTz, locale, DATE_OPTS)}`;
  }
  const full = { ...DATE_OPTS, ...HM_OPTS };
  return formatDualRange(startAt, endAt, zones, locale, full, ymd(startAt) === ymd(endAt) ? HM_OPTS : full);
}
