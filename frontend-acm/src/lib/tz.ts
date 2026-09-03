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
