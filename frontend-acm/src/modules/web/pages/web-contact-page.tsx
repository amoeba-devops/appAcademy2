import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;

const GRADES = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3', '고1', '고2', '고3',
] as const;

const schema = z.object({
  studentName: z.string().min(1),
  grade: z.string().optional(),
  parentName: z.string().min(1).max(50),
  parentPhone: z
    .string()
    .min(1)
    .regex(/^[0-9+\-() ]{7,20}$/),
  applyPurposes: z.array(z.enum(APPLY_PURPOSES)).default([]),
  privacyConsent: z.boolean().refine((v) => v === true),
});

type ContactForm = z.infer<typeof schema>;

// ── Dark-theme tokens (REQ FR-07-001) ──────────────────────────────────────
// Light-on-dark consultation form. Matches frontend's consultation-form-dark
// design: indigo accent, slate-200 text on slate-900/950 backdrop.
const INPUT_CLASS =
  'w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3.5 py-2.5 ' +
  'text-sm text-slate-100 placeholder-slate-500 transition ' +
  'focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400';

const CHECKBOX_CLASS =
  "mt-[3px] h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[3px] " +
  "border border-slate-500 bg-transparent transition " +
  "checked:border-indigo-400 checked:bg-indigo-500 " +
  "checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2016%2016%22%20fill=%22white%22><path%20d=%22M13.485%204.515a1%201%200%2000-1.414%200L6.5%2010.086%203.929%207.515a1%201%200%2000-1.414%201.414l3.278%203.278a1%201%200%20001.414%200l6.278-6.278a1%201%200%20000-1.414z%22/></svg>')] " +
  "checked:bg-center checked:bg-no-repeat " +
  'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900';

export function WebContactPage() {
  const { t } = useTranslation('web');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({
    resolver: zodResolver(schema),
    defaultValues: { applyPurposes: [] },
  });

  const selectedPurposes = watch('applyPurposes');

  const togglePurpose = (purpose: (typeof APPLY_PURPOSES)[number]) => {
    const current = selectedPurposes ?? [];
    setValue(
      'applyPurposes',
      current.includes(purpose)
        ? current.filter((p) => p !== purpose)
        : [...current, purpose],
    );
  };

  const onSubmit = async (data: ContactForm) => {
    setServerError(null);
    try {
      await axios.post('/api/web/contact', {
        studentName: data.studentName,
        grade: data.grade || undefined,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        applyPurposes: data.applyPurposes,
      });
      setSubmitted(true);
    } catch {
      setServerError('제출 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-10 max-w-md w-full text-center shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            {t('contact.success.title')}
          </h2>
          <p className="text-sm text-slate-400">{t('contact.success.body')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest text-indigo-300 uppercase mb-3">
            Trinity Prep Institute
          </p>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">
            {t('contact.pageTitle')}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {t('contact.subtitle')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 space-y-6 shadow-xl backdrop-blur"
        >
          {/* 상담 목적 */}
          <fieldset>
            <legend className="block text-sm font-medium text-slate-200 mb-3">
              {t('contact.purposeLabel')}
            </legend>
            <div className="space-y-2">
              {APPLY_PURPOSES.map((purpose) => (
                <label
                  key={purpose}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedPurposes.includes(purpose)}
                    onChange={() => togglePurpose(purpose)}
                    className={CHECKBOX_CLASS}
                  />
                  <span className="text-sm text-slate-300 group-hover:text-slate-100">
                    {t(`contact.purposes.${purpose}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 학생 이름 */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">
              {t('contact.fields.studentName')}
              <span className="text-rose-400 ml-0.5">*</span>
            </label>
            <input
              {...register('studentName')}
              type="text"
              placeholder={t('contact.placeholder.studentName')}
              className={INPUT_CLASS}
            />
            {errors.studentName && (
              <p className="mt-1 text-xs text-rose-400">
                {t('contact.validation.studentNameRequired')}
              </p>
            )}
          </div>

          {/* 학년 */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">
              {t('contact.fields.grade')}
            </label>
            <select
              {...register('grade')}
              className={INPUT_CLASS + ' bg-slate-800/50'}
            >
              <option value="">{t('contact.placeholder.grade')}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* 학부모 이름 */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">
              {t('contact.fields.parentName')}
              <span className="text-rose-400 ml-0.5">*</span>
            </label>
            <input
              {...register('parentName')}
              type="text"
              autoComplete="name"
              placeholder={t('contact.placeholder.parentName')}
              className={INPUT_CLASS}
            />
            {errors.parentName && (
              <p className="mt-1 text-xs text-rose-400">
                {t('contact.validation.parentNameRequired')}
              </p>
            )}
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">
              {t('contact.fields.parentPhone')}
              <span className="text-rose-400 ml-0.5">*</span>
            </label>
            <input
              {...register('parentPhone')}
              type="tel"
              placeholder={t('contact.placeholder.parentPhone')}
              className={INPUT_CLASS}
            />
            {errors.parentPhone && (
              <p className="mt-1 text-xs text-rose-400">
                {errors.parentPhone.type === 'too_small'
                  ? t('contact.validation.phoneRequired')
                  : t('contact.validation.phoneInvalid')}
              </p>
            )}
          </div>

          {/* 개인정보 동의 */}
          <div>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                {...register('privacyConsent')}
                type="checkbox"
                className={CHECKBOX_CLASS}
              />
              <span className="text-sm text-slate-300">
                {t('contact.fields.privacyConsent')}
              </span>
            </label>
            {errors.privacyConsent && (
              <p className="mt-1 text-xs text-rose-400">
                {t('contact.validation.privacyRequired')}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-rose-400 text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-indigo-500 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? t('contact.submitting') : t('contact.submit')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500 leading-relaxed">
          {t('contact.notice')}
        </p>
      </div>
    </div>
  );
}
