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

type FormValues = {
  paymentNoticeStatus: '' | (typeof NOTICE_STATUSES)[number];
  counselDone: '' | (typeof YES_NO)[number];
  applied: boolean;
  paymentNoticeSent: '' | (typeof YES_NO)[number];
  classMinutes: string;
  tuitionAmount: string;
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
  /** Drives the "save & advance" button visibility. PAYMENT/CLASS_STARTED reuse
   *  the same panel for read-only display, but the advance shortcut only fires
   *  from ENROLLMENT_COUNSELING where the counsel_done = YES gate lives. */
  currentStage?: 'ENROLLMENT_COUNSELING' | 'PAYMENT' | 'CLASS_STARTED';
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

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5">
      <h2 className="text-base font-semibold mb-4">{t('detail.enrollment.title')}</h2>

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="grid gap-3"
      >
        {/* REQ-260626 FR-CSL-131~135 — enrollment counseling fields */}
        <Field label={t('detail.enrollment.counselMemo')}>
          <textarea
            {...register('counselMemo')}
            rows={3}
            className="min-h-[72px] w-full rounded-md border border-[var(--border-subtle)] bg-transparent p-2 text-sm"
            placeholder={t('detail.enrollment.counselMemoPlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-[1fr_1fr_1fr] gap-3">
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

        <div className="grid grid-cols-2 gap-3">
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
          <Field label={t('detail.enrollment.paymentNoticeStatus')}>
            <Select {...register('paymentNoticeStatus')}>
              <option value="">{t('common:dash')}</option>
              {NOTICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`detail.enrollment.notice.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm pt-5">
            <input type="checkbox" {...register('applied')} />
            {t('detail.enrollment.applied')}
          </label>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <Field label={t('detail.enrollment.classStartedAt')}>
            <Input type="date" {...register('classStartedAt')} />
          </Field>
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
          <label className="flex items-center gap-2 text-sm h-9 px-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800">
            <input type="checkbox" {...register('tuitionPaid')} />
            {t('detail.enrollment.tuitionPaid')}
          </label>
        </div>
        <p className="text-[11px] text-secondary -mt-1">
          {t('detail.enrollment.tuitionPaidHint')}
        </p>

        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            variant={currentStage === 'ENROLLMENT_COUNSELING' ? 'outline' : 'default'}
            disabled={mutation.isPending || saveAndAdvance.isPending}
          >
            {mutation.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
          {currentStage === 'ENROLLMENT_COUNSELING' && onAfterAdvance && (
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

      <TeacherAssignmentsBlock
        inqId={inqId}
        assignments={assignments}
        teachers={teacherDirectory}
        onChange={() => refetchAssignments()}
      />

      {currentStage === 'PAYMENT' && (
        <PaymentApprovalBlock
          inqId={inqId}
          alreadyPaid={!!data?.tuitionPaid}
          onApproved={() => qc.invalidateQueries({ queryKey: ['csl', 'enrollment', inqId] })}
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

/**
 * REQ-260626 FR-CSL-141/142 — SCR-CSL-05 payment approval block. Renders
 * only on PAYMENT stage. POSTs to /enrollment/approve-payment which
 * enforces the ADMIN/APP_ADMIN gate; non-admins get a 403 with the BR
 * message displayed inline.
 */
function PaymentApprovalBlock({
  inqId,
  alreadyPaid,
  onApproved,
}: {
  inqId: string;
  alreadyPaid: boolean;
  onApproved: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const [method, setMethod] = useState<'CARD' | 'BANK_TRANSFER'>('CARD');
  const [memo, setMemo] = useState('');

  const approve = useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/acm/csl/inquiries/${inqId}/enrollment/approve-payment`,
        { method, memo: memo || undefined },
      );
    },
    onSuccess: () => {
      setMemo('');
      onApproved();
    },
  });

  return (
    <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
      <h3 className="text-sm font-semibold mb-2">
        {t('detail.enrollment.paymentApproval')}
      </h3>
      <p className="text-[11px] text-secondary mb-3">
        {t('detail.enrollment.paymentApprovalHint')}
      </p>
      {alreadyPaid ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ {t('detail.enrollment.paymentAlreadyApproved')}
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">{t('detail.enrollment.paymentMethod')}</Label>
              <Select
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as 'CARD' | 'BANK_TRANSFER')
                }
              >
                <option value="CARD">{t('detail.enrollment.method.CARD')}</option>
                <option value="BANK_TRANSFER">
                  {t('detail.enrollment.method.BANK_TRANSFER')}
                </option>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">{t('detail.enrollment.paymentMemo')}</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
            >
              {approve.isPending
                ? t('common:actions.saving')
                : t('detail.enrollment.approvePayment')}
            </Button>
          </div>
          {approve.isError && (
            <p className="text-xs text-red-600">
              {(approve.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? (approve.error as Error).message}
            </p>
          )}
        </div>
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
