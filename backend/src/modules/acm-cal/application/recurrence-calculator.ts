import ICAL from 'ical.js';
import { BadRequestException } from '@nestjs/common';
import { instant } from './ics/ics-parser';
import type { RecurrenceRuleDto } from './dto/recurrence.dto';
export function wallTime(iso: string, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}
export interface RepeatOccurrence {
  key: string;
  start: string;
  end: string;
}
export function recurrenceRule(rule: RecurrenceRuleDto): string {
  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return [
    `FREQ=${rule.kind}`,
    `INTERVAL=${rule.interval ?? 1}`,
    rule.kind === 'DAILY' && rule.excludeWeekends ? 'BYDAY=MO,TU,WE,TH,FR' : '',
    rule.kind === 'WEEKLY'
      ? `BYDAY=${(rule.weekdays ?? []).map((d) => days[d]).join(',')}`
      : '',
    'WKST=MO',
  ]
    .filter(Boolean)
    .join(';');
}
export function expandRecurrence(
  start: string,
  end: string,
  tz: string,
  rule: RecurrenceRuleDto,
  horizon: Date,
  limit = 100000,
): RepeatOccurrence[] {
  if (
    !Number.isFinite(+new Date(start)) ||
    !Number.isFinite(+new Date(end)) ||
    new Date(end) <= new Date(start)
  )
    throw new BadRequestException('END_BEFORE_START');
  if (rule.kind === 'WEEKLY' && !rule.weekdays?.length)
    throw new BadRequestException('REPEAT_WEEKDAYS_REQUIRED');
  if (rule.end === 'COUNT' && !rule.count)
    throw new BadRequestException('REPEAT_COUNT_REQUIRED');
  if (rule.end === 'UNTIL' && !/^\d{4}-\d{2}-\d{2}$/.test(rule.until ?? ''))
    throw new BadRequestException('REPEAT_UNTIL_REQUIRED');
  const first = wallTime(start, tz),
    last = wallTime(end, tz);
  const duration = +new Date(last + 'Z') - +new Date(first + 'Z');
  if (duration <= 0)
    throw new BadRequestException('REPEAT_INVALID_LOCAL_DURATION');
  const out: RepeatOccurrence[] = [];
  let candidates: Iterable<string>;
  if (rule.kind === 'DATES') {
    if (
      !rule.dates?.length ||
      rule.dates.some(
        (d) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
          new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) !== d,
      )
    )
      throw new BadRequestException('REPEAT_DATES_REQUIRED');
    candidates = [...new Set(rule.dates)]
      .sort()
      .map((d) => d + first.slice(10));
  } else {
    const iterator = ICAL.Recur.fromString(
      rule.kind === 'DAILY'
        ? `FREQ=DAILY;INTERVAL=${rule.interval ?? 1}`
        : recurrenceRule(rule),
    ).iterator(ICAL.Time.fromString(first, undefined));
    candidates = {
      *[Symbol.iterator]() {
        let n: ICAL.Time | null;
        let i = 0;
        while ((n = iterator.next())) {
          if (++i > 100000)
            throw new BadRequestException('REPEAT_RANGE_TOO_LARGE');
          yield n.toString();
        }
      },
    };
  }
  let count = 0;
  for (const local of candidates) {
    const weekday = new Date(local + 'Z').getUTCDay();

    if (
      rule.kind !== 'DATES' &&
      rule.end === 'UNTIL' &&
      local.slice(0, 10) > rule.until!
    )
      break;
    const s = instant(ICAL.Time.fromString(local, undefined), tz);
    if (new Date(s) >= horizon) break;
    if (
      rule.kind === 'DAILY' &&
      rule.excludeWeekends &&
      (weekday === 0 || weekday === 6)
    )
      continue;
    if (rule.kind === 'WEEKLY' && !rule.weekdays?.includes(weekday)) continue;
    // Nonexistent local times during the DST spring gap are skipped, never shifted.
    if (wallTime(s, tz) !== local) continue;
    const localEnd = new Date(+new Date(local + 'Z') + duration)
      .toISOString()
      .slice(0, 19);
    const e = instant(ICAL.Time.fromString(localEnd, undefined), tz);
    if (new Date(e) <= new Date(s)) continue;
    out.push({ key: s, start: s, end: e });
    count++;
    if (
      out.length >= limit ||
      (rule.kind !== 'DATES' && rule.end === 'COUNT' && count >= rule.count!)
    )
      break;
  }
  return out;
}
export function generationHorizon(start: string, requested?: Date): Date {
  const d = new Date(Math.max(Date.now(), +new Date(start)));
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return requested && requested > d ? requested : d;
}
