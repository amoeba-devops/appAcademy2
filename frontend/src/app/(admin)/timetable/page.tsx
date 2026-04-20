'use client';

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimetable } from '@/hooks/use-timetable';
import { useTeachers } from '@/hooks/use-teachers';
import { useClassrooms } from '@/hooks/use-classes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { TimetableSession } from '@/types/timetable';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 09:00 ~ 20:00

const SESSION_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 border-blue-300 text-blue-800',
  HELD: 'bg-green-100 border-green-300 text-green-800',
  CANCELLED: 'bg-red-100 border-red-300 text-red-800',
  MAKEUP: 'bg-purple-100 border-purple-300 text-purple-800',
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

export default function TimetablePage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const [teacherFilter, setTeacherFilter] = useState<string>('');
  const [classroomFilter, setClassroomFilter] = useState<string>('');

  const { data: timetable, isLoading } = useTimetable({
    week: formatDate(currentMonday),
    teacherId: teacherFilter ? parseInt(teacherFilter) : undefined,
    classroomId: classroomFilter ? parseInt(classroomFilter) : undefined,
  });

  const { data: teachers = [] } = useTeachers({ status: 'ACTIVE' });
  const { data: classrooms = [] } = useClassrooms();

  const prevWeek = () => setCurrentMonday(addDays(currentMonday, -7));
  const nextWeek = () => setCurrentMonday(addDays(currentMonday, 7));
  const today = () => setCurrentMonday(getMonday(new Date()));

  // Group sessions by day-of-week (0=Mon ... 6=Sun)
  const sessionsByDay = useMemo(() => {
    const map: Record<number, TimetableSession[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];

    if (timetable?.sessions) {
      for (const session of timetable.sessions) {
        const startDate = new Date(session.startAt);
        const dayOfWeek = startDate.getDay();
        const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 ... Sun=6
        map[idx].push(session);
      }
    }
    return map;
  }, [timetable]);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));
  const todayStr = formatDate(new Date());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('admin:timetable.title')}</h1>
        <div className="flex items-center gap-2">
          <Select
            value={teacherFilter}
            onValueChange={(v) => v && setTeacherFilter(v === 'ALL' ? '' : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('admin:timetable.teacher-all-placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('admin:timetable.teacher-all')}</SelectItem>
              {teachers.map((tc) => (
                <SelectItem key={tc.id} value={String(tc.id)}>
                  {tc.cachedName ?? tc.amaClientId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={classroomFilter}
            onValueChange={(v) => v && setClassroomFilter(v === 'ALL' ? '' : v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('admin:timetable.classroom-all-placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('admin:timetable.classroom-all')}</SelectItem>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>
            {t('admin:timetable.today')}
          </Button>
          <Button variant="outline" size="icon" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {currentMonday.toLocaleDateString(i18n.resolvedLanguage ?? 'ko', { year: 'numeric', month: 'long', day: 'numeric' })}
          {' ~ '}
          {addDays(currentMonday, 6).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', { month: 'long', day: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded bg-blue-200" /> {t('admin:timetable.legend.scheduled')}
          <span className="inline-block w-3 h-3 rounded bg-green-200" /> {t('admin:timetable.legend.held')}
          <span className="inline-block w-3 h-3 rounded bg-red-200" /> {t('admin:timetable.legend.canceled')}
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t('admin:timetable.loading')}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {/* Header row */}
            <div className="bg-muted/50 border-b p-2" />
            {weekDates.map((date, i) => {
              const dateStr = formatDate(date);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={i}
                  className={`bg-muted/50 border-b border-l p-2 text-center ${isToday ? 'bg-[#C9A656]/10' : ''}`}
                >
                  <div className="text-xs text-muted-foreground">{t(`common:days-short.${DAY_KEYS[i]}`)}</div>
                  <div className={`text-sm font-medium ${isToday ? 'text-[#C9A656]' : ''}`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div key={hour} className="contents">
                <div className="border-b p-1 text-xs text-muted-foreground text-right pr-2 h-[80px] flex items-start justify-end">
                  {hour}:00
                </div>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const daySessions = sessionsByDay[dayIdx].filter((s) => {
                    const startHour = new Date(s.startAt).getHours();
                    return startHour === hour;
                  });

                  return (
                    <div
                      key={dayIdx}
                      className="border-b border-l h-[80px] relative p-0.5"
                    >
                      {daySessions.map((session) => (
                        <SessionCard key={session.id} session={session} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: TimetableSession }) {
  const { i18n } = useTranslation();
  const colorClass = SESSION_STATUS_COLORS[session.sessionStatus] ?? SESSION_STATUS_COLORS.SCHEDULED;
  const lng = i18n.resolvedLanguage ?? 'ko';
  const startTime = new Date(session.startAt).toLocaleTimeString(lng, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(session.endAt).toLocaleTimeString(lng, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`rounded border px-1.5 py-1 text-[11px] leading-tight cursor-default ${colorClass}`}
      title={`${session.programName ?? ''} · ${session.teacherName ?? ''}\n${startTime}~${endTime}\n${session.classroomName ?? ''}`}
    >
      <div className="font-medium truncate">{session.programName ?? `Class #${session.classId}`}</div>
      <div className="truncate text-[10px] opacity-75">{session.teacherName ?? '-'}</div>
      <div className="truncate text-[10px] opacity-60">{startTime}~{endTime}</div>
    </div>
  );
}
