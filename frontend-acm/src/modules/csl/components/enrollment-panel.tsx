import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Enrollment {
  id: string;
  paymentNoticeStatus: 'SENT' | 'PENDING' | 'NA' | null;
  counselDone: 'YES' | 'NO' | null;
  applied: boolean | null;
  paymentNoticeSent: 'YES' | 'NO' | null;
  classMinutes: number | null;
  tuitionAmount: string | null;
  tuitionPaid: boolean | null;
  classStartedAt: string | null;
  classStarted: 'YES' | 'NO' | null;
}

const NOTICE_STATUSES = ['SENT', 'PENDING', 'NA'] as const;
const YES_NO = ['YES', 'NO'] as const;

type FormValues = {
  paymentNoticeStatus: '' | (typeof NOTICE_STATUSES)[number];
  counselDone: '' | (typeof YES_NO)[number];
  applied: boolean;
  paymentNoticeSent: '' | (typeof YES_NO)[number];
  classMinutes: string;
  tuitionAmount: string;
  tuitionPaid: boolean;
  classStartedAt: string;
  classStarted: '' | (typeof YES_NO)[number];
};

export function EnrollmentPanel({ inqId }: { inqId: string }) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['csl', 'enrollment', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Enrollment | null>(
        `/acm/csl/inquiries/${inqId}/enrollment`,
      );
      return res.data;
    },
  });

  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      paymentNoticeStatus: '',
      counselDone: '',
      applied: false,
      paymentNoticeSent: '',
      classMinutes: '',
      tuitionAmount: '',
      tuitionPaid: false,
      classStartedAt: '',
      classStarted: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        paymentNoticeStatus: (data.paymentNoticeStatus ??
          '') as FormValues['paymentNoticeStatus'],
        counselDone: (data.counselDone ?? '') as FormValues['counselDone'],
        applied: data.applied ?? false,
        paymentNoticeSent: (data.paymentNoticeSent ??
          '') as FormValues['paymentNoticeSent'],
        classMinutes: data.classMinutes?.toString() ?? '',
        tuitionAmount: data.tuitionAmount ?? '',
        tuitionPaid: data.tuitionPaid ?? false,
        classStartedAt: data.classStartedAt ?? '',
        classStarted: (data.classStarted ?? '') as FormValues['classStarted'],
      });
    }
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const body = {
        paymentNoticeStatus: v.paymentNoticeStatus || undefined,
        counselDone: v.counselDone || undefined,
        applied: v.applied,
        paymentNoticeSent: v.paymentNoticeSent || undefined,
        classMinutes: v.classMinutes ? Number(v.classMinutes) : undefined,
        tuitionAmount: v.tuitionAmount ? Number(v.tuitionAmount) : undefined,
        tuitionPaid: v.tuitionPaid,
        classStartedAt: v.classStartedAt || undefined,
        classStarted: v.classStarted || undefined,
      };
      const res = await apiClient.put(`/acm/csl/inquiries/${inqId}/enrollment`, body);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'enrollment', inqId] }),
  });

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t('detail.enrollment.title')}</h2>

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="grid gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('detail.enrollment.counselDone')}>
            <Select {...register('counselDone')}>
              <option value="">{t('common:dash')}</option>
              {YES_NO.map((s) => (
                <option key={s} value={s}>
                  {t(`yesNo.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('detail.enrollment.paymentNoticeStatus')}>
            <Select {...register('paymentNoticeStatus')}>
              <option value="">{t('common:dash')}</option>
              {NOTICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`detail.enrollment.notice.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm pt-5">
            <input type="checkbox" {...register('applied')} />
            {t('detail.enrollment.applied')}
          </label>
          <Field label={t('detail.enrollment.paymentNoticeSent')}>
            <Select {...register('paymentNoticeSent')}>
              <option value="">{t('common:dash')}</option>
              {YES_NO.map((s) => (
                <option key={s} value={s}>
                  {t(`yesNo.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('detail.enrollment.classMinutes')}>
            <Input type="number" min={1} {...register('classMinutes')} />
          </Field>
          <Field label={t('detail.enrollment.tuitionAmount')}>
            <Input
              type="number"
              min={0}
              max={50000000}
              {...register('tuitionAmount')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Field label={t('detail.enrollment.classStartedAt')}>
            <Input type="date" {...register('classStartedAt')} />
          </Field>
          <Field label={t('detail.enrollment.classStarted')}>
            <Select {...register('classStarted')}>
              <option value="">{t('common:dash')}</option>
              {YES_NO.map((s) => (
                <option key={s} value={s}>
                  {t(`yesNo.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm h-9 px-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800">
            <input type="checkbox" {...register('tuitionPaid')} />
            {t('detail.enrollment.tuitionPaid')}
          </label>
        </div>
        <p className="text-[11px] text-secondary -mt-1">
          {t('detail.enrollment.tuitionPaidHint')}
        </p>

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
