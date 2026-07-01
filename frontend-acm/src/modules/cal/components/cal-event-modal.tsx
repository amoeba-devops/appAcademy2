import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCalEvent,
  useCreateCalEvent,
  useDeleteCalEvent,
  useUpdateCalEvent,
} from '../hooks/use-cal-events';
import {
  CAL_CATEGORIES,
  CAL_PROVIDERS,
  type CalEvent,
  type CalInviteeView,
  type InviteeCandidate,
  type NotifySummary,
} from '../types';
import {
  defaultEventTimes,
  formatDateTimeLocal,
  localInputToIso,
} from '../lib/date-utils';
import { InviteePickerModal } from './invitee-picker-modal';
import { useBodaRoomStatus } from '@/lib/boda-launch-api';
import {
  useBodaForceClose,
  useBodaReconcile,
} from '@/lib/boda-admin-api';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: CalEvent;
  defaultDate?: Date;
}

type FormValues = {
  evtCategory: string;
  evtTitle: string;
  evtDescription: string;
  evtStartAt: string; // datetime-local
  evtEndAt: string;
  evtAllDay: boolean;
  evtLocationText: string;
  evtMeetingProvider: string;
  evtMeetingUrl: string;
  /** REQ-260630 — local teacher id (empty string = no assignee). */
  evtAssigneeTchId: string;
};

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function CalEventModal({ open, onClose, initial, defaultDate }: Props) {
  const { t } = useTranslation('cal');
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<
    Array<{ kind: 'STUDENT' | 'TEACHER' | 'PARENT'; refId: string; name: string; email: string | null; notifyStatus?: string | null }>
  >([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifySummary, setNotifySummary] = useState<NotifySummary | null>(null);

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      evtCategory: 'CLASS',
      evtTitle: '',
      evtDescription: '',
      evtStartAt: '',
      evtEndAt: '',
      evtAllDay: false,
      evtLocationText: '',
      evtMeetingProvider: 'NONE',
      evtMeetingUrl: '',
      evtAssigneeTchId: '',
    },
  });

  // REQ-260630 — local teachers for the 담당자 select.
  const { data: teachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<TeacherOption[] | { items: TeacherOption[] }>(
          '/acm/tch/teachers',
          { params: { status: 'ACTIVE', limit: 200 } },
        );
        const body = res.data;
        return Array.isArray(body) ? body : (body?.items ?? []);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotifySummary(null);
    if (initial) {
      reset({
        evtCategory: initial.category,
        evtTitle: initial.title,
        evtDescription: initial.description ?? '',
        evtStartAt: formatDateTimeLocal(initial.startAt),
        evtEndAt: formatDateTimeLocal(initial.endAt),
        evtAllDay: initial.allDay,
        evtLocationText: initial.locationText ?? '',
        evtMeetingProvider: initial.meetingProvider,
        evtMeetingUrl: initial.meetingUrl ?? '',
        evtAssigneeTchId: initial.assigneeTchId ?? '',
      });
      setInvitees(
        (initial.invitees ?? []).map((i: CalInviteeView) => ({
          kind: i.kind,
          refId: i.refId,
          name: i.name,
          email: i.email,
          notifyStatus: i.notifyStatus,
        })),
      );
    } else {
      const { start, end } = defaultEventTimes(defaultDate ?? new Date());
      reset({
        evtCategory: 'CLASS',
        evtTitle: '',
        evtDescription: '',
        evtStartAt: formatDateTimeLocal(start.toISOString()),
        evtEndAt: formatDateTimeLocal(end.toISOString()),
        evtAllDay: false,
        evtLocationText: '',
        evtMeetingProvider: 'NONE',
        evtMeetingUrl: '',
        evtAssigneeTchId: '',
      });
      setInvitees([]);
    }
  }, [open, initial, defaultDate, reset]);

  const createMut = useCreateCalEvent();
  const updateMut = useUpdateCalEvent(initial?.id ?? '');
  const deleteMut = useDeleteCalEvent();
  const { data: detail } = useCalEvent(open && isEdit ? initial?.id : undefined);
  const isLoading = createMut.isPending || updateMut.isPending || deleteMut.isPending;
  // Hydrate invitees + ownerName/Email from fresh detail fetch (list summary lacks them).
  useEffect(() => {
    if (!open || !detail) return;
    setInvitees(
      (detail.invitees ?? []).map((i: CalInviteeView) => ({
        kind: i.kind,
        refId: i.refId,
        name: i.name,
        email: i.email,
        notifyStatus: i.notifyStatus,
      })),
    );
  }, [open, detail]);

  const meetingProvider = watch('evtMeetingProvider');
  const isReadOnly = isEdit && initial?.source !== 'MANUAL';

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!values.evtTitle.trim()) { setError(t('error.titleRequired')); return; }
    if (!values.evtStartAt || !values.evtEndAt) { setError(t('error.timeRequired')); return; }
    const startIso = localInputToIso(values.evtStartAt);
    const endIso = localInputToIso(values.evtEndAt);
    if (new Date(endIso) <= new Date(startIso)) {
      setError(t('error.endBeforeStart'));
      return;
    }
    if (values.evtMeetingProvider !== 'NONE') {
      if (!values.evtMeetingUrl || !/^https?:\/\//i.test(values.evtMeetingUrl)) {
        setError(t('error.meetingUrlRequired'));
        return;
      }
    }

    const dto: Record<string, unknown> = {
      evtCategory: values.evtCategory,
      evtTitle: values.evtTitle,
      evtStartAt: startIso,
      evtEndAt: endIso,
      evtAllDay: values.evtAllDay,
      evtMeetingProvider: values.evtMeetingProvider,
    };
    if (values.evtDescription) dto.evtDescription = values.evtDescription;
    if (values.evtLocationText) dto.evtLocationText = values.evtLocationText;
    if (values.evtMeetingProvider !== 'NONE' && values.evtMeetingUrl) {
      dto.evtMeetingUrl = values.evtMeetingUrl;
    }
    // REQ-260630 — send teacher id when picked; explicit null on edit lets
    // the operator clear an existing assignee. Create path sends `undefined`
    // (omits the field) when empty.
    if (isEdit) {
      dto.evtAssigneeTchId = values.evtAssigneeTchId || null;
    } else if (values.evtAssigneeTchId) {
      dto.evtAssigneeTchId = values.evtAssigneeTchId;
    }

    dto.evtInvitees = invitees.map((i) => ({ kind: i.kind, refId: i.refId }));

    try {
      let saved: CalEvent;
      if (isEdit) {
        saved = await updateMut.mutateAsync(dto);
      } else {
        saved = await createMut.mutateAsync(dto);
      }
      if (saved.notifySummary) {
        setNotifySummary(saved.notifySummary);
        // Keep modal open briefly to show summary; then close after 2s.
        setTimeout(() => onClose(), 2000);
      } else {
        onClose();
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm(t('confirm.delete'))) return;
    try {
      await deleteMut.mutateAsync(initial.id);
      onClose();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {isReadOnly && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {t('hint.readOnlySource')}
            </div>
          )}

          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3" disabled={isReadOnly}>
            <div>
              <label className={labelClass}>{t('field.title')} *</label>
              <input {...register('evtTitle', { required: true })} className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.category')}</label>
                <select {...register('evtCategory')} className={inputClass}>
                  {CAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`category.${c}`)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('evtAllDay')} />
                  {t('field.allDay')}
                </label>
              </div>
              {/* REQ-260630 — 담당자 (teacher assignee). Local teacher pool. */}
              <div className="col-span-2">
                <label className={labelClass}>
                  {t('field.assignee', '담당자')}
                </label>
                <select {...register('evtAssigneeTchId')} className={inputClass}>
                  <option value="">— {t('field.assigneeNone', '미지정')} —</option>
                  {teachers.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                      {tt.email ? ` (${tt.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.startAt')} *</label>
                <input
                  type="datetime-local"
                  {...register('evtStartAt', { required: true })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t('field.endAt')} *</label>
                <input
                  type="datetime-local"
                  {...register('evtEndAt', { required: true })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('field.locationText')}</label>
              <input {...register('evtLocationText')} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('field.description')}</label>
              <textarea
                {...register('evtDescription')}
                rows={3}
                className={inputClass + ' h-auto py-2'}
              />
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3" disabled={isReadOnly}>
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionMeeting')}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.meetingProvider')}</label>
                <select {...register('evtMeetingProvider')} className={inputClass}>
                  {CAL_PROVIDERS.map((p) => (
                    <option key={p} value={p}>{t(`provider.${p}`)}</option>
                  ))}
                </select>
              </div>
              {meetingProvider !== 'NONE' && (
                <div>
                  <label className={labelClass}>{t('field.meetingUrl')} *</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    {...register('evtMeetingUrl')}
                    className={inputClass}
                  />
                </div>
              )}
            </div>
            {meetingProvider !== 'NONE' && (
              <p className="text-xs text-secondary">{t('hint.meetingUrl')}</p>
            )}
          </fieldset>

          {/* BODA(보다에듀) 룸 상태 — REQ-260526 v2 T7 (admin only on edit) */}
          {isEdit && meetingProvider === 'BODASCHOOL' && initial && (
            <BodaRoomPanel evtId={initial.id} />
          )}

          {/* Creator + Assignee meta (edit mode only) */}
          {isEdit && (detail?.ownerName || initial?.ownerName) && (
            <div className="rounded-md bg-[var(--canvas-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-xs text-secondary space-y-1">
              <div>
                <span className="font-semibold text-primary">
                  {t('field.creator', '작성자')}:
                </span>{' '}
                {detail?.ownerName ?? initial?.ownerName}
                {(detail?.ownerEmail || initial?.ownerEmail) && (
                  <span className="ml-1 text-secondary">
                    &lt;{detail?.ownerEmail ?? initial?.ownerEmail}&gt;
                  </span>
                )}
              </div>
              {/* REQ-260630 — 담당자 separately from 작성자 / 참석자. */}
              {(detail?.assigneeName ?? initial?.assigneeName) && (
                <div>
                  <span className="font-semibold text-primary">
                    {t('field.assignee', '담당자')}:
                  </span>{' '}
                  {detail?.assigneeName ?? initial?.assigneeName}
                  {(detail?.assigneeEmail ?? initial?.assigneeEmail) && (
                    <span className="ml-1 text-secondary">
                      &lt;{detail?.assigneeEmail ?? initial?.assigneeEmail}&gt;
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Attendees */}
          <fieldset
            className="rounded-md border border-[var(--border-subtle)] p-4 space-y-2"
            disabled={isReadOnly}
          >
            <legend className="text-xs font-semibold text-secondary px-1">
              {t('form.sectionAttendees', '참석자')} ({invitees.length})
            </legend>
            {invitees.length === 0 && (
              <p className="text-xs text-secondary">
                {t('invitee.empty', '아직 참석자가 없습니다.')}
              </p>
            )}
            <ul className="flex flex-wrap gap-1.5">
              {invitees.map((inv) => {
                const k = `${inv.kind}:${inv.refId}`;
                const badgeColor =
                  inv.notifyStatus === 'SENT'
                    ? 'bg-green-100 text-green-700'
                    : inv.notifyStatus === 'FAILED'
                      ? 'bg-red-100 text-red-700'
                      : inv.notifyStatus?.startsWith('SKIPPED')
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700';
                return (
                  <li
                    key={k}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--canvas-subtle)] border border-[var(--border-subtle)] text-xs"
                  >
                    <span
                      className={`text-[9px] font-mono uppercase px-1 py-0.5 rounded ${
                        inv.kind === 'STUDENT'
                          ? 'bg-blue-100 text-blue-700'
                          : inv.kind === 'TEACHER'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {inv.kind[0]}
                    </span>
                    <span className="text-primary">{inv.name}</span>
                    {inv.notifyStatus && (
                      <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${badgeColor}`}>
                        {inv.notifyStatus}
                      </span>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() =>
                          setInvitees((prev) =>
                            prev.filter((x) => `${x.kind}:${x.refId}` !== k),
                          )
                        }
                        className="text-secondary hover:text-danger-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {!isReadOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                {t('invitee.addBtn', '참석자 추가')}
              </Button>
            )}
          </fieldset>

          {/* Notify summary toast (after submit) */}
          {notifySummary && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
              {t('invitee.notifyResult', '알림 결과')}: SENT {notifySummary.sent} · SKIP_NO_EMAIL{' '}
              {notifySummary.skippedNoEmail} · SKIP_NO_SMTP {notifySummary.skippedNoSmtp} · FAIL{' '}
              {notifySummary.failed}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter className="flex justify-between">
            <div>
              {isEdit && !isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  disabled={isLoading}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {t('common:actions.delete')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                {t('common:actions.cancel')}
              </Button>
              {!isReadOnly && (
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading ? t('common:actions.saving') : t('common:actions.save')}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      <InviteePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(picked: InviteeCandidate[]) => {
          setInvitees((prev) => {
            const seen = new Set(prev.map((p) => `${p.kind}:${p.refId}`));
            const merged = [...prev];
            for (const c of picked) {
              const k = `${c.kind}:${c.refId}`;
              if (!seen.has(k)) {
                merged.push({
                  kind: c.kind,
                  refId: c.refId,
                  name: c.name,
                  email: c.email,
                  notifyStatus: null,
                });
              }
            }
            return merged;
          });
        }}
        excludeKeys={new Set(invitees.map((i) => `${i.kind}:${i.refId}`))}
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// BODA(보다에듀) room status panel — REQ-260526 v2 T7 admin
// ---------------------------------------------------------------------

function BodaRoomPanel({ evtId }: { evtId: string }) {
  const { t } = useTranslation('cal');
  const { data, isLoading, error, refetch } = useBodaRoomStatus(evtId);
  const closeMut = useBodaForceClose(evtId);
  const reconMut = useBodaReconcile(evtId);

  if (isLoading) {
    return (
      <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-2">
        <legend className="text-xs font-semibold text-secondary px-1">
          {t('boda.sectionTitle', 'BODA 화상 강의실')}
        </legend>
        <p className="text-xs text-secondary">{t('common:status.loading')}</p>
      </fieldset>
    );
  }

  // 404 means the room row hasn't been provisioned yet (event was created
  // before BODA was wired in, or the provider was just switched). Show a
  // helpful note instead of crashing.
  const status404 =
    error &&
    (error as { response?: { status?: number } }).response?.status === 404;
  if (status404 || !data) {
    return (
      <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-2">
        <legend className="text-xs font-semibold text-secondary px-1">
          {t('boda.sectionTitle', 'BODA 화상 강의실')}
        </legend>
        <p className="text-xs text-secondary">
          {t('boda.notProvisioned', '아직 BODA 룸이 생성되지 않았습니다.')}
        </p>
      </fieldset>
    );
  }

  const badgeFor = (s: string) => {
    switch (s) {
      case 'OPEN':
      case 'STARTED':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'PAUSED':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'PENDING':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'ENDED':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CLOSED':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const isClosed = data.status === 'CLOSED';
  const isLive =
    data.status === 'OPEN' ||
    data.status === 'STARTED' ||
    data.status === 'PAUSED';

  return (
    <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
      <legend className="text-xs font-semibold text-secondary px-1">
        {t('boda.sectionTitle', 'BODA 화상 강의실')}
      </legend>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-secondary">{t('boda.status', '상태')}:</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${badgeFor(
            data.status,
          )}`}
        >
          {t(`boda.statusValue.${data.status}`, data.status)}
        </span>
        <button
          type="button"
          onClick={() => refetch()}
          className="ml-auto text-[11px] text-accent-600 hover:underline"
        >
          {t('common:actions.refresh', '새로고침')}
        </button>
      </div>

      {/* Timestamps */}
      <ul className="text-[11px] text-secondary space-y-0.5 grid grid-cols-2 gap-x-3">
        {data.openedAt && (
          <li>
            <span className="font-mono">{t('boda.openedAt', '개설')}:</span>{' '}
            {new Date(data.openedAt).toLocaleString()}
          </li>
        )}
        {data.startedAt && (
          <li>
            <span className="font-mono">{t('boda.startedAt', '시작')}:</span>{' '}
            {new Date(data.startedAt).toLocaleString()}
          </li>
        )}
        {data.endedAt && (
          <li>
            <span className="font-mono">{t('boda.endedAt', '종료')}:</span>{' '}
            {new Date(data.endedAt).toLocaleString()}
          </li>
        )}
        {data.closedAt && (
          <li>
            <span className="font-mono">{t('boda.closedAt', '폐쇄')}:</span>{' '}
            {new Date(data.closedAt).toLocaleString()}
          </li>
        )}
      </ul>

      {/* Admin actions */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={reconMut.isPending}
          onClick={() => reconMut.mutate()}
        >
          {reconMut.isPending
            ? t('common:status.loading')
            : t('boda.reconcileBtn', '출결 재동기화')}
        </Button>
        {!isClosed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={closeMut.isPending}
            onClick={() => {
              if (isLive && !confirm(t('boda.confirmForceClose', '진행 중인 룸을 강제 폐쇄하시겠습니까?'))) {
                return;
              }
              closeMut.mutate();
            }}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            {closeMut.isPending
              ? t('common:status.loading')
              : t('boda.forceCloseBtn', '강제 폐쇄')}
          </Button>
        )}
      </div>

      {/* Result toasts */}
      {reconMut.data && (
        <p className="text-[11px] text-blue-700">
          {t('boda.reconcileResult', '재동기화 완료')}: +{reconMut.data.inserted} /
          ~{reconMut.data.updated}
        </p>
      )}
      {closeMut.data && (
        <p className="text-[11px] text-red-700">
          {t('boda.forceCloseResult', '폐쇄 완료')} → {closeMut.data.status}
        </p>
      )}
      {(reconMut.error || closeMut.error) && (
        <p className="text-[11px] text-red-600">
          {((reconMut.error || closeMut.error) as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('common:status.error')}
        </p>
      )}
    </fieldset>
  );
}
