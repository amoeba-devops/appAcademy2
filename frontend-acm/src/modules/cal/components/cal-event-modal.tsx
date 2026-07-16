import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Calendar, Clock, Copy, LogIn, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { FilePreviewDialog } from '@/modules/csl/components/file-preview-dialog';
import {
  useCalEvent,
  useCreateCalEvent,
  useDeleteCalEvent,
  useUpdateCalEvent,
} from '../hooks/use-cal-events';
import {
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
import { useBodaForceClose, useBodaReconcile } from '@/lib/boda-admin-api';

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: CalEvent;
  defaultDate?: Date;
}

const CAL_EDITOR_CATEGORIES = [
  'LEVEL_TEST',
  'DEMO_CLASS',
  'REGULAR_CLASS',
  'OTHER',
] as const;

type EditorCategory = (typeof CAL_EDITOR_CATEGORIES)[number];

type FormValues = {
  evtCategory: EditorCategory;
  evtTitle: string;
  evtDescription: string;
  evtStartAt: string;
  evtEndAt: string;
  evtAllDay: boolean;
  evtLocationText: string;
  evtMeetingProvider: string;
  evtMeetingUrl: string;
  evtAssigneeTchId: string;
};

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'mb-1 block text-xs text-secondary';
const dtInputClass =
  'h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

/**
 * PLN-260714 — 강사용 입장 URL. 런처(`/portal/classroom/:evtId`)에 `autoStart=1` 을
 * 붙이면 owner(강사)가 boda open 으로 자동 입장한다. (web-classroom-page AutoStartFx)
 */
export function teacherJoinUrl(launcherUrl: string): string {
  return launcherUrl + (launcherUrl.includes('?') ? '&' : '?') + 'autoStart=1';
}

// PLN-260714 — datetime-local 문자열("YYYY-MM-DDTHH:MM")을 날짜/시간으로 분리·결합.
const datePart = (s: string): string => (s ? s.slice(0, 10) : '');
const timePart = (s: string): string => (s && s.includes('T') ? s.slice(11, 16) : '');
const joinDateTime = (date: string, time: string): string =>
  date ? `${date}T${time || '00:00'}` : '';

