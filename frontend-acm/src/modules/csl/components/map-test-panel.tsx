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

/**
 * REQ-260626 SCR-CSL-01/02 — MAP/level test panel.
 *
 * The same panel renders for two stages because the underlying row
 * (amb_acm_csl_map_test) is the same:
 *   - INTAKE  → "prior score" sub-view (FR-CSL-102): R/M/L English labels,
 *               100~350, transcript upload stub (T-06), "Save & advance to
 *               레벨테스트" shortcut. Fee/schedule/result fields are HIDDEN
 *               (per FR-CSL-106/107 — moved to stage 2).
 *   - MAP_TEST → full level-test view (legacy fields kept until T-15
 *               rework lands; T-13 PDF + T-08 CAL link still pending).
 */
export function MapTestPanel({
  inqId,
  currentStage,
  onAfterAdvance,
}: {
  inqId: string;
  currentStage?: 'INTAKE' | 'MAP_TEST';
  /** Forward to MAP_TEST stage after prior-score save. */
  onAfterAdvance?: (nextStage: 'MAP_TEST') => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const isIntake = currentStage === 'INTAKE';

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

  function toBody(v: FormValues) {
    return {
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
  }

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const res = await apiClient.put(
        `/acm/csl/inquiries/${inqId}/map-test`,
        toBody(v),
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'map-test', inqId] }),
  });

  /**
   * REQ-260626 FR-CSL-109 — INTAKE stage only. Saves the prior-score row
   * then asks the parent to forward to MAP_TEST. The backend assertEntryGate
   * lets INTAKE→MAP_TEST through unconditionally (MAP_TEST is a recording
   * stage), so this is just a UX shortcut.
   */
  const saveAndAdvance = useMutation({
    mutationFn: async (v: FormValues) => {
      await apiClient.put(`/acm/csl/inquiries/${inqId}/map-test`, toBody(v));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl', 'map-test', inqId] });
      onAfterAdvance?.('MAP_TEST');
    },
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

        {/* REQ-260626 FR-CSL-106/107 — fee/schedule are hidden at INTAKE
            (moved to SCR-CSL-02 stage 2). Kept visible at MAP_TEST for
            back-compat until T-15 rebuilds the level-test view. */}
        {!isIntake && (
          <>
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
          </>
        )}

        <Label className="mt-2">
          {isIntake ? t('detail.mapTest.priorScores') : t('detail.mapTest.scores')}
        </Label>
        {isIntake && (
          <p className="text-[11px] text-secondary -mt-2">
            {t('detail.mapTest.priorScoresHint')}
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          {/*
            FR-CSL-102 — Reading / Math / Language Usage labels are English-fixed
            across all locales (per requirement: 한국어 모드에서도 영문 표기).
          */}
          <Field label="Reading">
            <Input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              {...register('scoreReading')}
            />
          </Field>
          <Field label="Math">
            <Input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              {...register('scoreMath')}
            />
          </Field>
          <Field label="Language Usage">
            <Input
              type="number"
              min={100}
              max={350}
              placeholder="100~350"
              {...register('scoreLanguage')}
            />
          </Field>
        </div>

        {isIntake && <TranscriptUploadStub />}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant={isIntake && onAfterAdvance ? 'outline' : 'default'}
            disabled={mutation.isPending || saveAndAdvance.isPending}
          >
            {mutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
          {isIntake && onAfterAdvance && (
            <Button
              type="button"
              onClick={handleSubmit((v) => saveAndAdvance.mutate(v))}
              disabled={mutation.isPending || saveAndAdvance.isPending}
            >
              {saveAndAdvance.isPending
                ? t('common:actions.saving')
                : t('detail.mapTest.saveAndAdvance')}
            </Button>
          )}
        </div>
        {(mutation.isError || saveAndAdvance.isError) && (
          <p className="text-xs text-red-600">
            {(
              (mutation.error ?? saveAndAdvance.error) as {
                response?: { data?: { message?: string } };
              }
            )?.response?.data?.message ??
              ((mutation.error ?? saveAndAdvance.error) as Error).message}
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

/**
 * REQ-260626 FR-CSL-105 — multi-file transcript upload. Placeholder UI
 * until T-06 lands (S3 presigned POST + amb_acm_csl_attachment write).
 * Renders a disabled drop zone with a coming-soon note so operators see
 * the planned shape without being able to upload yet.
 */
function TranscriptUploadStub() {
  const { t } = useTranslation(['csl', 'common']);
  return (
    <div className="grid gap-1 rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--surface-strong)] px-3 py-3">
      <Label className="text-xs">{t('detail.mapTest.transcripts')}</Label>
      <p className="text-[11px] text-secondary">
        {t('detail.mapTest.transcriptsComingSoon')}
      </p>
      <input
        type="file"
        multiple
        disabled
        accept="application/pdf,image/jpeg,image/png"
        className="text-xs file:mr-2 file:cursor-not-allowed file:rounded file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-secondary opacity-60"
      />
    </div>
  );
}
