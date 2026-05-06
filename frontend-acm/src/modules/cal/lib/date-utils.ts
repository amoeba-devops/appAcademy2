// Lightweight date helpers for CAL month-grid (no external dep).

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
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

export function formatYearMonth(d: Date, locale = 'ko-KR'): string {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(d);
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

export function defaultEventTimes(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(9, 0, 0, 0);
  const end = new Date(date);
  end.setHours(10, 0, 0, 0);
  return { start, end };
}
