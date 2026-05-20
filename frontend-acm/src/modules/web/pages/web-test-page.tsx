import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const GRADES = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3', '고1', '고2', '고3',
] as const;

const schema = z.object({
  studentName: z.string().min(1),
  studentNameEn: z.string().max(100).optional(),
  birthdate: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Invalid date format',
    }),
  grade: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  parentName: z.string().min(1).max(50),
  parentPhone: z
    .string()
    .min(1)
    .regex(/^[0-9+\-() ]{7,20}$/),
  parentEmail: z.string().email().optional().or(z.literal('')),
  location: z.string().max(100).optional(),
  privacyConsent: z.boolean().refine((v) => v === true),
});

type MapTestForm = z.infer<typeof schema>;

export function WebTestPage() {
  const { t } = useTranslation('web');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MapTestForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: MapTestForm) => {
    setServerError(null);
    try {
      await axios.post('/api/web/test', {
        studentName: data.studentName,
        studentNameEn: data.studentNameEn || undefined,
        birthdate: data.birthdate || undefined,
        grade: data.grade || undefined,
        gender: data.gender ? (data.gender === 'male' ? '남' : '여') : undefined,
        parentName: data.parentName,
        parentPhone: data.parentPhone,
        parentEmail: data.parentEmail || undefined,
        location: data.location || undefined,
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
            {t('test.success.title')}
          </h2>
          <p className="text-sm text-gray-500">{t('test.success.body')}</p>
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
            {t('test.pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t('test.subtitle')}
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6"
        >
          {/* 학생 한글 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.studentName')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              {...register('studentName')}
              type="text"
              placeholder={t('test.placeholder.studentName')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.studentName && (
              <p className="mt-1 text-xs text-red-500">
                {t('test.validation.studentNameRequired')}
              </p>
            )}
          </div>

          {/* 학생 영문 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.studentNameEn')}
            </label>
            <input
              {...register('studentNameEn')}
              type="text"
              placeholder={t('test.placeholder.studentNameEn')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 생년월일 + 학년 (row) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('test.fields.birthdate')}
              </label>
              <input
                {...register('birthdate')}
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('test.fields.grade')}
              </label>
              <select
                {...register('grade')}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="">{t('test.placeholder.grade')}</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.gender')}
            </label>
            <div className="flex gap-4">
              {(['male', 'female'] as const).map((g) => (
                <label key={g} className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('gender')}
                    type="radio"
                    value={g}
                    className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {t(`test.genderOptions.${g}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 학부모 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.parentName')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              {...register('parentName')}
              type="text"
              autoComplete="name"
              placeholder={t('test.placeholder.parentName')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.parentName && (
              <p className="mt-1 text-xs text-red-500">
                {t('test.validation.parentNameRequired')}
              </p>
            )}
          </div>

          {/* 연락처 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.parentPhone')}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              {...register('parentPhone')}
              type="tel"
              placeholder={t('test.placeholder.parentPhone')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.parentPhone && (
              <p className="mt-1 text-xs text-red-500">
                {errors.parentPhone.type === 'too_small'
                  ? t('test.validation.phoneRequired')
                  : t('test.validation.phoneInvalid')}
              </p>
            )}
          </div>

          {/* 학부모 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.parentEmail')}
            </label>
            <input
              {...register('parentEmail')}
              type="email"
              placeholder={t('test.placeholder.parentEmail')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* 국가/도시 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('test.fields.location')}
            </label>
            <input
              {...register('location')}
              type="text"
              placeholder={t('test.placeholder.location')}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
                {t('test.fields.privacyConsent')}
              </span>
            </label>
            {errors.privacyConsent && (
              <p className="mt-1 text-xs text-red-500">
                {t('test.validation.privacyRequired')}
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
            {isSubmitting ? t('test.submitting') : t('test.submit')}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
          {t('test.notice')}
        </p>
      </div>
    </div>
  );
}
