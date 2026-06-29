import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * REQ-260626 SCR-CSL-01 v2 (DSN-260629) — INTAKE stage panel.
 *
 * Three blocks stacked vertically:
 *   1. IntakeReadOnlyBox     — operator review of all intake fields
 *   2. ApplyPurposesEditor   — multi-select; PATCH /inquiries/:id when changed
 *   3. PriorScoresEditor     — score inputs DYNAMIC per selected purpose:
 *        - MAP_TEST_TUTORING       → Reading/Math/Language Usage (100~350)
 *        - ISEE_TUTORING           → 4 sections × Scaled (760~940) only
 *        - Advanced Courses        → testName freetext + JSONB scores
 *        - International / GPA mgmt → no score inputs
 *   4. TranscriptUploadStub  — T-06 dependency
 *   5. Save + Save-and-advance buttons
 *
 * Read-only fields and the "다음 단계" shortcut keep parity with the
 * existing FIX-260624 patron pattern.
 */

const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;
type ApplyPurpose = (typeof APPLY_PURPOSES)[number];

interface Inquiry {
  id: string;
  seqNo: number | string;
  studentName: string;
  isAnonymous: boolean;
  parentName: string | null;
  parentPhone: string | null;
  phoneStatus: 'PROVIDED' | 'DECLINED' | 'UNKNOWN' | null;
  schoolFreetext: string | null;
  grade: string | null;
  inflowType: string;
  applyType: string;
  applyPurposes: ApplyPurpose[];
  consultDone: 'YES' | 'NO' | null;
  registeredAt: string | null;
}

interface MapTest {
  id: string;
  hasPriorScore: boolean | null;
  scoreReading: number | null;
  scoreMath: number | null;
  scoreLanguage: number | null;
  priorScoresDetail: Record<string, unknown> | null;
}

interface IseeIntakeScores {
  verbal?: number;
  reading?: number;
  quantitative?: number;
  mathematics?: number;
}
interface PriorAdvanced {
  testName?: string;
  scores?: Record<string, string>;
}

