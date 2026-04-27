import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MapTest {
  id: string;
  hasPriorScore: boolean | null;
  feeStatus: 'PAID' | 'UNPAID' | 'WAIVED' | null;
  waiverReason: string | null;
  waiverNote: string | null;
  scheduledAt: string | null;
  scheduledStatus: 'SCHEDULED' | 'TAKEN' | 'NOT_TAKING' | 'RESCHEDULED' | null;
  scoreReading: number | null;
  scoreMath: number | null;
  scoreLanguage: number | null;
}

const FEE_STATUSES = ['PAID', 'UNPAID', 'WAIVED'] as const;
const WAIVER_REASONS = [
  'RETAKE_WITHIN_90D',
  'TRIAL_PROMOTION',
  'SISTER_ACADEMY_TRANSFER',
  'OTHER',
] as const;
const SCHEDULE_STATUSES = ['SCHEDULED', 'TAKEN', 'NOT_TAKING', 'RESCHEDULED'] as const;

type FormValues = {
  hasPriorScore: boolean;
  feeStatus: '' | (typeof FEE_STATUSES)[number];
  waiverReason: '' | (typeof WAIVER_REASONS)[number];
  waiverNote: string;
  scheduledAt: string;
  scheduledStatus: '' | (typeof SCHEDULE_STATUSES)[number];
  scoreReading: string;
  scoreMath: string;
  scoreLanguage: string;
};

export function MapTestPanel({ inqId }: { inqId: string }) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['csl', 'map-test', inqId],
    queryFn: async () => {
      const res = await apiClient.get<MapTest | null>(
        `/acm/csl/inquiries/${inqId}/map-test`,
      );
      return res.data;
    },
  });

  const { register, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: {
      hasPriorScore: false,
      feeStatus: '',
      waiverReason: '',
      waiverNote: '',
      scheduledAt: '',
      scheduledStatus: '',
      scoreReading: '',
      scoreMath: '',
      scoreLanguage: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        hasPriorScore: data.hasPriorScore ?? false,
        feeStatus: (data.feeStatus ?? '') as FormValues['feeStatus'],
        waiverReason: (data.waiverReason ?? '') as FormValues['waiverReason'],
        waiverNote: data.waiverNote ?? '',
        scheduledAt: data.scheduledAt ?? '',
        scheduledStatus: (data.scheduledStatus ?? '') as FormValues['scheduledStatus'],
        scoreReading: data.scoreReading?.toString() ?? '',
        scoreMath: data.scoreMath?.toString() ?? '',
        scoreLanguage: data.scoreLanguage?.toString() ?? '',
      });
    }
  }, [data, reset]);

  const feeStatus = watch('feeStatus');

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        hasPriorScore: v.hasPriorScore,
        feeStatus: v.feeStatus || undefined,
        waiverReason: v.waiverReason || undefined,
        waiverNote: v.waiverNote || undefined,
        scheduledAt: v.scheduledAt || undefined,
        scheduledStatus: v.scheduledStatus || undefined,
        scoreReading: v.scoreReading ? Number(v.scoreReading) : undefined,
        scoreMath: v.scoreMath ? Number(v.scoreMath) : undefined,
        scoreLanguage: v.scoreLanguage ? Number(v.scoreLanguage) : undefined,
      };
      const res = await apiClient.put(`/acm/csl/inquiries/${inqId}/map-test`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'map-test', inqId] }),
  });

  return (
    <Panel title={t('detail.mapTest.title')}>
      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="grid gap-3"
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('hasPriorScore')} />
          {t('detail.mapTest.hasPriorScore')}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('detail.mapTest.feeStatus')}>
            <Select {...register('feeStatus')}>
              <option value="">{t('common:dash')}</option>
              {FEE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`detail.mapTest.fee.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          {feeStatus === 'WAIVED' && (
            <Field label={t('detail.mapTest.waiverReason')}>
              <Select {...register('waiverReason')}>
                <option value="">{t('common:dash')}</option>
                {WAIVER_REASONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`detail.mapTest.waiver.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {feeStatus === 'WAIVED' && (
          <Field label={t('detail.mapTest.waiverNote')}>
            <Input {...register('waiverNote')} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('detail.mapTest.scheduledAt')}>
            <Input type="date" {...register('scheduledAt')} />
          </Field>
          <Field label={t('detail.mapTest.scheduledStatus')}>
            <Select {...register('scheduledStatus')}>
              <option value="">{t('common:dash')}</option>
              {SCHEDULE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`detail.mapTest.schedule.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Label className="mt-2">{t('detail.mapTest.scores')}</Label>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('detail.mapTest.scoreReading')}>
            <Input
              type="number"
              min={100}
              max={300}
              {...register('scoreReading')}
            />
          </Field>
          <Field label={t('detail.mapTest.scoreMath')}>
            <Input type="number" min={100} max={300} {...register('scoreMath')} />
          </Field>
          <Field label={t('detail.mapTest.scoreLanguage')}>
            <Input
              type="number"
              min={100}
              max={300}
              {...register('scoreLanguage')}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">
            {(mutation.error as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? (mutation.error as Error).message}
          </p>
        )}
      </form>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
    />
  );
}
