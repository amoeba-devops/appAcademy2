import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { useTenantTz } from '@/lib/tz';
import { localInputToIso } from '../lib/date-utils';
export interface RepeatRule {
  kind: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'DATES';
  interval: number;
  excludeWeekends: boolean;
  weekdays?: number[];
  dates?: string[];
  end: 'NEVER' | 'UNTIL' | 'COUNT';
  until?: string;
  count?: number;
}
export type RepeatScope = 'ONE' | 'FOLLOWING' | 'ALL';
export interface RepeatMetadata {
  seriesId: string;
  version: number;
  rule: RepeatRule;
  timezone: string;
  stoppedAt: string | null;
}
export function useRepeatMetadata(eventId?: string) {
  return useQuery({
    queryKey: ['cal', 'recurrence', eventId],
    enabled: !!eventId,
    queryFn: async () =>
      (
        await apiClient.get<RepeatMetadata | null>(
          `/acm/cal/recurrence/events/${eventId}`,
        )
      ).data,
  });
}
const input = 'rounded border bg-surface px-2 py-1.5 text-sm';
export function RecurrenceEditor({
  value,
  onChange,
  start,
  end,
  onValid,
}: {
  value: RepeatRule | null;
  onChange: (r: RepeatRule | null) => void;
  start: string;
  end: string;
  onValid: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation('cal');
  const tz = useTenantTz();
  const [date, setDate] = useState('');
  const event = {
    evtTitle: 'Preview',
    evtStartAt: start ? localInputToIso(start, tz) : '',
    evtEndAt: end ? localInputToIso(end, tz) : '',
  };
  const preview = useQuery({
    queryKey: ['cal', 'repeat-preview', event, value, tz],
    enabled: !!value && !!event.evtStartAt && !!event.evtEndAt,
    retry: false,
    queryFn: async () =>
      (
        await apiClient.post<{
          items: { start: string; end: string }[];
          timezone: string;
        }>('/acm/cal/recurrence/preview', { event, rule: value })
      ).data,
  });
  // Parent save button must track the exact current rule, including in-flight preview.
  const valid =
    !value ||
    (!preview.isFetching && !preview.isError && !!preview.data?.items.length);
  // Use an effect so no state update is made during render.
  usePreviewValidity(valid, onValid);
  const set = (patch: Partial<RepeatRule>) =>
    value && onChange({ ...value, ...patch });
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 text-sm font-medium">{t('repeat.title')}</legend>
      <select
        aria-label={t('repeat.title')}
        className={input}
        value={value?.kind ?? 'NONE'}
        onChange={(e) => {
          const kind = e.target.value as RepeatRule['kind'] | 'NONE';
          onChange(
            kind === 'NONE'
              ? null
              : {
                  kind,
                  interval: 1,
                  excludeWeekends: false,
                  end: 'NEVER',
                  ...(kind === 'WEEKLY'
                    ? { weekdays: [new Date(start).getDay()] }
                    : {}),
                  ...(kind === 'DATES'
                    ? { dates: start ? [start.slice(0, 10)] : [] }
                    : {}),
                },
          );
        }}
      >
        {['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'DATES'].map((k) => (
          <option key={k} value={k}>
            {t(`repeat.kind.${k}`)}
          </option>
        ))}
      </select>
      {value && (
        <>
          {value.kind !== 'DATES' && (
            <label className="flex items-center gap-2">
              {t('repeat.interval')}
              <input
                aria-label={t('repeat.interval')}
                className={`${input} w-20`}
                type="number"
                min={1}
                max={365}
                value={value.interval}
                onChange={(e) => set({ interval: Number(e.target.value) })}
              />
              {t(`repeat.unit.${value.kind}`)}
            </label>
          )}
          {value.kind === 'DAILY' && (
            <label className="flex items-center gap-2">
              {t('repeat.weekend')}
              <select
                className={input}
                value={value.excludeWeekends ? 'EXCLUDE' : 'INCLUDE'}
                onChange={(e) =>
                  set({ excludeWeekends: e.target.value === 'EXCLUDE' })
                }
              >
                <option value="INCLUDE">{t('repeat.include')}</option>
                <option value="EXCLUDE">{t('repeat.exclude')}</option>
              </select>
            </label>
          )}
          {value.kind === 'WEEKLY' && (
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={value.weekdays?.includes(d) ?? false}
                    onChange={(e) =>
                      set({
                        weekdays: e.target.checked
                          ? [...(value.weekdays ?? []), d]
                          : (value.weekdays ?? []).filter((x) => x !== d),
                      })
                    }
                  />{' '}
                  {new Intl.DateTimeFormat(i18n.language, {
                    weekday: 'short',
                  }).format(new Date(2024, 0, 7 + d))}
                </label>
              ))}
            </div>
          )}
          {value.kind === 'MONTHLY' && (
            <p className="text-xs text-secondary">{t('repeat.monthHint')}</p>
          )}
          {value.kind === 'DATES' ? (
            <div className="space-y-2">
              <label>
                {t('repeat.dates')}{' '}
                <input
                  type="date"
                  className={input}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>{' '}
              <button
                type="button"
                className="rounded border px-2 py-1"
                disabled={!date}
                onClick={() => {
                  set({
                    dates: [...new Set([...(value.dates ?? []), date])].sort(),
                  });
                  setDate('');
                }}
              >
                {t('repeat.addDate')}
              </button>
              <div className="flex flex-wrap gap-2">
                {value.dates?.map((d) => (
                  <button
                    type="button"
                    className="rounded border px-2 py-1 text-xs"
                    key={d}
                    aria-label={`${t('common:actions.delete')} ${d}`}
                    onClick={() =>
                      set({ dates: value.dates?.filter((x) => x !== d) })
                    }
                  >
                    {d} ×
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <label>
                {t('repeat.end')}{' '}
                <select
                  className={input}
                  value={value.end}
                  onChange={(e) => {
                    const end = e.target.value as RepeatRule['end'];
                    set({
                      end,
                      until:
                        end === 'UNTIL'
                          ? (value.until ?? start.slice(0, 10))
                          : undefined,
                      count: end === 'COUNT' ? (value.count ?? 10) : undefined,
                    });
                  }}
                >
                  {['NEVER', 'UNTIL', 'COUNT'].map((k) => (
                    <option key={k} value={k}>
                      {t(`repeat.endKind.${k}`)}
                    </option>
                  ))}
                </select>
              </label>
              {value.end === 'UNTIL' && (
                <input
                  aria-label={t('repeat.endKind.UNTIL')}
                  className={input}
                  type="date"
                  value={value.until ?? ''}
                  onChange={(e) => set({ until: e.target.value })}
                />
              )}{' '}
              {value.end === 'COUNT' && (
                <input
                  aria-label={t('repeat.endKind.COUNT')}
                  className={`${input} w-24`}
                  type="number"
                  min={1}
                  max={100000}
                  value={value.count ?? 10}
                  onChange={(e) => set({ count: Number(e.target.value) })}
                />
              )}
            </div>
          )}
          <p className="text-xs">
            {t(`repeat.kind.${value.kind}`)} ·{' '}
            {value.kind === 'DAILY' &&
              `${t(value.excludeWeekends ? 'repeat.exclude' : 'repeat.include')} · `}
            {value.kind === 'DATES'
              ? value.dates?.length
              : `${t(`repeat.endKind.${value.end}`)} ${value.end === 'COUNT' ? (value.count ?? '') : value.end === 'UNTIL' ? (value.until ?? '') : ''}`}{' '}
            · {tz}
          </p>
          <div
            aria-live="polite"
            className="rounded bg-[var(--gray-50)] p-2 text-xs"
          >
            <strong>{t('repeat.preview')}</strong>
            {preview.isFetching ? (
              <p>{t('common:status.loading')}</p>
            ) : preview.isError ? (
              <p className="text-red-700">{t('repeat.invalid')}</p>
            ) : (
              <ol className="mt-1 space-y-1">
                {preview.data?.items.map((x) => (
                  <li key={x.start}>
                    {new Date(x.start).toLocaleString(i18n.language, {
                      timeZone: preview.data.timezone,
                    })}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="text-xs text-secondary">{t('repeat.notify')}</p>
        </>
      )}
    </fieldset>
  );
}
import { useEffect } from 'react';
function usePreviewValidity(valid: boolean, onValid: (v: boolean) => void) {
  useEffect(() => onValid(valid), [valid, onValid]);
}
export function RecurrenceScope({
  metadata,
  scope,
  onChange,
}: {
  metadata: RepeatMetadata;
  scope: RepeatScope;
  onChange: (s: RepeatScope) => void;
}) {
  const { t } = useTranslation('cal');
  return (
    <fieldset className="space-y-2 rounded border p-3">
      <legend>{t('repeat.title')}</legend>
      <p className="text-xs">
        {t(`repeat.kind.${metadata.rule.kind}`)} · {metadata.timezone}
        {metadata.stoppedAt ? ` · ${t('repeat.stopped')}` : ''}
      </p>
      <label className="text-sm">
        {t('repeat.scope')}{' '}
        <select
          className={input}
          value={scope}
          onChange={(e) => onChange(e.target.value as RepeatScope)}
        >
          {['ONE', 'FOLLOWING', 'ALL'].map((k) => (
            <option key={k} value={k}>
              {t(`repeat.scopeKind.${k}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-secondary">{t('repeat.protected')}</p>
    </fieldset>
  );
}