export function IntakeStagePanel({
  inqId,
  onAfterAdvance,
}: {
  inqId: string;
  onAfterAdvance?: () => void;
}) {
  const { t, i18n } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();

  const { data: inq } = useQuery({
    queryKey: ['csl', 'detail', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Inquiry>(`/acm/csl/inquiries/${inqId}`);
      return res.data;
    },
  });

  const { data: mt } = useQuery({
    queryKey: ['csl', 'map-test', inqId],
    queryFn: async () => {
      const res = await apiClient.get<MapTest | null>(
        `/acm/csl/inquiries/${inqId}/map-test`,
      );
      return res.data;
    },
  });

  // ── form state (controlled, not react-hook-form — small/atomic) ──────
  const [scoreReading, setScoreReading] = useState<string>('');
  const [scoreMath, setScoreMath] = useState<string>('');
  const [scoreLanguage, setScoreLanguage] = useState<string>('');
  const [iseeIntake, setIseeIntake] = useState<IseeIntakeScores>({});
  const [priorAdvanced, setPriorAdvanced] = useState<PriorAdvanced>({});

  useEffect(() => {
    if (mt) {
      setScoreReading(mt.scoreReading?.toString() ?? '');
      setScoreMath(mt.scoreMath?.toString() ?? '');
      setScoreLanguage(mt.scoreLanguage?.toString() ?? '');
      const det = (mt.priorScoresDetail ?? {}) as {
        iseeIntake?: IseeIntakeScores;
        priorAdvanced?: PriorAdvanced;
      };
      setIseeIntake(det.iseeIntake ?? {});
      setPriorAdvanced(det.priorAdvanced ?? {});
    }
  }, [mt]);

  const save = useMutation({
    mutationFn: async (opts: { advance: boolean }) => {
      const priorScoresDetail: Record<string, unknown> = {};
      if (Object.keys(iseeIntake).length > 0)
        priorScoresDetail.iseeIntake = iseeIntake;
      if (priorAdvanced.testName || priorAdvanced.scores)
        priorScoresDetail.priorAdvanced = priorAdvanced;

      await apiClient.put(`/acm/csl/inquiries/${inqId}/map-test`, {
        scoreReading: scoreReading ? Number(scoreReading) : undefined,
        scoreMath: scoreMath ? Number(scoreMath) : undefined,
        scoreLanguage: scoreLanguage ? Number(scoreLanguage) : undefined,
        priorScoresDetail,
      });
      return opts.advance;
    },
    onSuccess: (advance) => {
      qc.invalidateQueries({ queryKey: ['csl', 'map-test', inqId] });
      if (advance) onAfterAdvance?.();
    },
  });

  if (!inq) {
    return (
      <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
        <p className="text-sm text-secondary">{t('common:status.loading')}</p>
      </section>
    );
  }

  const purposes = new Set<ApplyPurpose>(inq.applyPurposes ?? []);
  const showMap = purposes.has('MAP_TEST_TUTORING');
  const showIsee = purposes.has('ISEE_TUTORING');
  const showAdvanced = purposes.has('ADVANCED_COURSES');

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5 grid gap-5">
      <h2 className="text-base font-semibold">{t('detail.intake.title')}</h2>

      {/* 1. Read-only intake info */}
      <IntakeReadOnlyBox inq={inq} locale={i18n.language ?? 'ko'} />

      {/* 2. Apply purposes (editable) */}
      <ApplyPurposesEditor inqId={inqId} inq={inq} />

      {/* 3. Dynamic prior-score inputs */}
      <div className="grid gap-4">
        <Label className="text-sm font-semibold">
          {t('detail.intake.priorScoresHeader')}
        </Label>
        {!showMap && !showIsee && !showAdvanced && (
          <p className="text-[11px] text-secondary">
            {t('detail.intake.noPurposeScoreHint')}
          </p>
        )}

        {showMap && (
          <fieldset className="border border-[var(--border-subtle)] rounded-md p-3 grid gap-2">
            <legend className="text-xs font-medium px-1">
              {t('detail.intake.mapScores')}
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {/* English-fixed labels per FR-CSL-102 */}
              <Field label="Reading">
                <Input
                  type="number"
                  min={100}
                  max={350}
                  placeholder="100~350"
                  value={scoreReading}
                  onChange={(e) => setScoreReading(e.target.value)}
                />
              </Field>
              <Field label="Math">
                <Input
                  type="number"
                  min={100}
                  max={350}
                  placeholder="100~350"
                  value={scoreMath}
                  onChange={(e) => setScoreMath(e.target.value)}
                />
              </Field>
              <Field label="Language Usage">
                <Input
                  type="number"
                  min={100}
                  max={350}
                  placeholder="100~350"
                  value={scoreLanguage}
                  onChange={(e) => setScoreLanguage(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>
        )}

        {showIsee && (
          <fieldset className="border border-[var(--border-subtle)] rounded-md p-3 grid gap-2">
            <legend className="text-xs font-medium px-1">
              {t('detail.intake.iseeIntakeHeader')}
            </legend>
            <p className="text-[11px] text-secondary">
              {t('detail.intake.iseeIntakeHint')}
            </p>
            <div className="grid grid-cols-4 gap-3">
              {(['verbal', 'reading', 'quantitative', 'mathematics'] as const).map(
                (k) => (
                  <Field key={k} label={capitalize(k)}>
                    <Input
                      type="number"
                      min={760}
                      max={940}
                      placeholder="760~940"
                      value={iseeIntake[k]?.toString() ?? ''}
                      onChange={(e) => {
                        const n = e.target.value
                          ? Number(e.target.value)
                          : undefined;
                        setIseeIntake({ ...iseeIntake, [k]: n });
                      }}
                    />
                  </Field>
                ),
              )}
            </div>
          </fieldset>
        )}

        {showAdvanced && (
          <fieldset className="border border-[var(--border-subtle)] rounded-md p-3 grid gap-2">
            <legend className="text-xs font-medium px-1">
              {t('detail.intake.advancedHeader')}
            </legend>
            <p className="text-[11px] text-secondary">
              {t('detail.intake.advancedHint')}
            </p>
            <div className="grid grid-cols-[160px_1fr] gap-3">
              <Field label={t('detail.intake.advancedTestName')}>
                <Input
                  placeholder="SSAT / Duolingo / TOEFL / ..."
                  value={priorAdvanced.testName ?? ''}
                  onChange={(e) =>
                    setPriorAdvanced({ ...priorAdvanced, testName: e.target.value })
                  }
                />
              </Field>
              <Field label={t('detail.intake.advancedScoresLabel')}>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 font-mono text-xs"
                  placeholder={t('detail.intake.advancedScoresPlaceholder')}
                  value={JSON.stringify(priorAdvanced.scores ?? {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setPriorAdvanced({ ...priorAdvanced, scores: parsed });
                    } catch {
                      // Allow free typing; only commit on valid JSON
                    }
                  }}
                />
              </Field>
            </div>
          </fieldset>
        )}
      </div>

      {/* 4. Transcript upload stub (T-06 dependency) */}
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

      {/* 5. Save + advance */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => save.mutate({ advance: false })}
          disabled={save.isPending}
        >
          {save.isPending ? t('common:actions.saving') : t('common:actions.save')}
        </Button>
        {onAfterAdvance && (
          <Button
            type="button"
            onClick={() => save.mutate({ advance: true })}
            disabled={save.isPending}
          >
            {save.isPending
              ? t('common:actions.saving')
              : t('detail.mapTest.saveAndAdvance')}
          </Button>
        )}
      </div>
      {save.isError && (
        <p className="text-xs text-red-600">
          {(save.error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? (save.error as Error).message}
        </p>
      )}
    </section>
  );
}

// ── sub-components ──────────────────────────────────────────────────────

function IntakeReadOnlyBox({
  inq,
  locale,
}: {
  inq: Inquiry;
  locale: string;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const dateLocale =
    ({ ko: 'ko-KR', en: 'en-US', vi: 'vi-VN', 'zh-CN': 'zh-CN' } as Record<string, string>)[
      locale
    ] ?? 'ko-KR';
  const registered = inq.registeredAt
    ? new Date(inq.registeredAt).toLocaleDateString(dateLocale)
    : '—';

  return (
    <div className="rounded-md bg-[var(--surface-strong)] p-3 grid gap-2 text-sm">
      <div className="text-xs font-semibold text-secondary">
        {t('detail.intake.readOnlyHeader')}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <Row label={t('detail.intake.field.student')} value={inq.studentName} />
        <Row
          label={t('detail.intake.field.grade')}
          value={inq.grade ? t(`grade.${inq.grade}`, inq.grade) : '—'}
        />
        <Row label={t('detail.intake.field.parentName')} value={inq.parentName ?? '—'} />
        <Row
          label={t('detail.intake.field.parentPhone')}
          value={inq.parentPhone ?? '—'}
          extra={
            inq.phoneStatus ? `(${t(`phoneStatus.${inq.phoneStatus}`)})` : null
          }
        />
        <Row label={t('detail.intake.field.school')} value={inq.schoolFreetext ?? '—'} />
        <Row
          label={t('detail.intake.field.inflowType')}
          value={t(`inflow.${inq.inflowType}`)}
        />
        <Row
          label={t('detail.intake.field.applyType')}
          value={t(`applyType.${inq.applyType}`)}
        />
        <Row
          label={t('detail.intake.field.consultDone')}
          value={inq.consultDone ? t(`yesNo.${inq.consultDone}`) : '—'}
        />
        <Row label={t('detail.intake.field.registeredAt')} value={registered} />
        <Row
          label={t('detail.intake.field.isAnonymous')}
          value={inq.isAnonymous ? t('yesNo.YES') : t('yesNo.NO')}
        />
      </div>
    </div>
  );
}

function ApplyPurposesEditor({
  inqId,
  inq,
}: {
  inqId: string;
  inq: Inquiry;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ApplyPurpose[]>(inq.applyPurposes ?? []);

  useEffect(() => {
    setDraft(inq.applyPurposes ?? []);
  }, [inq.applyPurposes]);

  const mutate = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/acm/csl/inquiries/${inqId}`, {
        applyPurposes: draft,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl', 'detail', inqId] });
      setEditing(false);
    },
  });

  function toggle(p: ApplyPurpose): void {
    setDraft((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          {t('detail.intake.applyPurposesHeader')}
        </Label>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            {t('common:actions.edit')}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(inq.applyPurposes ?? []);
                setEditing(false);
              }}
              className="text-xs text-secondary hover:underline"
            >
              {t('common:actions.cancel')}
            </button>
            <button
              type="button"
              onClick={() => mutate.mutate()}
              disabled={mutate.isPending}
              className="text-xs text-primary hover:underline"
            >
              {t('common:actions.save')}
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-1.5 rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-2">
        {APPLY_PURPOSES.map((p) => {
          const checked = (editing ? draft : inq.applyPurposes ?? []).includes(p);
          return (
            <label
              key={p}
              className={`flex items-center gap-2 text-sm ${
                editing ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={checked}
                disabled={!editing}
                onChange={() => editing && toggle(p)}
              />
              {t(`applyPurpose.${p}`)}
            </label>
          );
        })}
      </div>
      {mutate.isError && (
        <p className="text-xs text-red-600">
          {(mutate.error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? (mutate.error as Error).message}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string | null;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-1 items-baseline">
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-sm">
        {value}
        {extra && <span className="ml-1 text-[11px] text-secondary">{extra}</span>}
      </span>
    </div>
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
