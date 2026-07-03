import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';

interface InquiryDetail {
  studentName: string;
  parentName: string | null;
  parentPhone: string | null;
  schoolFreetext?: string | null;
  grade?: string | null;
  inflowType: 'HOMEPAGE' | 'KAKAO_CHANNEL' | 'PHONE';
  applyType: 'COUNSELING_ONLY' | 'EXAM_ONLY' | 'BOTH';
  applyPurposes?: string[];
  registeredAt: string;
  followupAt?: string | null;
  followupMemo?: string | null;
}

interface LevelTest {
  testType: string;
  testTypeOther: string | null;
  scheduledAt: string | null;
  scheduledTime: string | null;
  scoreReading: number | null;
  scoreMath: number | null;
  scoreLanguage: number | null;
  scoreDetail: Record<string, unknown> | null;
}

interface TrialClass {
  id: string;
  heldAt: string;
  heldTime: string | null;
  teacherId: string | null;
  completed: boolean;
}

interface Enrollment {
  courseId?: string | null;
  courseFreetext?: string | null;
  sessionCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  classMinutes?: number | null;
  paymentNoticeSent?: 'YES' | 'NO' | null;
  classStarted?: 'YES' | 'NO' | null;
  tuitionPaid?: boolean | null;
  paymentDate?: string | null;
  paymentMethod?: 'BANK_TRANSFER' | 'CARD' | 'OTHER' | null;
  paymentAmount?: string | null;
  paymentMemo?: string | null;
}

