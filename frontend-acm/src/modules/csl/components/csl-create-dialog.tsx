import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * INTAKE-stage create form per acm-req-csl-001 v2.1.
 * Validation messages use i18n keys; resolved at render time via tr().
 */
const phoneRegex = /^[0-9+\-() ]{7,20}$/;

const INFLOW_TYPES = ['HOMEPAGE', 'KAKAO_CHANNEL', 'PHONE'] as const;
const APPLY_TYPES = ['COUNSELING_ONLY', 'EXAM_ONLY', 'BOTH'] as const;
const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;
const PHONE_STATUSES = ['PROVIDED', 'DECLINED', 'UNKNOWN'] as const;
const YES_NO = ['YES', 'NO'] as const;
// REQ-260626 FR-CSL-104 / Q-CSL-105 — 초1~고3 전체 + 기타.
// (기존 코드는 초5~고3 만 — 초1~초4 학년의 인콰이어리 등록을 막고 있었음.)
const GRADES = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'M1', 'M2', 'M3',
  'H1', 'H2', 'H3',
  'OTHER',
] as const;

const cslCreateSchema = z
  .object({
    studentName: z.string().trim().max(50).optional().or(z.literal('')),
    isAnonymous: z.boolean().default(false),
    parentPhone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || phoneRegex.test(v), { message: 'csl:validation.phoneInvalid' }),
    parentName: z.string().trim().max(50).optional().or(z.literal('')),
    phoneStatus: z.enum(PHONE_STATUSES).default('UNKNOWN'),
    schoolFreetext: z.string().trim().max(100).optional().or(z.literal('')),
    schoolId: z.string().uuid().optional().or(z.literal('')),
    grade: z.enum(GRADES).optional(),
    inflowType: z.enum(INFLOW_TYPES),
    applyType: z.enum(APPLY_TYPES),
    applyPurposes: z.array(z.enum(APPLY_PURPOSES)).default([]),
    consultDone: z.enum(YES_NO).optional(),
    registeredAt: z.string().optional().or(z.literal('')),
    followupAt: z.string().optional().or(z.literal('')),
    followupMemo: z.string().max(2000).optional().or(z.literal('')),
  })
  .refine((d) => d.isAnonymous || !!(d.studentName && d.studentName.length > 0), {
    path: ['studentName'],
    message: 'csl:validation.studentNameOrAnonymous',
  })
  .refine((d) => !!(d.schoolId || (d.schoolFreetext && d.schoolFreetext.length > 0)), {
    path: ['schoolFreetext'],
    message: 'csl:validation.schoolRequired',
  })
  .refine((d) => d.phoneStatus !== 'PROVIDED' || !!d.parentPhone, {
    path: ['parentPhone'],
    message: 'csl:validation.phoneRequiredForProvided',
  });

type CslCreateInput = z.infer<typeof cslCreateSchema>;

