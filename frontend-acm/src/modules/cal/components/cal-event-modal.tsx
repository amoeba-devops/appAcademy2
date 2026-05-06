import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateCalEvent,
  useDeleteCalEvent,
  useUpdateCalEvent,
} from '../hooks/use-cal-events';
import {
  CAL_CATEGORIES,
  CAL_PROVIDERS,
  type CalEvent,
} from '../types';
import {
  defaultEventTimes,
  formatDateTimeLocal,
  localInputToIso,
} from '../lib/date-utils';

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
};

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function CalEventModal({ open, onClose, initial, defaultDate }: Props) {
  const { t } = useTranslation('cal');
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);

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
    },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
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
      });
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
      });
    }
  }, [open, initial, defaultDate, reset]);

  const createMut = useCreateCalEvent();
  const updateMut = useUpdateCalEvent(initial?.id ?? '');
  const deleteMut = useDeleteCalEvent();
  const isLoading = createMut.isPending || updateMut.isPending || deleteMut.isPending;
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

    try {
      if (isEdit) {
        await updateMut.mutateAsync(dto);
      } else {
        await createMut.mutateAsync(dto);
      }
      onClose();
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
    </Dialog>
  );
}
