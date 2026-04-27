import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const SBM_EXAM_TYPES = ['MAP', 'ISEE', 'SSAT'] as const;
const CURRICULA = ['UK_YEAR', 'US_GRADE', 'KOREAN', 'MIXED'] as const;
const STANINE_RE = /^\d(-\d)?$/;

const schema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]{3,50}$/, { message: 'ref:validation.codeFormat' }),
    examType: z.enum(SBM_EXAM_TYPES),
    levelLabel: z.string().min(1, { message: 'ref:validation.required' }).max(50),
    // MAP fields
    mapReadingScore: z.coerce.number().min(100).max(300).optional(),
    mapMathScore: z.coerce.number().min(100).max(300).optional(),
    mapNoUpperBound: z.boolean().default(false),
    // ISEE/SSAT fields
    generalPct: z.coerce.number().min(0).max(100).optional(),
    generalStanine: z
      .string()
      .regex(STANINE_RE, { message: 'ref:validation.stanineFormat' })
      .optional()
      .or(z.literal('')),
    premiumPrivatePct: z.coerce.number().min(0).max(100).optional(),
    premiumPrivateStanine: z
      .string()
      .regex(STANINE_RE, { message: 'ref:validation.stanineFormat' })
      .optional()
      .or(z.literal('')),
    topBoardingPct: z.coerce.number().min(0).max(100).optional(),
    topBoardingStanine: z
      .string()
      .regex(STANINE_RE, { message: 'ref:validation.stanineFormat' })
      .optional()
      .or(z.literal('')),
    effectiveFrom: z.string().min(1, { message: 'ref:validation.required' }),
    grades: z
      .array(
        z.object({
          gradeLabel: z.string().min(1).max(10),
          gradeMin: z.coerce.number().int().min(-2).max(12),
          gradeMax: z.coerce.number().int().min(-2).max(12),
          curriculumSystem: z.enum(CURRICULA).default('US_GRADE'),
        }),
      )
      .min(1, { message: 'ref:validation.required' }),
  })
  .refine((d) => d.grades.every((g) => g.gradeMin <= g.gradeMax), {
    path: ['grades'],
    message: 'ref:validation.required',
  });

type FormInput = z.infer<typeof schema>;

export function BenchmarkCreateDialog() {
  const { t } = useTranslation(['ref', 'common']);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      examType: 'MAP',
      mapNoUpperBound: false,
      effectiveFrom: today,
      grades: [{ gradeLabel: '5', gradeMin: 5, gradeMax: 5, curriculumSystem: 'US_GRADE' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'grades' });
  const examType = watch('examType');

  const mutation = useMutation({
    mutationFn: async (payload: FormInput) => {
      // Strip empty strings & exam-type-irrelevant fields
      const isMap = payload.examType === 'MAP';
      const body: Record<string, unknown> = {
        code: payload.code,
        examType: payload.examType,
        levelLabel: payload.levelLabel,
        effectiveFrom: payload.effectiveFrom,
        grades: payload.grades,
      };
      if (isMap) {
        body.mapReadingScore = payload.mapReadingScore;
        body.mapMathScore = payload.mapMathScore;
        body.mapNoUpperBound = payload.mapNoUpperBound;
      } else {
        body.generalPct = payload.generalPct;
        body.premiumPrivatePct = payload.premiumPrivatePct;
        body.topBoardingPct = payload.topBoardingPct;
        if (payload.examType === 'ISEE') {
          body.generalStanine = payload.generalStanine || undefined;
          body.premiumPrivateStanine = payload.premiumPrivateStanine || undefined;
          body.topBoardingStanine = payload.topBoardingStanine || undefined;
        }
      }
      const res = await apiClient.post('/acm/ref/score-benchmarks', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref', 'benchmarks'] });
      setOpen(false);
      reset();
    },
  });

  const tr = (k?: string) => (k ? t(k) : '');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('actions.create')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('tabs.benchmarks')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>{t('form.code')}</Label>
              <Input {...register('code')} placeholder="MAP_G5_TARGET" />
              {errors.code && (
                <p className="text-xs text-rose-600 mt-1">{tr(errors.code.message)}</p>
              )}
            </div>
            <div>
              <Label>{t('form.examType')}</Label>
              <select
                {...register('examType')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              >
                {SBM_EXAM_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`sbmExamType.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.level')}</Label>
              <Input {...register('levelLabel')} placeholder="L1" />
            </div>
            <div>
              <Label>{t('form.effectiveFrom')}</Label>
              <Input type="date" {...register('effectiveFrom')} />
            </div>
          </div>

          {examType === 'MAP' ? (
            <div className="rounded-md border border-[var(--border-subtle)] p-3">
              <p className="text-sm font-medium mb-2">MAP</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('form.mapReadingScore')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    {...register('mapReadingScore')}
                  />
                </div>
                <div>
                  <Label>{t('form.mapMathScore')}</Label>
                  <Input type="number" step="0.1" {...register('mapMathScore')} />
                </div>
                <label className="flex items-center gap-2 mt-6">
                  <input type="checkbox" {...register('mapNoUpperBound')} />
                  <span className="text-sm">{t('form.mapNoUpperBound')}</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border-subtle)] p-3 space-y-3">
              <p className="text-sm font-medium">{t(`sbmExamType.${examType}`)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('form.generalPct')}</Label>
                  <Input type="number" step="0.01" {...register('generalPct')} />
                </div>
                {examType === 'ISEE' && (
                  <div>
                    <Label>{`${t('form.stanine')} (General)`}</Label>
                    <Input {...register('generalStanine')} placeholder="5 or 5-7" />
                  </div>
                )}
                <div>
                  <Label>{t('form.premiumPrivatePct')}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('premiumPrivatePct')}
                  />
                </div>
                {examType === 'ISEE' && (
                  <div>
                    <Label>{`${t('form.stanine')} (Premium)`}</Label>
                    <Input {...register('premiumPrivateStanine')} />
                  </div>
                )}
                <div>
                  <Label>{t('form.topBoardingPct')}</Label>
                  <Input type="number" step="0.01" {...register('topBoardingPct')} />
                </div>
                {examType === 'ISEE' && (
                  <div>
                    <Label>{`${t('form.stanine')} (Top)`}</Label>
                    <Input {...register('topBoardingStanine')} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t('form.grades')}</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({
                    gradeLabel: '',
                    gradeMin: 0,
                    gradeMax: 0,
                    curriculumSystem: 'US_GRADE',
                  })
                }
              >
                {t('actions.addGrade')}
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    {...register(`grades.${i}.gradeLabel`)}
                    placeholder={t('form.gradeLabel')}
                    className="col-span-3"
                  />
                  <Input
                    type="number"
                    {...register(`grades.${i}.gradeMin`)}
                    placeholder={t('form.gradeMin')}
                    className="col-span-2"
                  />
                  <Input
                    type="number"
                    {...register(`grades.${i}.gradeMax`)}
                    placeholder={t('form.gradeMax')}
                    className="col-span-2"
                  />
                  <select
                    {...register(`grades.${i}.curriculumSystem`)}
                    className="col-span-4 rounded-md border border-[var(--border-subtle)] bg-surface px-2 py-2 text-sm"
                  >
                    {CURRICULA.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    className="col-span-1"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