export function CslCreateDialog() {
  const { t } = useTranslation(['csl', 'common']);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CslCreateInput>({
    resolver: zodResolver(cslCreateSchema),
    defaultValues: {
      isAnonymous: false,
      phoneStatus: 'UNKNOWN',
      inflowType: 'HOMEPAGE',
      applyType: 'COUNSELING_ONLY',
      applyPurposes: [],
    },
  });

  const isAnonymous = watch('isAnonymous');
  const applyPurposes = watch('applyPurposes');

  const mutation = useMutation({
    mutationFn: async (payload: CslCreateInput) => {
      const body = {
        studentName: payload.isAnonymous ? '익명' : (payload.studentName ?? ''),
        isAnonymous: payload.isAnonymous,
        parentPhone: payload.parentPhone || undefined,
        parentName: payload.parentName || undefined,
        phoneStatus: payload.phoneStatus,
        schoolFreetext: payload.schoolFreetext || undefined,
        schoolId: payload.schoolId || undefined,
        grade: payload.grade || undefined,
        inflowType: payload.inflowType,
        applyType: payload.applyType,
        applyPurposes: payload.applyPurposes.length ? payload.applyPurposes : undefined,
        consultDone: payload.consultDone || undefined,
        registeredAt: payload.registeredAt || undefined,
        followupAt: payload.followupAt || undefined,
        followupMemo: payload.followupMemo || undefined,
      };
      const res = await apiClient.post('/acm/csl/inquiries', body);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl', 'list'] });
      reset();
      setOpen(false);
    },
  });

  const onSubmit = handleSubmit((d) => mutation.mutate(d));

  const tr = (msg?: string): string | undefined => {
    if (!msg) return undefined;
    return msg.includes(':') || msg.includes('.') ? t(msg, { defaultValue: msg }) : msg;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('newInquiryShort')}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('newInquiry')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* Student name + anonymous */}
          <div className="grid gap-1">
            <div className="flex items-center justify-between">
              <Label>
                {t('form.studentName')}
                {!isAnonymous && <span className="text-red-600"> *</span>}
              </Label>
              <label className="flex items-center gap-2 text-xs text-secondary">
                <input type="checkbox" {...register('isAnonymous')} />
                {t('form.isAnonymous')}
              </label>
            </div>
            <Input
              {...register('studentName')}
              placeholder={t('form.studentNamePlaceholder')}
              disabled={isAnonymous}
            />
            {errors.studentName && (
              <p className="text-xs text-red-600">{tr(errors.studentName?.message as string)}</p>
            )}
          </div>

          {/* Phone + status */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <Field label={t('form.parentPhone')} error={tr(errors.parentPhone?.message as string)}>
              <Input {...register('parentPhone')} placeholder={t('form.parentPhonePlaceholder')} />
            </Field>
            <Field label={t('form.phoneStatus')}>
              <Select {...register('phoneStatus')}>
                {PHONE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`phoneStatus.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Parent name (optional, encrypted) */}
          <Field label={t('form.parentName')} error={tr(errors.parentName?.message as string)}>
            <Input
              {...register('parentName')}
              placeholder={t('form.parentNamePlaceholder')}
            />
          </Field>

          {/* School + grade */}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field
              label={`${t('form.school')} *`}
              error={tr(errors.schoolFreetext?.message as string)}
            >
              <Input {...register('schoolFreetext')} placeholder={t('form.schoolPlaceholder')} />
            </Field>
            <Field label={t('form.grade')}>
              <Select {...register('grade')}>
                <option value="">{t('common:dash')}</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {t(`grade.${g}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Inflow + apply type */}
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('form.inflowType')} *`}>
              <Select {...register('inflowType')}>
                {INFLOW_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(`inflow.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${t('form.applyType')} *`}>
              <Select {...register('applyType')}>
                {APPLY_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(`applyType.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Apply purpose — multi-select checkboxes */}
          <div className="grid gap-1">
            <Label>{t('form.applyPurpose')}</Label>
            <div className="grid gap-1.5 rounded-md border border-input bg-background px-3 py-2">
              {APPLY_PURPOSES.map((p) => {
                const checked = applyPurposes.includes(p);
                return (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...applyPurposes, p]
                          : applyPurposes.filter((v) => v !== p);
                        setValue('applyPurposes', next as typeof applyPurposes, {
                          shouldValidate: true,
                        });
                      }}
                    />
                    {t(`applyPurpose.${p}`)}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Consult done + registered + followup */}
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('form.consultDone')}>
              <Select {...register('consultDone')}>
                <option value="">{t('common:dash')}</option>
                {YES_NO.map((v) => (
                  <option key={v} value={v}>
                    {t(`yesNo.${v}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('form.registeredAt')}>
              <Input type="date" {...register('registeredAt')} />
            </Field>
            <Field label={t('form.followupAt')}>
              <Input type="date" {...register('followupAt')} />
            </Field>
          </div>

          <Field label={t('form.followupMemo')}>
            <textarea
              className="min-h-16 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-sm"
              {...register('followupMemo')}
            />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error)?.message ?? t('common:status.submitFailed')}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? t('common:actions.saving') : t('common:actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
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
