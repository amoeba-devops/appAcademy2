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
  parentPhone: z
    .string()
    .min(1)
    .regex(/^[0-9+\-() ]{7,20}$/),
  applyPurposes: z.array(z.enum(APPLY_PURPOSES)).default([]),
  privacyConsent: z.boolean().refine((v) => v === true),
});

type ContactForm = z.infer<typeof schema>;

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
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('contact.success.title')}
          </h2>
          <p className="text-sm text-gray-500">{t('contact.success.body')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
            Trinity Prep Institute
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('contact.pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t('contact.subtitle')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6"
        >
          {/* 상담 목적 */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-3">
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
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    {t(`contact.purposes.${purpose}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* 학생 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('contact.fields.studentName')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              {...register('studentName')}
              type="text"
              placeholder={t('contact.placeholder.studentName')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.studentName && (
              <p className="mt-1 text-xs text-red-500">
                {t('contact.validation.studentNameRequired')}
              </p>
            )}
          </div>

          {/* 학년 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('contact.fields.grade')}
            </label>
            <select
              {...register('grade')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">{t('contact.placeholder.grade')}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('contact.fields.parentPhone')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              {...register('parentPhone')}
              type="tel"
              placeholder={t('contact.placeholder.parentPhone')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.parentPhone && (
              <p className="mt-1 text-xs text-red-500">
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
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
              />
              <span className="text-sm text-gray-600">
                {t('contact.fields.privacyConsent')}
              </span>
            </label>
            {errors.privacyConsent && (
              <p className="mt-1 text-xs text-red-500">
                {t('contact.validation.privacyRequired')}
              </p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-red-500 text-center">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? t('contact.submitting') : t('contact.submit')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
          {t('contact.notice')}
        </p>
      </div>
    </div>
  );
}
