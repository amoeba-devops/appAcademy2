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

const LVL_EXAM_TYPES = ['ISEE_LEVEL_TEST', 'SSAT_LEVEL_TEST', 'OTHER'] as const;
const GRADE_BASES = ['TARGET_GRADE', 'CURRENT_GRADE'] as const;
const RESOURCE_TYPES = ['DRIVE_FOLDER', 'EXTERNAL_LINK', 'INTERNAL_DOC'] as const;

const schema = z.object({
  examType: z.enum(LVL_EXAM_TYPES),
  gradeBasis: z.enum(GRADE_BASES),
  assignmentRuleText: z.string().optional().or(z.literal('')),
  resourceUrl: z.string().url().optional().or(z.literal('')),
  resourceType: z.enum(RESOURCE_TYPES).default('EXTERNAL_LINK'),
  resourceNote: z.string().optional().or(z.literal('')),
  defaultDurationMin: z.coerce.number().int().min(1).optional(),
  effectiveFrom: z.string().min(1, { message: 'ref:validation.required' }),
  procedureSteps: z
    .array(
      z.object({
        step_num: z.coerce.number().int().min(1),
        description: z.string().min(1).max(1000),
      }),
    )
    .min(1, { message: 'ref:validation.required' }),
});

type FormInput = z.infer<typeof schema>;

export function LevelTestCreateDialog() {
  const { t } = useTranslation(['ref', 'common']);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      examType: 'ISEE_LEVEL_TEST',
      gradeBasis: 'TARGET_GRADE',
      resourceType: 'EXTERNAL_LINK',
      effectiveFrom: today,
      procedureSteps: [{ step_num: 1, description: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'procedureSteps' });

  const mutation = useMutation({
    mutationFn: async (payload: FormInput) => {
      const body = {
        ...payload,
        assignmentRuleText: payload.assignmentRuleText || undefined,
        resourceUrl: payload.resourceUrl || undefined,
        resourceNote: payload.resourceNote || undefined,
      };
      const res = await apiClient.post('/acm/ref/level-test-guides', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref', 'levelTests'] });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('tabs.levelTests')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('form.examType')}</Label>
              <select
                {...register('examType')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              >
                {LVL_EXAM_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`lvlExamType.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.gradeBasis')}</Label>
              <select
                {...register('gradeBasis')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              >
                {GRADE_BASES.map((v) => (
                  <option key={v} value={v}>
                    {t(`gradeBasis.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.resourceType')}</Label>
              <select
                {...register('resourceType')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              >
                {RESOURCE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`resourceType.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.defaultDurationMin')}</Label>
              <Input type="number" {...register('defaultDurationMin')} />
            </div>
            <div className="col-span-2">
              <Label>{t('form.resourceUrl')}</Label>
              <Input {...register('resourceUrl')} placeholder="https://..." />
              {errors.resourceUrl && (
                <p className="text-xs text-rose-600 mt-1">
                  {tr(errors.resourceUrl.message)}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label>{t('form.resourceNote')}</Label>
              <Input {...register('resourceNote')} />
            </div>
            <div className="col-span-2">
              <Label>{t('form.assignmentRuleText')}</Label>
              <textarea
                {...register('assignmentRuleText')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
                rows={2}
              />
            </div>
            <div>
              <Label>{t('form.effectiveFrom')}</Label>
              <Input type="date" {...register('effectiveFrom')} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t('form.procedureSteps')}</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ step_num: fields.length + 1, description: '' })
                }
              >
                {t('actions.addStep')}
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    type="number"
                    {...register(`procedureSteps.${i}.step_num`)}
                    className="col-span-2"
                  />
                  <Input
                    {...register(`procedureSteps.${i}.description`)}
                    className="col-span-9"
                    placeholder={t('form.description')}
                  />
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