export function CalEventModal({ open, onClose, initial, defaultDate }: Props) {
  const { t, i18n } = useTranslation('cal');
  const toast = useToast();
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);
  const [invitees, setInvitees] = useState<
    Array<{
      kind: 'STUDENT' | 'TEACHER' | 'PARENT';
      refId: string;
      name: string;
      email: string | null;
      notifyStatus?: string | null;
    }>
  >([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notifySummary, setNotifySummary] = useState<NotifySummary | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    mime: string;
    filename: string;
  } | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      evtCategory: 'REGULAR_CLASS',
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

  const editorCategory = watch('evtCategory');
  const meetingProvider = watch('evtMeetingProvider');
  const descriptionValue = watch('evtDescription');
  const startAtVal = watch('evtStartAt');
  const endAtVal = watch('evtEndAt');
  const allDayVal = watch('evtAllDay');

  // PLN-260714 — 분리된 날짜/시간 입력을 evtStartAt/evtEndAt(datetime-local)에 반영.
  const setStartDate = (d: string) =>
    setValue('evtStartAt', joinDateTime(d, timePart(startAtVal) || '09:00'));
  const setStartTime = (tm: string) =>
    setValue('evtStartAt', joinDateTime(datePart(startAtVal), tm));
  const setEndDate = (d: string) =>
    setValue('evtEndAt', joinDateTime(d, timePart(endAtVal) || '10:00'));
  const setEndTime = (tm: string) =>
    setValue('evtEndAt', joinDateTime(datePart(endAtVal), tm));
  const onAllDayToggle = (checked: boolean) => {
    setValue('evtAllDay', checked);
    if (checked) {
      // 종일: 시작 00:00 / 종료 23:59 로 고정 (시간 입력 숨김)
      if (datePart(startAtVal)) setValue('evtStartAt', joinDateTime(datePart(startAtVal), '00:00'));
      if (datePart(endAtVal)) setValue('evtEndAt', joinDateTime(datePart(endAtVal), '23:59'));
    }
  };

  // 소요시간 라벨 (종료-시작)
  const durationLabel = (() => {
    if (!startAtVal || !endAtVal) return '';
    const ms = new Date(endAtVal).getTime() - new Date(startAtVal).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const mins = Math.round(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return t('hint.durationHm', { h, m, defaultValue: '{{h}}시간 {{m}}분' });
    if (h > 0) return t('hint.durationH', { h, defaultValue: '{{h}}시간' });
    return t('hint.durationM', { m, defaultValue: '{{m}}분' });
  })();

  // 요일/전체 날짜 라벨 (시작 기준)
  const weekdayLabel = (() => {
    if (!startAtVal) return '';
    const d = new Date(startAtVal);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).format(d);
  })();
  const isLevelTest = editorCategory === 'LEVEL_TEST';
  const isBodaCategory =
    editorCategory === 'DEMO_CLASS' || editorCategory === 'REGULAR_CLASS';

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
        evtCategory: normalizeEditorCategory(initial.category),
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
        (initial.invitees ?? []).map((invitee: CalInviteeView) => ({
          kind: invitee.kind,
          refId: invitee.refId,
          name: invitee.name,
          email: invitee.email,
          notifyStatus: invitee.notifyStatus,
        })),
      );
    } else {
      const { start, end } = defaultEventTimes(defaultDate ?? new Date());
      reset({
        evtCategory: 'REGULAR_CLASS',
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

  useEffect(() => {
    if (!open || !detail) return;
    setInvitees(
      (detail.invitees ?? []).map((invitee: CalInviteeView) => ({
        kind: invitee.kind,
        refId: invitee.refId,
        name: invitee.name,
        email: invitee.email,
        notifyStatus: invitee.notifyStatus,
      })),
    );
  }, [open, detail]);

  const isReadOnly = isEdit && initial?.source !== 'MANUAL';
  const resolvedMeetingProvider =
    isBodaCategory ? 'BODASCHOOL' : isLevelTest ? 'NONE' : meetingProvider;
  const currentLink = detail?.meetingUrl ?? initial?.meetingUrl ?? '';

  const onSubmit = async (values: FormValues) => {
    setError(null);
    if (!values.evtTitle.trim()) {
      setError(t('error.titleRequired'));
      return;
    }
    if (!values.evtStartAt || !values.evtEndAt) {
      setError(t('error.timeRequired'));
      return;
    }

    const startIso = localInputToIso(values.evtStartAt);
    const endIso = localInputToIso(values.evtEndAt);
    if (new Date(endIso) <= new Date(startIso)) {
      setError(t('error.endBeforeStart'));
      return;
    }

    if (!isLevelTest && !isBodaCategory && values.evtMeetingProvider !== 'NONE') {
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
      evtMeetingProvider: resolvedMeetingProvider,
    };

    if (values.evtDescription) dto.evtDescription = values.evtDescription;
    if (values.evtLocationText) dto.evtLocationText = values.evtLocationText;
    if (!isLevelTest && !isBodaCategory && values.evtMeetingProvider !== 'NONE' && values.evtMeetingUrl) {
      dto.evtMeetingUrl = values.evtMeetingUrl;
    }
    if (isEdit) {
      dto.evtAssigneeTchId = values.evtAssigneeTchId || null;
    } else if (values.evtAssigneeTchId) {
      dto.evtAssigneeTchId = values.evtAssigneeTchId;
    }

    if (!isLevelTest) {
      dto.evtInvitees = invitees.map((invitee) => ({
        kind: invitee.kind,
        refId: invitee.refId,
      }));
    } else {
      dto.evtInvitees = [];
    }

    try {
      const saved = isEdit
        ? await updateMut.mutateAsync(dto)
        : await createMut.mutateAsync(dto);
      if (saved.notifySummary) {
        setNotifySummary(saved.notifySummary);
        setTimeout(() => onClose(), 2000);
      } else {
        onClose();
      }
    } catch (submissionError) {
      const msg = (
        submissionError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onDelete = async () => {
    if (!initial) return;
    if (!confirm(t('confirm.delete'))) return;
    try {
      await deleteMut.mutateAsync(initial.id);
      onClose();
    } catch (deleteError) {
      const msg = (
        deleteError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      setError(msg ?? t('common:status.error'));
    }
  };

  const onRegisterFeedback = async () => {
    const demoLink =
      detail?.cslLink?.kind === 'DEMO_CLASS' ? detail.cslLink : null;
    if (!demoLink) return;
    const body = descriptionValue.trim();
    if (!body) {
      toast.error('설명을 먼저 입력해 주세요.');
      return;
    }
    try {
      await apiClient.patch(
        `/acm/csl/inquiries/${demoLink.inqId}/trial-classes/${demoLink.refId}/feedback`,
        { body },
      );
      toast.success('강사 피드백으로 등록했습니다.');
    } catch (feedbackError) {
      const message = (
        feedbackError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(message ?? '피드백 등록에 실패했습니다.');
    }
  };

  const onPreviewAttachment = async (inqId: string, attId: string, filename: string, mime: string) => {
    try {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const { url } = await fetchCslAttachmentBlob(inqId, attId, filename);
      setPreview({ url, mime, filename });
    } catch (previewError) {
      const message = (
        previewError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(message ?? '자료 미리보기에 실패했습니다.');
    }
  };

  const onDownloadAttachment = async (inqId: string, attId: string, filename: string) => {
    try {
      const file = await fetchCslAttachmentBlob(inqId, attId, filename);
      const anchor = document.createElement('a');
      anchor.href = file.url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(file.url);
    } catch (downloadError) {
      const message = (
        downloadError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(message ?? '자료 다운로드에 실패했습니다.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {isReadOnly && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t('hint.readOnlySource')}
            </div>
          )}

          <fieldset
            className="space-y-3 rounded-md border border-[var(--border-subtle)] p-4"
            disabled={isReadOnly}
          >
            <div>
              <label className={labelClass}>{t('field.title')} *</label>
              <input {...register('evtTitle', { required: true })} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.category')}</label>
                <select {...register('evtCategory')} className={inputClass}>
                  {CAL_EDITOR_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {t(`category.${category}`, category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className={labelClass}>{t('field.assignee', '담당 강사')}</label>
                <select {...register('evtAssigneeTchId')} className={inputClass}>
                  <option value="">- {t('field.assigneeNone', '미지정')} -</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                      {teacher.email ? ` (${teacher.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 space-y-2 rounded-md border border-[var(--border-subtle)] p-3">
                {/* RHF 추적용 hidden 필드 — 분리 날짜/시간 입력이 setValue 로 갱신 */}
                <input type="hidden" {...register('evtStartAt')} />
                <input type="hidden" {...register('evtEndAt')} />

                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allDayVal}
                    onChange={(e) => onAllDayToggle(e.target.checked)}
                  />
                  {t('field.allDay')}
                </label>

                {/* 시작 날짜/시간 */}
                <div className="flex flex-wrap items-center gap-2">
                  <Calendar size={16} className="shrink-0 text-secondary" />
                  <input
                    type="date"
                    aria-label={t('field.startAt')}
                    value={datePart(startAtVal)}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={dtInputClass}
                  />
                  {!allDayVal && (
                    <>
                      <Clock size={16} className="shrink-0 text-secondary" />
                      <input
                        type="time"
                        aria-label={t('field.startAt')}
                        value={timePart(startAtVal)}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={dtInputClass}
                      />
                    </>
                  )}
                </div>

                {/* → 종료일 */}
                <div className="flex items-center gap-1 text-xs text-secondary">
                  <span aria-hidden>→</span>
                  {t('field.endDate', '종료일')}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Calendar size={16} className="shrink-0 text-secondary" />
                  <input
                    type="date"
                    aria-label={t('field.endAt')}
                    value={datePart(endAtVal)}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={dtInputClass}
                  />
                  {!allDayVal && (
                    <>
                      <Clock size={16} className="shrink-0 text-secondary" />
                      <input
                        type="time"
                        aria-label={t('field.endAt')}
                        value={timePart(endAtVal)}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={dtInputClass}
                      />
                      {durationLabel && (
                        <span className="text-xs text-secondary">· {durationLabel}</span>
                      )}
                    </>
                  )}
                </div>

                {weekdayLabel && (
                  <div className="text-xs text-secondary">{weekdayLabel}</div>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('field.locationText')}</label>
              <input {...register('evtLocationText')} className={inputClass} />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>{t('field.description')}</label>
              <textarea
                {...register('evtDescription')}
                rows={4}
                className={`${inputClass} h-auto py-2`}
              />
              {detail?.cslLink?.kind === 'DEMO_CLASS' && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onRegisterFeedback()}
                  >
                    {t('actions.registerFeedback', '피드백으로 등록')}
                  </Button>
                </div>
              )}
            </div>
          </fieldset>

          {!isLevelTest && (
            <fieldset className="space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
              <legend className="px-1 text-xs font-semibold text-secondary">
                {t('form.sectionMeeting', '화상수업')}
              </legend>

              {isBodaCategory ? (
                <div className="grid gap-3">
                  <p className="text-xs text-secondary">
                    {t(
                      'hint.bodaAuto',
                      '데모수업과 정규수업은 저장 시 보다스쿨 강의 입장 링크가 자동 생성됩니다.',
                    )}
                  </p>
                  <div>
                    <label className={labelClass}>
                      {t('field.meetingUrl', '강의 입장 링크')}
                    </label>
                    <input
                      value={currentLink}
                      readOnly
                      placeholder={t('hint.bodaPending', '저장 후 링크가 생성됩니다.')}
                      className={`${inputClass} bg-[var(--gray-50)]`}
                    />
                    {currentLink && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            window.open(
                              teacherJoinUrl(currentLink),
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                        >
                          <LogIn size={14} className="mr-1" />
                          {t('actions.enterLink', '입장링크')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard
                              ?.writeText(currentLink)
                              .then(() =>
                                toast.success(t('actions.copyLinkDone', '링크를 복사했습니다.')),
                              );
                          }}
                        >
                          <Copy size={14} className="mr-1" />
                          {t('actions.copyLink', '링크 복사')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t('field.meetingProvider')}</label>
                    <select {...register('evtMeetingProvider')} className={inputClass}>
                      {CAL_PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {t(`provider.${provider}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {meetingProvider !== 'NONE' && (
                    <div>
                      <label className={labelClass}>{t('field.meetingUrl')} *</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        {...register('evtMeetingUrl')}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {isEdit && resolvedMeetingProvider === 'BODASCHOOL' && initial && (
            <BodaRoomPanel evtId={initial.id} />
          )}

          {isEdit && (detail?.ownerName || initial?.ownerName) && (
            <div className="space-y-1 rounded-md border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] px-3 py-2 text-xs text-secondary">
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
              {(detail?.assigneeName ?? initial?.assigneeName) && (
                <div>
                  <span className="font-semibold text-primary">
                    {t('field.assignee', '담당 강사')}:
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

          {!isLevelTest && (
            <fieldset
              className="space-y-2 rounded-md border border-[var(--border-subtle)] p-4"
              disabled={isReadOnly}
            >
              <legend className="px-1 text-xs font-semibold text-secondary">
                {t('form.sectionAttendees', '참석자')} ({invitees.length})
              </legend>
              {invitees.length === 0 && (
                <p className="text-xs text-secondary">
                  {t('invitee.empty', '아직 참석자가 없습니다.')}
                </p>
              )}
              <ul className="flex flex-wrap gap-1.5">
                {invitees.map((invitee) => {
                  const key = `${invitee.kind}:${invitee.refId}`;
                  const badgeColor =
                    invitee.notifyStatus === 'SENT'
                      ? 'bg-green-100 text-green-700'
                      : invitee.notifyStatus === 'FAILED'
                        ? 'bg-red-100 text-red-700'
                        : invitee.notifyStatus?.startsWith('SKIPPED')
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-700';
                  return (
                    <li
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--canvas-subtle)] px-2 py-1 text-xs"
                    >
                      <span
                        className={`rounded px-1 py-0.5 text-[9px] font-mono uppercase ${
                          invitee.kind === 'STUDENT'
                            ? 'bg-blue-100 text-blue-700'
                            : invitee.kind === 'TEACHER'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {invitee.kind[0]}
                      </span>
                      <span className="text-primary">{invitee.name}</span>
                      {invitee.notifyStatus && (
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-medium ${badgeColor}`}
                        >
                          {invitee.notifyStatus}
                        </span>
                      )}
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            setInvitees((current) =>
                              current.filter((row) => `${row.kind}:${row.refId}` !== key),
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
                  <Plus className="mr-1 h-3 w-3" />
                  {t('invitee.addBtn', '참석자 추가')}
                </Button>
              )}
            </fieldset>
          )}

          {detail?.cslLink?.kind === 'DEMO_CLASS' && (
            <fieldset className="space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
              <legend className="px-1 text-xs font-semibold text-secondary">
                {t('field.materials', '데모수업 자료')}
              </legend>
              {detail.cslLink.attachments.length === 0 ? (
                <p className="text-xs text-secondary">등록된 자료가 없습니다.</p>
              ) : (
                <ul className="grid gap-2">
                  {detail.cslLink.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{attachment.filename}</span>
                      <span className="text-[11px] text-secondary">
                        {(Number(attachment.sizeBytes) / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void onPreviewAttachment(
                            detail.cslLink!.inqId,
                            attachment.id,
                            attachment.filename,
                            attachment.mime,
                          )
                        }
                      >
                        보기
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void onDownloadAttachment(
                            detail.cslLink!.inqId,
                            attachment.id,
                            attachment.filename,
                          )
                        }
                      >
                        다운로드
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}

          {notifySummary && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
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
                  className="border-red-200 text-red-600 hover:bg-red-50"
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
          setInvitees((current) => {
            const seen = new Set(current.map((invitee) => `${invitee.kind}:${invitee.refId}`));
            const merged = [...current];
            for (const candidate of picked) {
              const key = `${candidate.kind}:${candidate.refId}`;
              if (!seen.has(key)) {
                merged.push({
                  kind: candidate.kind,
                  refId: candidate.refId,
                  name: candidate.name,
                  email: candidate.email,
                  notifyStatus: null,
                });
              }
            }
            return merged;
          });
        }}
        excludeKeys={new Set(invitees.map((invitee) => `${invitee.kind}:${invitee.refId}`))}
      />

      <FilePreviewDialog
        open={!!preview}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && preview?.url) URL.revokeObjectURL(preview.url);
          if (!nextOpen) setPreview(null);
        }}
        title={preview?.filename ?? 'Preview'}
        src={preview?.url ?? null}
        mime={preview?.mime ?? null}
      />
    </Dialog>
  );
}

function BodaRoomPanel({ evtId }: { evtId: string }) {
  const { t } = useTranslation('cal');
  const { data, isLoading, error, refetch } = useBodaRoomStatus(evtId);
  const closeMut = useBodaForceClose(evtId);
  const reconMut = useBodaReconcile(evtId);

  if (isLoading) {
    return (
      <fieldset className="space-y-2 rounded-md border border-[var(--border-subtle)] p-4">
        <legend className="px-1 text-xs font-semibold text-secondary">
          {t('boda.sectionTitle', 'BODA 화상 강의실')}
        </legend>
        <p className="text-xs text-secondary">{t('common:status.loading')}</p>
      </fieldset>
    );
  }

  const status404 =
    error &&
    (error as { response?: { status?: number } }).response?.status === 404;
  if (status404 || !data) {
    return (
      <fieldset className="space-y-2 rounded-md border border-[var(--border-subtle)] p-4">
        <legend className="px-1 text-xs font-semibold text-secondary">
          {t('boda.sectionTitle', 'BODA 화상 강의실')}
        </legend>
        <p className="text-xs text-secondary">
          {t('boda.notProvisioned', '아직 BODA 룸이 생성되지 않았습니다.')}
        </p>
      </fieldset>
    );
  }

  const badgeFor = (status: string) => {
    switch (status) {
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
    data.status === 'OPEN' || data.status === 'STARTED' || data.status === 'PAUSED';

  return (
    <fieldset className="space-y-3 rounded-md border border-[var(--border-subtle)] p-4">
      <legend className="px-1 text-xs font-semibold text-secondary">
        {t('boda.sectionTitle', 'BODA 화상 강의실')}
      </legend>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-secondary">{t('boda.status', '상태')}:</span>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${badgeFor(
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

      <ul className="grid grid-cols-2 gap-x-3 space-y-0.5 text-[11px] text-secondary">
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
              if (
                isLive &&
                !confirm(t('boda.confirmForceClose', '진행 중인 룸을 강제 폐쇄하시겠습니까?'))
              ) {
                return;
              }
              closeMut.mutate();
            }}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {closeMut.isPending
              ? t('common:status.loading')
              : t('boda.forceCloseBtn', '강제 폐쇄')}
          </Button>
        )}
      </div>

      {reconMut.data && (
        <p className="text-[11px] text-blue-700">
          {t('boda.reconcileResult', '재동기화 완료')}: +{reconMut.data.inserted} /
          ~{reconMut.data.updated}
        </p>
      )}
      {closeMut.data && (
        <p className="text-[11px] text-red-700">
          {t('boda.forceCloseResult', '폐쇄 완료')} - {closeMut.data.status}
        </p>
      )}
      {(reconMut.error || closeMut.error) && (
        <p className="text-[11px] text-red-600">
          {(
            (reconMut.error || closeMut.error) as {
              response?: { data?: { message?: string } };
            }
          )?.response?.data?.message ?? t('common:status.error')}
        </p>
      )}
    </fieldset>
  );
}

function normalizeEditorCategory(category: string): EditorCategory {
  switch (category) {
    case 'LEVEL_TEST':
      return 'LEVEL_TEST';
    case 'DEMO_CLASS':
      return 'DEMO_CLASS';
    case 'REGULAR_CLASS':
      return 'REGULAR_CLASS';
    case 'OTHER':
      return 'OTHER';
    case 'MEETING':
      return 'DEMO_CLASS';
    case 'EVENT':
      return 'LEVEL_TEST';
    case 'PERSONAL':
      return 'OTHER';
    case 'CLASS':
    default:
      return 'REGULAR_CLASS';
  }
}

async function fetchCslAttachmentBlob(
  inqId: string,
  attId: string,
  fallbackName: string,
): Promise<{ filename: string; url: string }> {
  const res = await apiClient.get<Blob>(
    `/acm/csl/inquiries/${inqId}/attachments/${attId}/download`,
    { responseType: 'blob' },
  );
  const contentDisposition =
    (res.headers as Record<string, string | undefined> | undefined)?.[
      'content-disposition'
    ] ?? '';
  const match = /filename\*?=(?:UTF-8'')?([^";]+)/i.exec(contentDisposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  return {
    filename,
    url: URL.createObjectURL(res.data),
  };
}
