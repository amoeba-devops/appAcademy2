// Lightweight date helpers for CAL month-grid (no external dep).

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 0): Date {
  const start = startOfDay(d);
  const offset = (start.getDay() - weekStartsOn + 7) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function endOfWeek(d: Date, weekStartsOn: 0 | 1 = 0): Date {
  const end = startOfWeek(d, weekStartsOn);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

/** Returns a 6×7 grid (Sun-start) of Date objects covering the month. */
export function monthGridDays(monthAnchor: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const first = startOfMonth(monthAnchor);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function weekDays(anchor: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function formatYearMonth(d: Date, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
}

export function formatFullDate(d: Date, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
}

export function formatShortDate(d: Date, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(d);
}

export function formatTime(iso: string, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

export function formatDateTimeLocal(iso: string): string {
  // For datetime-local input value: "YYYY-MM-DDTHH:MM"
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(localStr: string): string {
  // Input "YYYY-MM-DDTHH:MM" → ISO with current TZ offset
  return new Date(localStr).toISOString();
}

// PLN-260718 — 기본 시작 시각 = 현재 이후(다음 30분 슬롯), 종료 = +1시간.
// 지정된 date 가 오늘이 아니면 09:00 기본. (30분 슬롯 정렬)
export function defaultEventTimes(date: Date): { start: Date; end: Date } {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const start = new Date(date);
  if (isToday) {
    // 다음 30분 슬롯으로 반올림
    const mins = now.getMinutes();
    const slot = mins === 0 ? 0 : mins <= 30 ? 30 : 60;
    start.setHours(now.getHours(), 0, 0, 0);
    start.setMinutes(slot);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}
