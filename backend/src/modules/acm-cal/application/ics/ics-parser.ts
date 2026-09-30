import { createHash } from 'node:crypto';
import ICAL from 'ical.js';

export interface IcsSourceInput {
  calendarKey: string;
  calendarName: string;
  uid: string;
  hash: string;
  text: string;
  unbounded: boolean;
}
export interface IcsOccurrence {
  key: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  meetingUrl: string | null;
  meetingProvider: 'NONE' | 'GOOGLE_MEET' | 'OTHER';
}
function prop(c: ICAL.Component, key: string): string {
  return String(c.getFirstPropertyValue(key) ?? '');
}
export function splitCalendar(
  text: string,
  calendarKey: string,
): IcsSourceInput[] {
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== 'vcalendar') throw new Error('Expected VCALENDAR');
  const groups = new Map<string, ICAL.Component[]>();
  for (const c of root.getAllSubcomponents('vevent')) {
    const uid = prop(c, 'uid');
    if (!uid) throw new Error('Missing UID');
    groups.set(uid, [...(groups.get(uid) ?? []), c]);
  }
  return [...groups].map(([uid, events]) => {
    const component = new ICAL.Component('vcalendar');
    component.addPropertyWithValue('version', '2.0');
    component.addPropertyWithValue(
      'x-wr-timezone',
      prop(root, 'x-wr-timezone') || 'Asia/Seoul',
    );
    for (const zone of root.getAllSubcomponents('vtimezone'))
      component.addSubcomponent(new ICAL.Component(zone.toJSON()));
    for (const event of events)
      component.addSubcomponent(new ICAL.Component(event.toJSON()));
    const masters = events.filter((c) => !c.hasProperty('recurrence-id'));
    if (masters.length > 1) throw new Error('Duplicate master UID');
    const keys = events.map((c) => prop(c, 'recurrence-id'));
    if (new Set(keys).size !== keys.length)
      throw new Error('Duplicate recurrence ID');
    const serialized = component.toString();
    const unbounded = masters.some((c) =>
      c.getAllProperties('rrule').some((p) => {
        const r = p.getFirstValue() as ICAL.Recur;
        if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.freq))
          throw new Error('Unsupported high frequency');
        return !r.until && !r.count;
      }),
    );
    return {
      calendarKey,
      calendarName: prop(root, 'x-wr-calname') || calendarKey,
      uid,
      hash: createHash('sha256').update(serialized).digest('hex'),
      text: serialized,
      unbounded,
    };
  });
}
// Floating/all-day values belong to the calendar zone, never the server zone.
function instant(t: ICAL.Time, fallback: string): string {
  if (!t.isDate && t.zone.tzid !== 'floating')
    return t.toJSDate().toISOString();
  const wall = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  let result = wall;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: fallback,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(result)).map((p) => [p.type, p.value]),
    );
    const shown = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour,
      +p.minute,
      +p.second,
    );
    result += wall - shown;
  }
  return new Date(result).toISOString();
}
export function expandSource(
  source: IcsSourceInput,
  until: Date,
): IcsOccurrence[] {
  const root = new ICAL.Component(ICAL.parse(source.text));
  const fallback = prop(root, 'x-wr-timezone') || 'Asia/Seoul';
  const components = root.getAllSubcomponents('vevent');
  const master = components.find((c) => !c.hasProperty('recurrence-id'));
  const results = new Map<string, IcsOccurrence>();
  function add(
    item: ICAL.Event,
    start: ICAL.Time,
    end: ICAL.Time,
    key: string,
  ) {
    if (prop(item.component, 'status') === 'CANCELLED') return;
    const startIso = instant(start, fallback),
      endIso = instant(end, fallback);
    if (endIso < startIso) throw new Error('Negative event duration');
    const title = item.summary || '(제목 없음)';
    const description = item.description || '';
    const location = item.location || '';
    if (title.length > 200 || location.length > 200)
      throw new Error('Calendar field exceeds destination length');
    const linkText = [
      prop(item.component, 'x-google-conference'),
      prop(item.component, 'url'),
      location,
      description,
    ].join('\n');
    const meetingUrl =
      linkText.match(/https:\/\/meet\.google\.com\/[a-zA-Z0-9-]+/)?.[0] ??
      linkText.match(
        /https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/[^\s<>"\\]+/,
      )?.[0] ??
      null;
    if (meetingUrl && meetingUrl.length > 500)
      throw new Error('Meeting URL exceeds destination length');
    results.set(key, {
      key,
      title,
      description,
      location,
      start: startIso,
      end: endIso,
      allDay: start.isDate,
      meetingUrl,
      meetingProvider: meetingUrl
        ? new URL(meetingUrl).hostname === 'meet.google.com'
          ? 'GOOGLE_MEET'
          : 'OTHER'
        : 'NONE',
    });
  }
  if (master) {
    const event = new ICAL.Event(master, { strictExceptions: true });
    if (event.isRecurring()) {
      const iterator = event.iterator();
      let count = 0;
      let next: ICAL.Time | null;
      while ((next = iterator.next())) {
        if (++count > 100000) throw new Error('Expansion safety limit reached');
        if (source.unbounded && new Date(instant(next, fallback)) >= until)
          break;
        const d = event.getOccurrenceDetails(next);
        add(d.item, d.startDate, d.endDate, instant(next, fallback));
      }
    } else add(event, event.startDate, event.endDate, 'single');
  }
  // Explicit overrides are authoritative, including detached or moved occurrences.
  for (const c of components.filter((c) => c.hasProperty('recurrence-id'))) {
    const event = new ICAL.Event(c);
    if (event.modifiesFuture())
      throw new Error('RANGE=THISANDFUTURE requires explicit review');
    const key = instant(event.recurrenceId, fallback);
    results.delete(key);
    add(event, event.startDate, event.endDate, key);
  }
  return [...results.values()];
}
