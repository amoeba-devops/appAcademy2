import { useEffect, useState } from 'react';
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
  // REQ-260626
  testType: LevelTestType | null;
  testTypeOther: string | null;
  scheduledTime: string | null;
  scoreDetail: Record<string, unknown> | null;
  resultEnteredBy: string | null;
  resultEnteredAt: string | null;
}

const FEE_STATUSES = ['PAID', 'UNPAID', 'WAIVED'] as const;
const WAIVER_REASONS = [
  'RETAKE_WITHIN_90D',
  'TRIAL_PROMOTION',
  'SISTER_ACADEMY_TRANSFER',
  'OTHER',
] as const;
const SCHEDULE_STATUSES = ['SCHEDULED', 'TAKEN', 'NOT_TAKING', 'RESCHEDULED'] as const;
const LEVEL_TEST_TYPES = [
  'MAP', 'ISEE', 'SSAT', 'DUOLINGO', 'TOEFL', 'TOEFL_JR', 'OTHER',
] as const;
type LevelTestType = (typeof LEVEL_TEST_TYPES)[number];

/** 30-min slots 09:00 ~ 22:30 — same shape as the demo class picker. */
const LEVEL_TEST_TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 9; h <= 22; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`);
    out.push(`${String(h).padStart(2, '0')}:30`);
  }
  return out;
})();

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
  // REQ-260626
  testType: LevelTestType;
  testTypeOther: string;
  scheduledTime: string;
  scoreDetailJson: string;
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
      testType: 'MAP',
      testTypeOther: '',
      scheduledTime: '',
      scoreDetailJson: '',
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
        testType: data.testType ?? 'MAP',
        testTypeOther: data.testTypeOther ?? '',
        scheduledTime: data.scheduledTime?.slice(0, 5) ?? '',
        scoreDetailJson: data.scoreDetail
          ? JSON.stringify(data.scoreDetail, null, 2)
          : '',
      });
    }
  }, [data, reset]);

  const testType = watch('testType');

  function toBody(v: FormValues) {
    // REQ-260626 — scoreDetail textarea is type-tolerant: an invalid JSON
    // payload is sent as-is and rejected by the server validator (DSN §5.6)
    // instead of silently swallowing the operator's input.
    let scoreDetail: unknown = undefined;
    if (v.scoreDetailJson.trim()) {
      try {
        scoreDetail = JSON.parse(v.scoreDetailJson);
      } catch {
        scoreDetail = { _raw: v.scoreDetailJson };
      }
    }
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
      // REQ-260626
      testType: v.testType,
      testTypeOther: v.testTypeOther || undefined,
      scheduledTime: v.scheduledTime || undefined,
      scoreDetail,
    };
  }

  /**
   * REQ-260626 FR-CSL-115 / Q-CSL-111 — operator-only result recording.
   * Distinct from the regular PUT/save so the server-side admin gate
   * applies cleanly and the actor/at timestamps land on the row.
   */
  const recordResult = useMutation({
    mutationFn: async (v: FormValues) => {
      let scoreDetail: unknown = undefined;
      if (v.scoreDetailJson.trim()) {
        try {
          scoreDetail = JSON.parse(v.scoreDetailJson);
        } catch {
          throw new Error('scoreDetail JSON 형식이 올바르지 않습니다');
        }
      }
      await apiClient.post(`/acm/csl/inquiries/${inqId}/map-test/result`, {
        testType: v.testType,
        scoreReading: v.scoreReading ? Number(v.scoreReading) : undefined,
        scoreMath: v.scoreMath ? Number(v.scoreMath) : undefined,
        scoreLanguage: v.scoreLanguage ? Number(v.scoreLanguage) : undefined,
        scoreDetail,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'map-test', inqId] }),
  });

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

        {/*
          REQ-260626 SCR-CSL-02 (FR-CSL-111~115). MAP_TEST stage shows:
          test type select, schedule (date + 30-min time), optional
          freetext (for OTHER), and the score detail block. fee/waiver/
          scheduledStatus are DEPRECATED (FR-CSL-106/107) — kept in DB
          for back-compat but never re-written from this UI.
        */}
        {!isIntake && (
          <>
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <Field label={t('detail.mapTest.testType')}>
                <Select {...register('testType')}>
                  {LEVEL_TEST_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {t(`detail.mapTest.type.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              {testType === 'OTHER' && (
                <Field label={t('detail.mapTest.testTypeOther')}>
                  <Input
                    {...register('testTypeOther')}
                    placeholder={t('detail.mapTest.testTypeOtherPlaceholder')}
                  />
                </Field>
              )}
            </div>

            <div className="grid grid-cols-[1fr_140px] gap-3">
              <Field label={t('detail.mapTest.scheduledAt')}>
                <Input type="date" {...register('scheduledAt')} />
              </Field>
              <Field label={t('detail.mapTest.scheduledTime')}>
                <Select {...register('scheduledTime')}>
                  <option value="">—</option>
                  {LEVEL_TEST_TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {testType !== 'MAP' && (
              <Field label={t('detail.mapTest.scoreDetail')}>
                <textarea
                  {...register('scoreDetailJson')}
                  rows={6}
                  className="min-h-[120px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 font-mono text-xs"
                  placeholder={t('detail.mapTest.scoreDetailPlaceholder')}
                />
                <p className="text-[11px] text-secondary">
                  {t('detail.mapTest.scoreDetailHint')}
                </p>
              </Field>
            )}
          </>
        )}

        {/*
          MAP score block — shown at INTAKE (prior score) and at MAP_TEST
          when testType === 'MAP'. Other test types use scoreDetailJson
          above instead of these dedicated columns.
        */}
        {(isIntake || testType === 'MAP') && (
          <>
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
          </>
        )}

        {isIntake && <TranscriptUploadStub />}

        {!isIntake && data?.resultEnteredAt && (
          <p className="text-[11px] text-secondary">
            {t('detail.mapTest.resultEntered', {
              when: new Date(data.resultEnteredAt).toLocaleString(),
            })}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant={isIntake && onAfterAdvance ? 'outline' : 'outline'}
            disabled={mutation.isPending || saveAndAdvance.isPending || recordResult.isPending}
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
          {!isIntake && (
            <Button
              type="button"
              onClick={handleSubmit((v) => recordResult.mutate(v))}
              disabled={recordResult.isPending || mutation.isPending}
            >
              {recordResult.isPending
                ? t('common:actions.saving')
                : t('detail.mapTest.recordResult')}
            </Button>
          )}
        </div>
        {(mutation.isError || saveAndAdvance.isError || recordResult.isError) && (
          <p className="text-xs text-red-600">
            {(
              (mutation.error ?? saveAndAdvance.error ?? recordResult.error) as {
                response?: { data?: { message?: string } };
              }
            )?.response?.data?.message ??
              ((mutation.error ?? saveAndAdvance.error ?? recordResult.error) as Error).message}
          </p>
        )}
      </form>

      {!isIntake && <ResultPdfDownload inqId={inqId} />}
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
 * REQ-260626 FR-CSL-116 / T-13 — level-test result PDF download.
 * Fetches the PDF binary via the apiClient (so the JWT cookie/header
 * is carried correctly), turns it into a blob URL, and triggers a
 * download. 404s when the level-test row hasn't been recorded yet
 * (operator sees the inline error).
 */
function ResultPdfDownload({ inqId }: { inqId: string }) {
  const { t } = useTranslation(['csl', 'common']);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function download() {
    setError(null);
    setPending(true);
    try {
      const res = await apiClient.get<Blob>(
        `/acm/csl/inquiries/${inqId}/map-test/result-pdf`,
        { responseType: 'blob' },
      );
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Try to recover filename from Content-Disposition; fall back to a
      // generic name. apiClient may expose raw headers as lower-case.
      const cd =
        (res.headers as Record<string, string | undefined> | undefined)?.[
          'content-disposition'
        ] ?? '';
      const match = /filename="?([^";]+)"?/.exec(cd);
      a.download = match ? decodeURIComponent(match[1]) : `level-test-${inqId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? 'PDF download failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
      <div>
        <p className="text-sm font-medium">{t('detail.mapTest.resultPdf')}</p>
        <p className="text-[11px] text-secondary">
          {t('detail.mapTest.resultPdfHint')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button type="button" variant="outline" onClick={download} disabled={pending}>
          {pending ? t('common:actions.loading') : t('detail.mapTest.downloadPdf')}
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
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
