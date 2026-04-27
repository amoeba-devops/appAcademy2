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

const EXAM_TYPES = [
  'MAP_TEST',
  'SSAT',
  'ISEE',
  'WRITING_COMP',
  'SUMMER_CAMP',
  'JUNIOR_BOARDING',
  'BOARDING',
  'INTL_SCHOOL_APP',
  'OTHER',
] as const;

const STEP_ROLES = [
  'ADVISOR',
  'TEAM_LEAD',
  'TEACHER',
  'SENIOR_MANAGER',
  'ADMIN',
  'OTHER',
] as const;

const DATA_STATUSES = ['COMPLETE', 'PARTIAL', 'PLACEHOLDER'] as const;

const schema = z.object({
  code: z.string().regex(/^[A-Z0-9_]{3,50}$/, { message: 'ref:validation.codeFormat' }),
  examType: z.enum(EXAM_TYPES),
  labelKr: z.string().min(1, { message: 'ref:validation.required' }).max(200),
  labelEn: z.string().max(200).optional().or(z.literal('')),
  remark: z.string().optional().or(z.literal('')),
  dataStatus: z.enum(DATA_STATUSES).default('PLACEHOLDER'),
  effectiveFrom: z.string().min(1, { message: 'ref:validation.required' }),
  workflowSteps: z
    .array(
      z.object({
        step_num: z.coerce.number().int().min(1),
        role: z.enum(STEP_ROLES),
        description: z.string().min(1).max(1000),
      }),
    )
    .min(1, { message: 'ref:validation.required' }),
});

type FormInput = z.infer<typeof schema>;

export function GuidelineCreateDialog() {
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
      examType: 'MAP_TEST',
      dataStatus: 'PLACEHOLDER',
      effectiveFrom: today,
      workflowSteps: [{ step_num: 1, role: 'ADVISOR', description: '' }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'workflowSteps' });

  const mutation = useMutation({
    mutationFn: async (payload: FormInput) => {
      const body = {
        ...payload,
        labelEn: payload.labelEn || undefined,
        remark: payload.remark || undefined,
      };
      const res = await apiClient.post('/acm/ref/class-guidelines', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ref', 'guidelines'] });
      setOpen(false);
      reset();
    },
  });

  const tr = (key?: string) => (key ? t(key) : '');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('actions.create')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('tabs.guidelines')}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('form.code')}</Label>
              <Input {...register('code')} placeholder="MAP_PREP_L1" />
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
                {EXAM_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`examType.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.labelKr')}</Label>
              <Input {...register('labelKr')} />
              {errors.labelKr && (
                <p className="text-xs text-rose-600 mt-1">{tr(errors.labelKr.message)}</p>
              )}
            </div>
            <div>
              <Label>{t('form.labelEn')}</Label>
              <Input {...register('labelEn')} />
            </div>
            <div>
              <Label>{t('form.dataStatus')}</Label>
              <select
                {...register('dataStatus')}
                className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              >
                {DATA_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {t(`dataStatus.${v}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t('form.effectiveFrom')}</Label>
              <Input type="date" {...register('effectiveFrom')} />
            </div>
          </div>

          <div>
            <Label>{t('form.remark')}</Label>
            <textarea
              {...register('remark')}
              className="block w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>{t('form.workflowSteps')}</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ step_num: fields.length + 1, role: 'ADVISOR', description: '' })
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
                    {...register(`workflowSteps.${i}.step_num`)}
                    className="col-span-2"
                  />
                  <select
                    {...register(`workflowSteps.${i}.role`)}
                    className="col-span-3 rounded-md border border-[var(--border-subtle)] bg-surface px-2 py-2 text-sm"
                  >
                    {STEP_ROLES.map((v) => (
                      <option key={v} value={v}>
                        {t(`stepRole.${v}`)}
                      </option>
                    ))}
                  </select>
                  <Input
                    {...register(`workflowSteps.${i}.description`)}
                    className="col-span-6"
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
            {errors.workflowSteps && (
              <p className="text-xs text-rose-600 mt-1">
                {tr(errors.workflowSteps.message as string | undefined)}
              </p>
            )}
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
