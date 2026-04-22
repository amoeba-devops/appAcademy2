'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useClassDetail, useUpdateClass, useRecordSession } from '@/hooks/use-classes';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft } from 'lucide-react';
import type { SchedulePattern } from '@/types/class';

const CLASS_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  CANCELED: 'destructive',
};

const SESSION_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  SCHEDULED: 'secondary',
  HELD: 'default',
  CANCELLED: 'destructive',
  MAKEUP: 'outline',
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data, isLoading } = useClassDetail(id);
  const updateClass = useUpdateClass();
  const recordSession = useRecordSession();

  const formatSchedule = (patterns: SchedulePattern[]): string => {
    if (!patterns || patterns.length === 0) return '-';
    return patterns
      .map((p) => `${t(`classes.days-short.${DAY_KEYS[p.dayOfWeek]}`)} ${p.startTime}~${p.endTime}`)
      .join(', ');
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">{t('classes.detail.loading')}</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-muted-foreground">{t('classes.detail.not-found')}</div>;
  }

  const cls = data.class;
  const sessions = data.sessions;
  const variant = CLASS_STATUS_VARIANT[cls.status] ?? ('secondary' as const);
  const statusLabel = t(`classes.status.${cls.status}`, { defaultValue: cls.status });
  const lng = i18n.resolvedLanguage ?? 'ko';

  const handleStatusChange = async (newStatus: string) => {
    await updateClass.mutateAsync({ id, data: { status: newStatus } });
  };

  const handleSessionRecord = async (sessionId: number, sessionStatus: string) => {
    await recordSession.mutateAsync({
      sessionId,
      data: { sessionStatus },
    });
  };

  const countHeld = sessions.filter((s) => s.sessionStatus === 'HELD').length;
  const countCancelled = sessions.filter((s) => s.sessionStatus === 'CANCELLED').length;
  const countScheduled = sessions.filter((s) => s.sessionStatus === 'SCHEDULED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/classes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0E1E3A]">
            {cls.programName ?? t('classes.program-fallback', { id: cls.id })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cls.teacherName ?? '-'} · {cls.classroomName ?? t('classes.detail.classroom-tbd')}
          </p>
        </div>
        <Badge variant={variant} className="text-sm px-3 py-1">
          {statusLabel}
        </Badge>
      </div>

      {/* Status Actions */}
      <div className="flex gap-2">
        {cls.status === 'DRAFT' && (
          <Button size="sm" onClick={() => handleStatusChange('ACTIVE')}>
            {t('classes.detail.action-start')}
          </Button>
        )}
        {cls.status === 'ACTIVE' && (
          <Button size="sm" onClick={() => handleStatusChange('COMPLETED')}>
            {t('classes.detail.action-complete')}
          </Button>
        )}
        {(cls.status === 'DRAFT' || cls.status === 'ACTIVE') && (
          <Button size="sm" variant="destructive" onClick={() => handleStatusChange('CANCELED')}>
            {t('classes.detail.action-cancel')}
          </Button>
        )}
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('classes.detail.class-info-title')}</h2>
          <InfoRow label={t('classes.detail.label-program')} value={cls.programName ?? '-'} />
          <InfoRow label={t('classes.detail.label-teacher')} value={cls.teacherName ?? '-'} />
          <InfoRow label={t('classes.detail.label-classroom')} value={cls.classroomName ?? t('classes.detail.date-tbd')} />
          <InfoRow label={t('classes.detail.label-capacity')} value={t('classes.capacity-format', { enrolled: cls.enrolledCount, capacity: cls.capacity })} />
          <InfoRow label={t('classes.detail.label-period')} value={`${cls.startDate} ~ ${cls.endDate ?? t('classes.detail.date-tbd')}`} />
          <InfoRow label={t('classes.detail.label-schedule')} value={formatSchedule(cls.schedulePattern)} />
        </div>

        <div className="border rounded-lg p-6 space-y-3">
          <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('classes.detail.status-summary-title')}</h2>
          <InfoRow label={t('classes.detail.label-total-sessions')} value={t('classes.detail.count-suffix', { count: sessions.length })} />
          <InfoRow label={t('classes.detail.label-held')} value={t('classes.detail.count-suffix', { count: countHeld })} />
          <InfoRow label={t('classes.detail.label-canceled')} value={t('classes.detail.count-suffix', { count: countCancelled })} />
          <InfoRow label={t('classes.detail.label-scheduled')} value={t('classes.detail.count-suffix', { count: countScheduled })} />
        </div>
      </div>

      {/* Sessions Table */}
      <div>
        <h2 className="text-lg font-semibold text-[#0E1E3A] mb-3">{t('classes.detail.sessions-title')}</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('classes.detail.sessions-empty')}</p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">{t('classes.detail.sessions-table.no')}</TableHead>
                  <TableHead>{t('classes.detail.sessions-table.date')}</TableHead>
                  <TableHead>{t('classes.detail.sessions-table.time')}</TableHead>
                  <TableHead className="w-[80px]">{t('classes.detail.sessions-table.planned')}</TableHead>
                  <TableHead className="w-[80px]">{t('classes.detail.sessions-table.actual')}</TableHead>
                  <TableHead className="w-[80px]">{t('classes.detail.sessions-table.status')}</TableHead>
                  <TableHead className="w-[120px]">{t('classes.detail.sessions-table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const sVariant = SESSION_STATUS_VARIANT[session.sessionStatus] ?? ('secondary' as const);
                  const sLabel = t(`classes.detail.session-status.${session.sessionStatus}`, { defaultValue: session.sessionStatus });
                  const startDate = new Date(session.startAt);
                  const endDate = new Date(session.endAt);

                  return (
                    <TableRow key={session.id}>
                      <TableCell className="text-center">{session.sessionNo}</TableCell>
                      <TableCell>
                        {startDate.toLocaleDateString(lng, {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </TableCell>
                      <TableCell>
                        {startDate.toLocaleTimeString(lng, { hour: '2-digit', minute: '2-digit' })}
                        {' ~ '}
                        {endDate.toLocaleTimeString(lng, { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>{session.plannedDurationHours ?? '-'}h</TableCell>
                      <TableCell>{session.actualDurationHours ?? '-'}h</TableCell>
                      <TableCell>
                        <Badge variant={sVariant}>{sLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        {session.sessionStatus === 'SCHEDULED' && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleSessionRecord(session.id, 'HELD')}
                            >
                              {t('classes.detail.session-action-held')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() => handleSessionRecord(session.id, 'CANCELLED')}
                            >
                              {t('classes.detail.session-action-cancel')}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
