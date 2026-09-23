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
  INQUIRY_GENDERS,
  INQUIRY_KINDS,
  KIND_BADGE_CLASS,
} from '../lib/grade';
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
// REQ-260921B — 학년은 자유 입력(예: 중2, G10, 예비고1). 코드 셀렉트 제거.

const cslCreateSchema = z
  .object({
    studentNameEn: z.string().trim().max(120).optional(),
    studentName: z.string().trim().max(50).optional().or(z.literal('')),
    isAnonymous: z.boolean().default(false),
    parentPhone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || phoneRegex.test(v), { message: 'csl:validation.phoneInvalid' }),
    parentName: z.string().trim().max(50).optional().or(z.literal('')),
    // 요구 260914E — 학부모 이메일 (선택).
    parentEmail: z
      .string()
      .trim()
      .max(200)
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), {
        message: 'csl:validation.emailInvalid',
      }),
    phoneStatus: z.enum(PHONE_STATUSES).default('UNKNOWN'),
    schoolFreetext: z.string().trim().max(100).optional().or(z.literal('')),
    schoolId: z.string().uuid().optional().or(z.literal('')),
    grade: z.string().trim().max(40).optional().or(z.literal('')),
    // REQ-260921B — 구분·생년월일·성별
    kind: z.enum(INQUIRY_KINDS).default('TUTORING'),
    birthdate: z.string().optional().or(z.literal('')),
    gender: z.enum(INQUIRY_GENDERS).optional().or(z.literal('')),
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
  // REQ-260921B — 학교는 필수 아님(빈란 허용). 맵테스트 구분이면 생년월일 필수.
  .refine((d) => d.kind !== 'MAP_TEST' || !!d.birthdate, {
    path: ['birthdate'],
    message: 'csl:validation.birthdateRequiredForMapTest',
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
      kind: 'TUTORING',
      phoneStatus: 'UNKNOWN',
      inflowType: 'HOMEPAGE',
      applyType: 'COUNSELING_ONLY',
      applyPurposes: [],
    },
  });

  const isAnonymous = watch('isAnonymous');
  const applyPurposes = watch('applyPurposes');
  const kind = watch('kind');

  // REQ-260921B Q-1(A) — 맵테스트를 고르면 신청 유형을 '시험만' 으로 맞춘다(변경 가능).
  const selectKind = (next: (typeof INQUIRY_KINDS)[number]) => {
    setValue('kind', next, { shouldValidate: true });
    if (next === 'MAP_TEST') setValue('applyType', 'EXAM_ONLY');
    else if (watch('applyType') === 'EXAM_ONLY') setValue('applyType', 'COUNSELING_ONLY');
  };

  const mutation = useMutation({
    mutationFn: async (payload: CslCreateInput) => {
      const body = {
        studentName: payload.isAnonymous ? '익명' : (payload.studentName ?? ''),
        isAnonymous: payload.isAnonymous,
        parentPhone: payload.parentPhone || undefined,
        parentEmail: payload.parentEmail || undefined,
        studentNameEn: payload.studentNameEn || undefined,
        parentName: payload.parentName || undefined,
        phoneStatus: payload.phoneStatus,
        schoolFreetext: payload.schoolFreetext || undefined,
        schoolId: payload.schoolId || undefined,
        grade: payload.grade || undefined,
        kind: payload.kind,
        birthdate: payload.birthdate || undefined,
        gender: payload.gender || undefined,
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
          {/* REQ-260921B — 구분: 튜터링 상담 / 맵테스트 */}
          <div className="grid gap-1">
            <Label>{t('form.kind', '구분')} *</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('form.kind', '구분')}>
              {INQUIRY_KINDS.map((k) => (
                <label
                  key={k}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                    kind === k ? KIND_BADGE_CLASS[k] + ' font-medium' : 'border-[var(--border-subtle)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="kind"
                    className="accent-primary"
                    checked={kind === k}
                    onChange={() => selectKind(k)}
                  />
                  {t(`kind.${k}`)}
                </label>
              ))}
            </div>
          </div>

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

          {kind === 'MAP_TEST' && (
            <Field label={t('form.studentNameEn')} error={tr(errors.studentNameEn?.message as string)}>
              <Input {...register('studentNameEn')} maxLength={120} placeholder={t('form.studentNameEnPlaceholder')} className="placeholder:italic placeholder:text-gray-400" />
            </Field>
          )}
          {/* REQ-260921B — 생년월일 + 성별 */}
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <Field
              label={`${t('form.birthdate', '생년월일')}${kind === 'MAP_TEST' ? ' *' : ''}`}
              error={tr(errors.birthdate?.message as string)}
            >
              <Input type="date" {...register('birthdate')} />
            </Field>
            <Field label={t('form.gender', '성별')}>
              <Select {...register('gender')}>
                <option value="">{t('common:dash')}</option>
                {INQUIRY_GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t(`gender.${g}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* 요구 260914E — 학부모 이메일 */}
          <Field
            label={t('form.parentEmail', '학부모 이메일')}
            error={tr(errors.parentEmail?.message as string)}
          >
            <Input
              type="email"
              {...register('parentEmail')}
              placeholder={t('form.parentEmailPlaceholder', 'parent@example.com')}
            />
          </Field>

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
              label={t('form.school')}
              error={tr(errors.schoolFreetext?.message as string)}
            >
              <Input {...register('schoolFreetext')} placeholder={t('form.schoolPlaceholder')} />
            </Field>
            <Field label={t('form.grade')} error={tr(errors.grade?.message as string)}>
              <Input
                {...register('grade')}
                maxLength={40}
                placeholder={t('form.gradePlaceholder', '예: 중2, G10')}
              />
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
