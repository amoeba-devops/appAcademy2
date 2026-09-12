/**
 * REQ-260903F — 서버측 벽시계 → UTC 변환 (프론트 lib/tz.ts 와 동일 알고리즘).
 * Intl 기반 2-pass 오프셋 보정으로 DST 지역도 안전. 라이브러리 미도입.
 */
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function partFmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
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
    fmtCache.set(tz, f);
  }
  return f;
}

function tzOffsetMs(date: Date, tz: string): number {
  const parts = partFmt(tz).formatToParts(date);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * 요구 260912C — 해당 시각의 tz 기준 'YYYY-MM-DD'.
 * `new Date().toISOString().slice(0, 10)` 은 UTC 날짜라 KST 00:00~09:00 에
 * 하루 밀린다. 테넌트 기준 '오늘' 이 필요한 곳에서 쓴다.
 */
export function ymdInTz(date: Date, tz: string): string {
  const parts = partFmt(tz).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** tz 벽시계(y,m,d,hh,mm) → UTC Date. */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  tz: string,
): Date {
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = utcGuess - tzOffsetMs(new Date(utcGuess), tz);
  ts = utcGuess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** 'YYYY-MM-DD' + 'HH:MM[:SS]' + tz → UTC Date. 형식 오류 시 null. */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  tz: string,
): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  const tm = /^(\d{2}):(\d{2})/.exec(timeStr);
  if (!dm || !tm) return null;
  return zonedToUtc(+dm[1], +dm[2], +dm[3], +tm[1], +tm[2], tz);
}
