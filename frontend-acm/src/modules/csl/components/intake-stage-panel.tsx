import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AttachmentPanel } from './attachment-panel';

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
  sourceSite?: 'TPI' | 'TRINITY' | 'SANTACROCE' | null;
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

type IseeSection = {
  scaled?: number;
  percentile?: number;
  stanine?: number;
};

type IseeIntakeScores = Partial<
  Record<'verbal' | 'reading' | 'quantitative' | 'mathematics', IseeSection>
>;

type SsatSection = {
  score?: number;
  percentile?: number;
};

type SsatIntakeScores = Partial<
  Record<'verbal' | 'quantitative' | 'reading' | 'total', SsatSection>
>;

type DuolingoIntakeScores = Partial<
  Record<
    | 'total'
    | 'speaking'
    | 'writing'
    | 'reading'
    | 'listening'
    | 'production'
    | 'literacy'
    | 'comprehension'
    | 'conversation',
    number
  >
>;

type ToeflIntakeScores = Partial<
  Record<'total' | 'reading' | 'listening' | 'speaking' | 'writing', number>
>;

type SatIntakeScores = Partial<Record<'rw' | 'math' | 'total', number>>;

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
  const [ssatIntake, setSsatIntake] = useState<SsatIntakeScores>({});
  const [duolingoIntake, setDuolingoIntake] = useState<DuolingoIntakeScores>({});
  const [toeflIntake, setToeflIntake] = useState<ToeflIntakeScores>({});
  const [satIntake, setSatIntake] = useState<SatIntakeScores>({});
  const [otherTestsText, setOtherTestsText] = useState('');

  useEffect(() => {
    if (mt) {
      setScoreReading(mt.scoreReading?.toString() ?? '');
      setScoreMath(mt.scoreMath?.toString() ?? '');
      setScoreLanguage(mt.scoreLanguage?.toString() ?? '');
      const det = (mt.priorScoresDetail ?? {}) as {
        iseeIntake?: IseeIntakeScores;
        ssatIntake?: SsatIntakeScores;
        duolingoIntake?: DuolingoIntakeScores;
        toeflIntake?: ToeflIntakeScores;
        satIntake?: SatIntakeScores;
        otherTestsText?: string;
        priorAdvanced?: { testName?: string; scores?: Record<string, unknown> };
      };
      setIseeIntake(det.iseeIntake ?? {});
      setSsatIntake(det.ssatIntake ?? {});
      setDuolingoIntake(det.duolingoIntake ?? {});
      setToeflIntake(det.toeflIntake ?? {});
      setSatIntake(det.satIntake ?? {});
      setOtherTestsText(
        det.otherTestsText ??
          (det.priorAdvanced
            ? [
                det.priorAdvanced.testName,
                det.priorAdvanced.scores
                  ? JSON.stringify(det.priorAdvanced.scores)
                  : null,
              ]
                .filter(Boolean)
                .join('\n')
            : ''),
      );
    }
  }, [mt]);

  const save = useMutation({
    mutationFn: async (opts: { advance: boolean }) => {
      const priorScoresDetail: Record<string, unknown> = {};
      if (hasMeaningfulValue(iseeIntake))
        priorScoresDetail.iseeIntake = iseeIntake;
      if (hasMeaningfulValue(ssatIntake))
        priorScoresDetail.ssatIntake = ssatIntake;
      if (hasMeaningfulValue(duolingoIntake))
        priorScoresDetail.duolingoIntake = duolingoIntake;
      if (hasMeaningfulValue(toeflIntake))
        priorScoresDetail.toeflIntake = toeflIntake;
      if (hasMeaningfulValue(satIntake))
        priorScoresDetail.satIntake = satIntake;
      if (otherTestsText.trim())
        priorScoresDetail.otherTestsText = otherTestsText.trim();

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
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-secondary">
                  <th className="text-left py-1 w-28">Section</th>
                  <th className="text-left py-1">Scaled</th>
                  <th className="text-left py-1">Percentile</th>
                  <th className="text-left py-1">Stanine</th>
                </tr>
              </thead>
              <tbody>
                {(['verbal', 'reading', 'quantitative', 'mathematics'] as const).map(
                  (k) => {
                    const row = iseeIntake[k] ?? {};
                    return (
                      <tr key={k} className="border-t border-[var(--border-subtle)]">
                        <td className="py-1.5 font-medium capitalize">{k}</td>
                        <td className="py-1">
                          <Input
                            type="number"
                            placeholder="Scaled"
                            value={row.scaled?.toString() ?? ''}
                            onChange={(e) =>
                              setIseeIntake({
                                ...iseeIntake,
                                [k]: {
                                  ...row,
                                  scaled: emptyToNumber(e.target.value),
                                },
                              })
                            }
                          />
                        </td>
                        <td className="py-1">
                          <Input
                            type="number"
                            placeholder="Percentile"
                            value={row.percentile?.toString() ?? ''}
                            onChange={(e) =>
                              setIseeIntake({
                                ...iseeIntake,
                                [k]: {
                                  ...row,
                                  percentile: emptyToNumber(e.target.value),
                                },
                              })
                            }
                          />
                        </td>
                        <td className="py-1">
                          <Input
                            type="number"
                            placeholder="Stanine"
                            value={row.stanine?.toString() ?? ''}
                            onChange={(e) =>
                              setIseeIntake({
                                ...iseeIntake,
                                [k]: {
                                  ...row,
                                  stanine: emptyToNumber(e.target.value),
                                },
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
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
            <div className="grid gap-4">
              <StructuredSection title="SSAT">
                <div className="grid grid-cols-4 gap-3">
                  {(['verbal', 'quantitative', 'reading', 'total'] as const).map((key) => {
                    const row = ssatIntake[key] ?? {};
                    return (
                      <div key={key} className="grid gap-2">
                        <Label className="text-[11px] capitalize">{key}</Label>
                        <Input
                          type="number"
                          placeholder="Score"
                          value={row.score?.toString() ?? ''}
                          onChange={(e) =>
                            setSsatIntake({
                              ...ssatIntake,
                              [key]: {
                                ...row,
                                score: emptyToNumber(e.target.value),
                              },
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Percentile"
                          value={row.percentile?.toString() ?? ''}
                          onChange={(e) =>
                            setSsatIntake({
                              ...ssatIntake,
                              [key]: {
                                ...row,
                                percentile: emptyToNumber(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </StructuredSection>

              <StructuredSection title="Duolingo">
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      'total',
                      'speaking',
                      'writing',
                      'reading',
                      'listening',
                      'production',
                      'literacy',
                      'comprehension',
                      'conversation',
                    ] as const
                  ).map((key) => (
                    <Field key={key} label={capitalize(key)}>
                      <Input
                        type="number"
                        value={duolingoIntake[key]?.toString() ?? ''}
                        onChange={(e) =>
                          setDuolingoIntake({
                            ...duolingoIntake,
                            [key]: emptyToNumber(e.target.value),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </StructuredSection>

              <StructuredSection title="TOEFL">
                <div className="grid grid-cols-5 gap-3">
                  {(['total', 'reading', 'listening', 'speaking', 'writing'] as const).map(
                    (key) => (
                      <Field key={key} label={capitalize(key)}>
                        <Input
                          type="number"
                          value={toeflIntake[key]?.toString() ?? ''}
                          onChange={(e) =>
                            setToeflIntake({
                              ...toeflIntake,
                              [key]: emptyToNumber(e.target.value),
                            })
                          }
                        />
                      </Field>
                    ),
                  )}
                </div>
              </StructuredSection>

              <StructuredSection title="SAT">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Reading & Writing">
                    <Input
                      type="number"
                      value={satIntake.rw?.toString() ?? ''}
                      onChange={(e) =>
                        setSatIntake({
                          ...satIntake,
                          rw: emptyToNumber(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Math">
                    <Input
                      type="number"
                      value={satIntake.math?.toString() ?? ''}
                      onChange={(e) =>
                        setSatIntake({
                          ...satIntake,
                          math: emptyToNumber(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Total">
                    <Input
                      type="number"
                      value={satIntake.total?.toString() ?? ''}
                      onChange={(e) =>
                        setSatIntake({
                          ...satIntake,
                          total: emptyToNumber(e.target.value),
                        })
                      }
                    />
                  </Field>
                </div>
              </StructuredSection>

              <Field
                label={t('detail.intake.otherTestsText', {
                  defaultValue: '기타 시험 / 메모',
                })}
              >
                <textarea
                  className="min-h-[88px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 text-sm"
                  placeholder={t('detail.intake.otherTestsPlaceholder', {
                    defaultValue: 'AP / IB / PSAT 등 기타 점수를 자유 텍스트로 입력',
                  })}
                  value={otherTestsText}
                  onChange={(e) => setOtherTestsText(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>
        )}
      </div>

      {/* 4. Transcript upload — T-06 / ADR-008 (presigned PUT to MinIO/S3) */}
      <AttachmentPanel inqId={inqId} category="TRANSCRIPT" />


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
          value={
            inq.sourceSite
              ? `${t(`inflow.${inq.inflowType}`)} (${t(`sourceSite.${inq.sourceSite}`)})`
              : t(`inflow.${inq.inflowType}`)
          }
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

function StructuredSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3">
      <div className="text-xs font-semibold text-secondary mb-3">{title}</div>
      {children}
    </div>
  );
}

function emptyToNumber(value: string): number | undefined {
  return value ? Number(value) : undefined;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((entry) =>
      hasMeaningfulValue(entry),
    );
  }
  return false;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
