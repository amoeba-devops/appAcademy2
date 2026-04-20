'use client';

export const dynamic = 'force-dynamic';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';

interface TimetableSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  className: string;
  teacherName: string;
  programName: string;
}

interface TimetableData {
  sessions: TimetableSession[];
  weekStart: string;
  weekEnd: string;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const HOURS = Array.from({ length: 13 }, (_, i) => i + 9); // 9:00 ~ 21:00

function getDayIndex(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function getHour(timeStr: string) {
  return parseInt(timeStr?.slice(0, 2) ?? '0', 10);
}

function shiftWeek(dateStr: string, weeks: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function MyTimetablePage() {
  return (
    <Suspense fallback={null}>
      <MyTimetableContent />
    </Suspense>
  );
}

function MyTimetableContent() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');
  const { t, i18n } = useTranslation(['portal', 'common']);

  const formatWeekRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'ko', {
      month: 'short',
      day: 'numeric',
    });
    return `${fmt.format(s)} — ${fmt.format(e)}`;
  };

  const [data, setData] = useState<TimetableData | null>(null);
  const [weekStart, setWeekStart] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTimetable = useCallback(async (ws?: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ studentId });
      if (ws) params.set('weekStart', ws);
      const res = await api.get<TimetableData>(`/portal/my/timetable?${params}`);
      if (res.data) {
        setData(res.data);
        setWeekStart(res.data.weekStart);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login/parent');
      return;
    }
    if (authStatus === 'authenticated' && studentId) {
      loadTimetable();
    }
  }, [authStatus, studentId, loadTimetable, router]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream/60 animate-pulse">{t('portal:my.loading')}</div>
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-cream text-lg mb-3">{t('portal:my.timetable.select-child')}</p>
          <Link href="/my" className="text-heraldic-gold text-sm hover:underline">
            {t('portal:my.timetable.back-to-my')}
          </Link>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions ?? [];

  return (
    <div className="min-h-screen bg-navy text-cream">
      {/* Header */}
      <div className="border-b border-cream/10">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Link href="/my" className="text-cream/50 text-sm hover:text-cream mb-2 inline-block">
            {t('portal:my.timetable.my-link')}
          </Link>
          <h1 className="font-display text-2xl">{t('portal:my.timetable.page-title')}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => loadTimetable(shiftWeek(weekStart, -1))}
            className="px-3 py-1 rounded bg-cream/10 text-sm hover:bg-cream/20 transition-colors"
          >
            {t('portal:my.timetable.prev-week')}
          </button>
          <span className="text-sm text-cream/70">
            {data ? formatWeekRange(data.weekStart, data.weekEnd) : ''}
          </span>
          <button
            type="button"
            onClick={() => loadTimetable(shiftWeek(weekStart, 1))}
            className="px-3 py-1 rounded bg-cream/10 text-sm hover:bg-cream/20 transition-colors"
          >
            {t('portal:my.timetable.next-week')}
          </button>
        </div>

        {/* Weekly Grid */}
        <div className="rounded-lg border border-cream/10 overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {/* Header row */}
            <div className="bg-cream/5 p-2" />
            {DAY_KEYS.map((dk, i) => {
              const dateStr = data?.weekStart
                ? new Date(new Date(data.weekStart).getTime() + i * 86400000)
                    .toLocaleDateString(i18n.resolvedLanguage ?? 'ko', { month: 'numeric', day: 'numeric' })
                : '';
              return (
                <div key={dk} className="bg-cream/5 p-2 text-center text-xs">
                  <span className="font-medium">{t(`common:days-short.${dk}`)}</span>
                  <span className="block text-cream/40 text-[10px]">{dateStr}</span>
                </div>
              );
            })}

            {/* Time slots */}
            {HOURS.map((hour) => (
              <>
                <div key={`h-${hour}`} className="border-t border-cream/5 p-2 text-xs text-cream/40 text-right pr-3">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {DAY_KEYS.map((_, dayIdx) => {
                  const cellSessions = sessions.filter(
                    (s) => getDayIndex(s.date) === dayIdx && getHour(s.startTime) === hour,
                  );
                  return (
                    <div
                      key={`${hour}-${dayIdx}`}
                      className="border-t border-l border-cream/5 min-h-[48px] p-0.5"
                    >
                      {cellSessions.map((s) => (
                        <div
                          key={s.id}
                          className={`text-[10px] leading-tight rounded px-1.5 py-1 mb-0.5 ${
                            s.status === 'HELD'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : s.status === 'CANCELED'
                              ? 'bg-red-500/10 text-red-300 border border-red-500/20 line-through'
                              : 'bg-cream/10 text-cream/70 border border-cream/10'
                          }`}
                        >
                          <span className="block font-medium truncate">{s.className}</span>
                          <span className="text-cream/40">
                            {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
                          </span>
                          {s.teacherName && (
                            <span className="block text-cream/30">{s.teacherName}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs text-cream/50">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-cream/10 border border-cream/10" /> {t('portal:my.timetable.legend-scheduled')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> {t('portal:my.timetable.legend-held')}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20" /> {t('portal:my.timetable.legend-canceled')}
          </span>
        </div>
      </div>
    </div>
  );
}
