import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Enrollment {
  id: string;
  paymentNoticeStatus: 'SENT' | 'PENDING' | 'NA' | null;
  counselDone: 'YES' | 'NO' | null;
  applied: boolean | null;
  paymentNoticeSent: 'YES' | 'NO' | null;
  classMinutes: number | null;
  tuitionAmount: string | null;
  paymentDate?: string | null;
  paymentMethod?: 'BANK_TRANSFER' | 'CARD' | 'OTHER' | null;
  paymentAmount?: string | null;
  paymentMemo?: string | null;
  tuitionPaid: boolean | null;
  classStartedAt: string | null;
  classStarted: 'YES' | 'NO' | null;
  // REQ-260626 — fields added at enrollment counseling
  counselMemo?: string | null;
  courseId?: string | null;
  courseFreetext?: string | null;
  sessionCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface Course {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface TeacherAssignment {
  id: string;
  teacherId: string;
  role: 'PRIMARY' | 'SECONDARY';
  assignedAt: string;
}

interface Teacher {
  id: string;
  name: string;
}

const NOTICE_STATUSES = ['SENT', 'PENDING', 'NA'] as const;
const YES_NO = ['YES', 'NO'] as const;
const PAYMENT_METHODS = ['BANK_TRANSFER', 'CARD', 'OTHER'] as const;

type FormValues = {
  paymentNoticeStatus: '' | (typeof NOTICE_STATUSES)[number];
  counselDone: '' | (typeof YES_NO)[number];
  applied: boolean;
  paymentNoticeSent: '' | (typeof YES_NO)[number];
  classMinutes: string;
  tuitionAmount: string;
  paymentDate: string;
  paymentMethod: '' | (typeof PAYMENT_METHODS)[number];
  paymentAmount: string;
  paymentMemo: string;
  tuitionPaid: boolean;
  classStartedAt: string;
  classStarted: '' | (typeof YES_NO)[number];
  // REQ-260626
  counselMemo: string;
  courseId: string;
  courseFreetext: string;
  sessionCount: string;
  startDate: string;
  endDate: string;
};

export function EnrollmentPanel({
  inqId,
  currentStage,
  onAfterAdvance,
}: {
  inqId: string;
  /** Drives which sections are visible. */
  currentStage: 'ENROLLMENT_COUNSELING' | 'PAYMENT';
  /** Parent-supplied transition trigger — called with the next stage after the
   *  enrollment row has been persisted with counselDone = 'YES'. */
  onAfterAdvance?: (nextStage: 'PAYMENT') => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['csl', 'enrollment', inqId],
    queryFn: async () => {
      const res = await apiClient.get<Enrollment | null>(
        `/acm/csl/inquiries/${inqId}/enrollment`,
      );
      return res.data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ['csl', 'courses'],
    queryFn: async () => {
      const res = await apiClient.get<Course[]>('/acm/csl/courses');
      return res.data;
    },
  });

  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['csl', 'teacher-assignments', inqId],
    queryFn: async () => {
      const res = await apiClient.get<TeacherAssignment[]>(
        `/acm/csl/inquiries/${inqId}/teacher-assignments`,
      );
      return res.data;
    },
  });

  const { data: teacherDirectory = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
    // The teacher master is exposed by acm-tch; consume only what we need
    // for the picker. The endpoint returns `{ items, total, page, limit }`
    // (paginated shape — no `meta` key, so TransformInterceptor doesn't
    // unwrap items). Accept either an array or the paginated envelope so
    // a future shape change doesn't break this picker again.
    queryFn: async () => {
      try {
        const res = await apiClient.get<Teacher[] | { items: Teacher[] }>(
          '/acm/tch/teachers',
        );
        const body = res.data;
        return Array.isArray(body) ? body : (body?.items ?? []);
      } catch {
        return [];
      }
    },
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      paymentNoticeStatus: '',
      counselDone: '',
      applied: false,
      paymentNoticeSent: '',
      classMinutes: '',
      tuitionAmount: '',
      paymentDate: '',
      paymentMethod: '',
      paymentAmount: '',
      paymentMemo: '',
      tuitionPaid: false,
      classStartedAt: '',
      classStarted: '',
      counselMemo: '',
      courseId: '',
      courseFreetext: '',
      sessionCount: '',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        paymentNoticeStatus: (data.paymentNoticeStatus ??
          '') as FormValues['paymentNoticeStatus'],
        counselDone: (data.counselDone ?? '') as FormValues['counselDone'],
        applied: data.applied ?? false,
        paymentNoticeSent: (data.paymentNoticeSent ??
          '') as FormValues['paymentNoticeSent'],
        classMinutes: data.classMinutes?.toString() ?? '',
        tuitionAmount: data.tuitionAmount ?? '',
        paymentDate: data.paymentDate ?? '',
        paymentMethod: (data.paymentMethod ?? '') as FormValues['paymentMethod'],
        paymentAmount: data.paymentAmount ?? '',
        paymentMemo: data.paymentMemo ?? '',
        tuitionPaid: data.tuitionPaid ?? false,
        classStartedAt: data.classStartedAt ?? '',
        classStarted: (data.classStarted ?? '') as FormValues['classStarted'],
        counselMemo: data.counselMemo ?? '',
        courseId: data.courseId ?? '',
        courseFreetext: data.courseFreetext ?? '',
        sessionCount: data.sessionCount?.toString() ?? '',
        startDate: data.startDate ?? '',
        endDate: data.endDate ?? '',
      });
    }
  }, [data, reset]);

  /** Map form values → PUT body. `forceCounselDone` is used by the
   *  save-and-advance path: enrollment counseling is admin-discretion data
   *  (수강료/시간 모두 운영자 임의 입력) so the next-stage shortcut must imply
   *  counselDone = 'YES' even if the operator left the dropdown empty. */
  function toBody(v: FormValues, forceCounselDone = false) {
    return {
      paymentNoticeStatus: v.paymentNoticeStatus || undefined,
      counselDone: forceCounselDone ? ('YES' as const) : v.counselDone || undefined,
      applied: v.applied,
      paymentNoticeSent: v.paymentNoticeSent || undefined,
      classMinutes: v.classMinutes ? Number(v.classMinutes) : undefined,
      tuitionAmount: v.tuitionAmount ? Number(v.tuitionAmount) : undefined,
      paymentDate: v.paymentDate || undefined,
      paymentMethod: v.paymentMethod || undefined,
      paymentAmount: v.paymentAmount ? Number(v.paymentAmount) : undefined,
      paymentMemo: v.paymentMemo || undefined,
      tuitionPaid: v.tuitionPaid,
      classStartedAt: v.classStartedAt || undefined,
      classStarted: v.classStarted || undefined,
      // REQ-260626 — empty strings collapse to undefined so the server keeps
      // the existing column value rather than clearing it.
      counselMemo: v.counselMemo || undefined,
      courseId: v.courseId || undefined,
      courseFreetext: v.courseFreetext || undefined,
      sessionCount: v.sessionCount ? Number(v.sessionCount) : undefined,
      startDate: v.startDate || undefined,
      endDate: v.endDate || undefined,
    };
  }

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const res = await apiClient.put(
        `/acm/csl/inquiries/${inqId}/enrollment`,
        toBody(v, false),
      );
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['csl', 'enrollment', inqId] }),
  });

  /** "저장하고 다음 단계로" — single-shot save (with counselDone forced YES)
   *  + forward transition to PAYMENT. Used only at ENROLLMENT_COUNSELING. */
  const saveAndAdvance = useMutation({
    mutationFn: async (v: FormValues) => {
      const res = await apiClient.put(
        `/acm/csl/inquiries/${inqId}/enrollment`,
        toBody(v, true),
      );
      // Sync local form so the YES override is visible immediately even before
      // the next refetch lands.
      reset({ ...v, counselDone: 'YES' });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl', 'enrollment', inqId] });
      onAfterAdvance?.('PAYMENT');
    },
  });

  const isCounselStage = currentStage === 'ENROLLMENT_COUNSELING';
  const isPaymentStage = currentStage === 'PAYMENT';

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t(`stage.${currentStage}`)}</h2>

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="grid gap-3"
      >
        {isCounselStage && (
          <>
            <Field label={t('detail.enrollment.counselMemo')}>
              <textarea
                {...register('counselMemo')}
                rows={3}
                className="min-h-[72px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 text-sm"
                placeholder={t('detail.enrollment.counselMemoPlaceholder')}
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('detail.enrollment.course')}>
                <Select {...register('courseId')}>
                  <option value="">{t('common:dash')}</option>
                  {courses.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('detail.enrollment.courseFreetext')}>
                <Input
                  {...register('courseFreetext')}
                  placeholder={t('detail.enrollment.courseFreetextPlaceholder')}
                />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label={t('detail.enrollment.sessionCount')}>
                <Input type="number" min={0} {...register('sessionCount')} />
              </Field>
              <Field label={t('detail.enrollment.startDate')}>
                <Input type="date" {...register('startDate')} />
              </Field>
              <Field label={t('detail.enrollment.endDate')}>
                <Input type="date" {...register('endDate')} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('detail.enrollment.counselDone')}>
                <Select {...register('counselDone')}>
                  <option value="">{t('common:dash')}</option>
                  {YES_NO.map((s) => (
                    <option key={s} value={s}>
                      {t(`yesNo.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm pt-5">
                <input type="checkbox" {...register('applied')} />
                {t('detail.enrollment.applied')}
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('detail.enrollment.paymentNoticeSent')}>
                <Select {...register('paymentNoticeSent')}>
                  <option value="">{t('common:dash')}</option>
                  {YES_NO.map((s) => (
                    <option key={s} value={s}>
                      {t(`yesNo.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('detail.enrollment.classMinutes')}>
                {/*
                  REQ-260626 FR-CSL-133 — 60/90/120 프리셋 + 분단위 자유입력.
                  프리셋 버튼은 form value 를 직접 갱신, 자유입력은 number input.
                  한 줄에 같이 두어 운영자가 빠르게 전환할 수 있도록 함.
                */}
                <ClassMinutesField
                  register={register('classMinutes')}
                  currentValue={watch('classMinutes')}
                  setValue={(next) =>
                    setValue('classMinutes', next, { shouldDirty: true })
                  }
                  presetLabel={t('detail.enrollment.classMinutesPresets', '프리셋')}
                  freeInputPlaceholder={t(
                    'detail.enrollment.classMinutesFreeInput',
                    '분단위 자유입력',
                  )}
                  suffix={t('detail.enrollment.classMinutesUnit', '분')}
                />
              </Field>
              <Field label={t('detail.enrollment.tuitionAmount')}>
                <Input
                  type="number"
                  min={0}
                  max={50000000}
                  {...register('tuitionAmount')}
                />
              </Field>
            </div>
          </>
        )}

        {isPaymentStage && (
          <>
            <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4 grid gap-3">
              <div className="text-sm font-semibold">
                {t('detail.enrollment.paymentSection', {
                  defaultValue: '결제 정보',
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label={t('detail.enrollment.paymentDate', {
                    defaultValue: '결제일',
                  })}
                >
                  <Input type="date" {...register('paymentDate')} />
                </Field>
                <Field
                  label={t('detail.enrollment.paymentMethodInput', {
                    defaultValue: '결제 방법',
                  })}
                >
                  <Select {...register('paymentMethod')}>
                    <option value="">{t('common:dash')}</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {t(`detail.enrollment.method.${method}`, {
                          defaultValue:
                            method === 'BANK_TRANSFER'
                              ? '계좌이체'
                              : method === 'CARD'
                                ? '카드'
                                : '기타',
                        })}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label={t('detail.enrollment.paymentAmount', {
                    defaultValue: '결제금액',
                  })}
                >
                  <Input
                    type="number"
                    min={0}
                    max={50000000}
                    {...register('paymentAmount')}
                  />
                </Field>
                <Field
                  label={t('detail.enrollment.paymentMemoInput', {
                    defaultValue: '비고',
                  })}
                >
                  <Input {...register('paymentMemo')} />
                </Field>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field label={t('detail.enrollment.classStarted')}>
                <Select {...register('classStarted')}>
                  <option value="">{t('common:dash')}</option>
                  {YES_NO.map((s) => (
                    <option key={s} value={s}>
                      {t(`yesNo.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm h-9 px-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800">
                <input type="checkbox" {...register('tuitionPaid')} />
                {t('detail.enrollment.tuitionPaid')}
              </label>
            </div>
            <p className="text-[11px] text-secondary -mt-1">
              {t('detail.enrollment.tuitionPaidHint')}
            </p>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant={isCounselStage ? 'outline' : 'default'}
            disabled={mutation.isPending || saveAndAdvance.isPending}
          >
            {mutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
          {isCounselStage && onAfterAdvance && (
            <Button
              type="button"
              onClick={handleSubmit((v) => saveAndAdvance.mutate(v))}
              disabled={mutation.isPending || saveAndAdvance.isPending}
            >
              {saveAndAdvance.isPending
                ? t('common:actions.saving')
                : t('detail.enrollment.saveAndAdvance')}
            </Button>
          )}
        </div>
        {(mutation.isError || saveAndAdvance.isError) && (
          <p className="text-xs text-red-600">
            {(
              (mutation.error ?? saveAndAdvance.error) as {
                response?: { data?: { message?: string } };
              }
            )?.response?.data?.message ??
              ((mutation.error ?? saveAndAdvance.error) as Error).message}
          </p>
        )}
      </form>

      {isCounselStage && (
        <TeacherAssignmentsBlock
          inqId={inqId}
          assignments={assignments}
          teachers={teacherDirectory}
          onChange={() => refetchAssignments()}
        />
      )}
    </section>
  );
}

/**
 * REQ-260626 FR-CSL-136 — multi-teacher assignment widget. Lives next to
 * the form so the operator can manage assignments without leaving the
 * enrollment panel. Add via teacher picker + role dropdown; remove by row.
 */
function TeacherAssignmentsBlock({
  inqId,
  assignments,
  teachers,
  onChange,
}: {
  inqId: string;
  assignments: TeacherAssignment[];
  teachers: Teacher[];
  onChange: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const [teacherId, setTeacherId] = useState('');
  const [role, setRole] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');

  const assign = useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/acm/csl/inquiries/${inqId}/teacher-assignments`,
        { teacherId, role },
      );
    },
    onSuccess: () => {
      setTeacherId('');
      onChange();
    },
  });

  const remove = useMutation({
    mutationFn: async (asgId: string) => {
      await apiClient.delete(
        `/acm/csl/inquiries/${inqId}/teacher-assignments/${asgId}`,
      );
    },
    onSuccess: () => onChange(),
  });

  const nameById = new Map(teachers.map((tt) => [tt.id, tt.name]));

  return (
    <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
      <h3 className="text-sm font-semibold mb-3">
        {t('detail.enrollment.teacherAssignments')}
      </h3>

      <ul className="grid gap-2 mb-3">
        {assignments.length === 0 && (
          <li className="text-xs text-secondary">
            {t('detail.enrollment.noAssignments')}
          </li>
        )}
        {assignments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-3 py-2 text-sm"
          >
            <span>
              {nameById.get(a.teacherId) ?? a.teacherId.slice(0, 8)}
              <span className="ml-2 inline-block rounded bg-[var(--surface-strong)] px-2 py-0.5 text-[10px]">
                {t(`detail.enrollment.assignRole.${a.role}`)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove.mutate(a.id)}
              disabled={remove.isPending}
              className="text-xs text-red-600 hover:underline"
            >
              {t('common:actions.remove', 'Remove')}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 items-end">
        <div className="grid gap-1 flex-1">
          <Label className="text-xs">{t('detail.enrollment.assignTeacher')}</Label>
          <Select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">{t('common:dash')}</option>
            {teachers.map((tt) => (
              <option key={tt.id} value={tt.id}>
                {tt.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">{t('detail.enrollment.assignRoleLabel')}</Label>
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as 'PRIMARY' | 'SECONDARY')}
          >
            <option value="PRIMARY">{t('detail.enrollment.assignRole.PRIMARY')}</option>
            <option value="SECONDARY">{t('detail.enrollment.assignRole.SECONDARY')}</option>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => assign.mutate()}
          disabled={!teacherId || assign.isPending}
        >
          {t('common:actions.add', 'Add')}
        </Button>
      </div>
      {assign.isError && (
        <p className="mt-1 text-xs text-red-600">
          {(assign.error as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? (assign.error as Error).message}
        </p>
      )}
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

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
    />
  );
}

/**
 * REQ-260626 FR-CSL-133 — preset chips (60 / 90 / 120) + free-input.
 * Highlights the active preset when the typed value matches; preset
 * click overwrites the input.
 */
function ClassMinutesField({
  register,
  currentValue,
  setValue,
  presetLabel,
  freeInputPlaceholder,
  suffix,
}: {
  register: React.InputHTMLAttributes<HTMLInputElement>;
  currentValue: string;
  setValue: (next: string) => void;
  presetLabel: string;
  freeInputPlaceholder: string;
  suffix: string;
}) {
  const presets = [60, 90, 120];
  return (
    <div className="grid gap-1.5">
      <div className="flex gap-1.5 items-center">
        <span className="text-[11px] text-secondary mr-1">{presetLabel}:</span>
        {presets.map((m) => {
          const active = currentValue === String(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => setValue(String(m))}
              className={
                'h-7 rounded-md border px-2 text-xs ' +
                (active
                  ? 'border-primary bg-primary text-white'
                  : 'border-[var(--border-subtle)] bg-transparent hover:bg-[var(--surface-strong)]')
              }
            >
              {m}
              {suffix}
            </button>
          );
        })}
      </div>
      <Input type="number" min={1} {...register} placeholder={freeInputPlaceholder} />
    </div>
  );
}