interface Course {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Teacher {
  id: string;
  name: string;
}

type SectionKey = 'intake' | 'levelTest' | 'trial' | 'course' | 'payment';

const DEFAULT_OPEN: SectionKey[] = ['intake'];

export function ClassStatusSummaryPanel({ inqId }: { inqId: string }) {
  const { t } = useTranslation(['csl', 'common']);
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(
    () => new Set(DEFAULT_OPEN),
  );

  const { data: inq } = useQuery({
    queryKey: ['csl', 'detail', inqId],
    queryFn: async () => {
      const res = await apiClient.get<InquiryDetail>(`/acm/csl/inquiries/${inqId}`);
      return res.data;
    },
  });

  const { data: levelTests = [] } = useQuery({
    queryKey: ['csl', 'level-tests', inqId],
    queryFn: async () => {
      const res = await apiClient.get<LevelTest[]>(
        `/acm/csl/inquiries/${inqId}/level-tests`,
      );
      return res.data;
    },
  });

  const { data: trialClasses = [] } = useQuery({
    queryKey: ['csl', 'trial-classes', inqId],
    queryFn: async () => {
      const res = await apiClient.get<TrialClass[]>(
        `/acm/csl/inquiries/${inqId}/trial-classes`,
      );
      return res.data;
    },
  });

  const { data: enrollment } = useQuery({
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

  const { data: teachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
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
    staleTime: 60_000,
  });

  const teacherName = new Map(teachers.map((tt) => [tt.id, tt.name]));
  const courseName = new Map(courses.map((course) => [course.id, `${course.code} — ${course.name}`]));

  function toggle(section: SectionKey): void {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-5 grid gap-3">
      <div>
        <h2 className="text-base font-semibold">
          {t('detail.classStatus.title', { defaultValue: '6. 수강 현황' })}
        </h2>
        <p className="mt-1 text-[11px] text-secondary">
          {t('detail.classStatus.subtitle', {
            defaultValue: '접수부터 결제까지 주요 상담 이력을 단계별로 확인합니다.',
          })}
        </p>
      </div>

      <AccordionSection
        open={openSections.has('intake')}
        onToggle={() => toggle('intake')}
        title={t('detail.classStatus.sections.intake', { defaultValue: '1. 접수 내용' })}
      >
        {!inq ? (
          <p className="text-sm text-secondary">—</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Info label={t('detail.intake.field.student')} value={inq.studentName} />
            <Info
              label={t('detail.intake.field.grade')}
              value={inq.grade ? t(`grade.${inq.grade}`, inq.grade) : '—'}
            />
            <Info label={t('detail.intake.field.parentName')} value={inq.parentName ?? '—'} />
            <Info label={t('detail.intake.field.parentPhone')} value={inq.parentPhone ?? '—'} />
            <Info label={t('detail.intake.field.school')} value={inq.schoolFreetext ?? '—'} />
            <Info
              label={t('detail.intake.field.inflowType')}
              value={t(`inflow.${inq.inflowType}`)}
            />
            <Info
              label={t('detail.intake.field.applyType')}
              value={t(`applyType.${inq.applyType}`)}
            />
            <Info
              label={t('form.applyPurpose')}
              value={
                inq.applyPurposes?.length
                  ? inq.applyPurposes.map((item) => t(`applyPurpose.${item}`)).join(', ')
                  : '—'
              }
            />
            <Info label={t('detail.intake.field.registeredAt')} value={inq.registeredAt ?? '—'} />
            <Info
              label={t('form.followupMemo')}
              value={inq.followupMemo || inq.followupAt || '—'}
            />
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        open={openSections.has('levelTest')}
        onToggle={() => toggle('levelTest')}
        title={t('detail.classStatus.sections.levelTest', {
          defaultValue: '2. 레벨테스트 점수',
        })}
      >
        {levelTests.length === 0 ? (
          <p className="text-sm text-secondary">—</p>
        ) : (
          <div className="grid gap-2">
            {levelTests.map((row) => (
              <div
                key={`${row.testType}-${row.testTypeOther ?? ''}`}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3"
              >
                <div className="text-sm font-semibold">
                  {row.testType === 'OTHER' && row.testTypeOther
                    ? row.testTypeOther
                    : row.testType === 'TOEFL_JR'
                      ? 'TOEFL Jr'
                      : row.testType}
                </div>
                <div className="mt-1 text-xs text-secondary">
                  {row.scheduledAt ?? '—'}
                  {row.scheduledTime ? ` ${row.scheduledTime.slice(0, 5)}` : ''}
                </div>
                <div className="mt-2 text-sm">
                  {row.testType === 'MAP' ? (
                    <span>
                      Reading {row.scoreReading ?? '—'} / Math {row.scoreMath ?? '—'} /
                      Language {row.scoreLanguage ?? '—'}
                    </span>
                  ) : row.scoreDetail && Object.keys(row.scoreDetail).length > 0 ? (
                    <ScoreDetailText value={row.scoreDetail} />
                  ) : (
                    '—'
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        open={openSections.has('trial')}
        onToggle={() => toggle('trial')}
        title={t('detail.classStatus.sections.trial', {
          defaultValue: '3. 데모수업 정보',
        })}
      >
        {trialClasses.length === 0 ? (
          <p className="text-sm text-secondary">—</p>
        ) : (
          <div className="grid gap-2">
            {trialClasses.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1fr_1fr_120px] gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3 text-sm"
              >
                <Info label={t('detail.trial.heldAt')} value={row.heldAt} compact />
                <Info
                  label={t('detail.trial.teacher')}
                  value={
                    row.teacherId ? teacherName.get(row.teacherId) ?? row.teacherId : '—'
                  }
                  compact
                />
                <Info
                  label={t('detail.trial.completed')}
                  value={row.completed ? t('yesNo.YES') : t('yesNo.NO')}
                  compact
                />
              </div>
            ))}
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        open={openSections.has('course')}
        onToggle={() => toggle('course')}
        title={t('detail.classStatus.sections.course', {
          defaultValue: '4. 수강강좌 정보',
        })}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Info
            label={t('detail.enrollment.course')}
            value={
              (enrollment?.courseId && courseName.get(enrollment.courseId)) ||
              enrollment?.courseFreetext ||
              '—'
            }
          />
          <Info
            label={t('detail.enrollment.sessionCount')}
            value={enrollment?.sessionCount?.toString() ?? '—'}
          />
          <Info
            label={t('detail.enrollment.startDate')}
            value={enrollment?.startDate ?? '—'}
          />
          <Info
            label={t('detail.enrollment.endDate')}
            value={enrollment?.endDate ?? '—'}
          />
          <Info
            label={t('detail.enrollment.classMinutes')}
            value={enrollment?.classMinutes ? `${enrollment.classMinutes}분` : '—'}
          />
          <Info
            label={t('detail.enrollment.paymentNoticeSent')}
            value={
              enrollment?.paymentNoticeSent ? t(`yesNo.${enrollment.paymentNoticeSent}`) : '—'
            }
          />
        </div>
      </AccordionSection>

      <AccordionSection
        open={openSections.has('payment')}
        onToggle={() => toggle('payment')}
        title={t('detail.classStatus.sections.payment', {
          defaultValue: '5. 결제 정보',
        })}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Info
            label={t('detail.enrollment.paymentDate', { defaultValue: '결제일' })}
            value={enrollment?.paymentDate ?? '—'}
          />
          <Info
            label={t('detail.enrollment.paymentMethodInput', { defaultValue: '결제 방법' })}
            value={
              enrollment?.paymentMethod
                ? t(`detail.enrollment.method.${enrollment.paymentMethod}`, {
                    defaultValue:
                      enrollment.paymentMethod === 'BANK_TRANSFER'
                        ? '계좌이체'
                        : enrollment.paymentMethod === 'CARD'
                          ? '카드'
                          : '기타',
                  })
                : '—'
            }
          />
          <Info
            label={t('detail.enrollment.paymentAmount', { defaultValue: '결제금액' })}
            value={enrollment?.paymentAmount ?? '—'}
          />
          <Info
            label={t('detail.enrollment.paymentMemoInput', { defaultValue: '비고' })}
            value={enrollment?.paymentMemo ?? '—'}
          />
          <Info
            label={t('detail.enrollment.tuitionPaid')}
            value={enrollment?.tuitionPaid ? t('yesNo.YES') : t('yesNo.NO')}
          />
          <Info
            label={t('detail.enrollment.classStarted')}
            value={enrollment?.classStarted ? t(`yesNo.${enrollment.classStarted}`) : '—'}
          />
        </div>
      </AccordionSection>
    </section>
  );
}

function AccordionSection({
  open,
  onToggle,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-semibold">{title}</span>
      </button>
      {open && <div className="border-t border-[var(--border-subtle)] px-3 py-3">{children}</div>}
    </div>
  );
}

function Info({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'grid gap-1' : 'grid grid-cols-[120px_1fr] gap-1'}>
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function ScoreDetailText({
  value,
}: {
  value: Record<string, unknown>;
}) {
  return (
    <div className="grid gap-1">
      {Object.entries(value).map(([key, entry]) => (
        <div key={key}>
          <span className="font-medium">{key}</span>: {formatEntry(entry)}
        </div>
      ))}
    </div>
  );
}

function formatEntry(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key} ${entry ?? '—'}`)
      .join(', ');
  }
  return String(value);
}
