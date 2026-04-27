'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';

type Step = 1 | 2 | 3;

interface AcademyForm {
  name: string;
  representative: string;
  businessRegistrationNo: string;
  slug: string;
  phone: string;
}

interface HoursForm {
  weekdayOpen: string;
  weekdayClose: string;
  saturdayOpen: string;
  saturdayClose: string;
  sundayClosed: boolean;
  holidayClosed: boolean;
}

const initAcademy: AcademyForm = {
  name: '',
  representative: '',
  businessRegistrationNo: '',
  slug: '',
  phone: '',
};

const initHours: HoursForm = {
  weekdayOpen: '14:00',
  weekdayClose: '22:00',
  saturdayOpen: '10:00',
  saturdayClose: '18:00',
  sundayClosed: true,
  holidayClosed: true,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [academy, setAcademy] = useState<AcademyForm>(initAcademy);
  const [hours, setHours] = useState<HoursForm>(initHours);
  const [teacherSync, setTeacherSync] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitStep1 = async () => {
    setError(null);
    if (!academy.name.trim() || academy.name.length < 2) {
      setError('학원명을 입력해 주세요.');
      return;
    }
    if (academy.slug && !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(academy.slug)) {
      setError('슬러그는 소문자·숫자·하이픈 3~60자입니다.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/onboarding/academy', {
        name: academy.name.trim(),
        representative: academy.representative || undefined,
        businessRegistrationNo: academy.businessRegistrationNo || undefined,
        slug: academy.slug || undefined,
        phone: academy.phone || undefined,
      });
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'STEP1_FAILED');
    } finally {
      setSubmitting(false);
    }
  };

  const submitStep2 = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/onboarding/hours', hours);
      setStep(3);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'STEP2_FAILED');
    } finally {
      setSubmitting(false);
    }
  };

  const submitStep3 = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.post('/onboarding/teacher-sync', { consent: teacherSync });
      router.replace('/admin/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'STEP3_FAILED');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          {step === 1 && '학원 기본 정보'}
          {step === 2 && '운영 시간'}
          {step === 3 && '교사 마스터 동기화'}
        </h1>
        <span className="text-sm text-slate-500">{step} / 3</span>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <Field label="학원명" required>
              <input
                value={academy.name}
                onChange={(e) => setAcademy({ ...academy, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="대표자">
              <input
                value={academy.representative}
                onChange={(e) =>
                  setAcademy({ ...academy, representative: e.target.value })
                }
                className={inputCls}
              />
            </Field>
            <Field label="사업자번호">
              <input
                value={academy.businessRegistrationNo}
                onChange={(e) =>
                  setAcademy({
                    ...academy,
                    businessRegistrationNo: e.target.value,
                  })
                }
                className={inputCls}
                placeholder="000-00-00000"
              />
            </Field>
            <Field label="슬러그" hint=".app-academy.amoeba.site">
              <input
                value={academy.slug}
                onChange={(e) =>
                  setAcademy({
                    ...academy,
                    slug: e.target.value.toLowerCase(),
                  })
                }
                className={inputCls}
                placeholder="my-academy"
              />
            </Field>
            <Field label="대표 전화">
              <input
                value={academy.phone}
                onChange={(e) => setAcademy({ ...academy, phone: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="평일">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours.weekdayOpen}
                  onChange={(e) =>
                    setHours({ ...hours, weekdayOpen: e.target.value })
                  }
                  className={inputCls}
                />
                <span className="text-slate-400">~</span>
                <input
                  type="time"
                  value={hours.weekdayClose}
                  onChange={(e) =>
                    setHours({ ...hours, weekdayClose: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </Field>
            <Field label="토요일">
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours.saturdayOpen}
                  onChange={(e) =>
                    setHours({ ...hours, saturdayOpen: e.target.value })
                  }
                  className={inputCls}
                />
                <span className="text-slate-400">~</span>
                <input
                  type="time"
                  value={hours.saturdayClose}
                  onChange={(e) =>
                    setHours({ ...hours, saturdayClose: e.target.value })
                  }
                  className={inputCls}
                />
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hours.sundayClosed}
                onChange={(e) =>
                  setHours({ ...hours, sundayClosed: e.target.checked })
                }
              />
              일요일 휴무
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hours.holidayClosed}
                onChange={(e) =>
                  setHours({ ...hours, holidayClosed: e.target.checked })
                }
              />
              공휴일 휴무
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm text-slate-700">
            <p>
              AMA 거래처(직원·강사)를 본 앱의 교사 마스터로 자동 동기화합니다. 야간 02:00에
              자동 실행되며 수동 동기화도 가능합니다.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={teacherSync}
                onChange={(e) => setTeacherSync(e.target.checked)}
              />
              동의 — 교사 마스터를 자동 동기화합니다.
            </label>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
            disabled={step === 1 || submitting}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            ← 이전
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              if (step === 1) void submitStep1();
              else if (step === 2) void submitStep2();
              else void submitStep3();
            }}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {step === 3 ? '시작하기' : '다음 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
        {hint && <span className="ml-2 text-slate-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
