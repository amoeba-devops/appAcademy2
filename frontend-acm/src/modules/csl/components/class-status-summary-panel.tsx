import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import type { ClassCreatePrefill } from '@/modules/cls/types';

interface InquiryDetail {
  id: string;
  stdId?: string | null;
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
}

interface Course {
  id: string;
  code: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
  userId?: string | null;
}

interface TeacherAssignment {
  id: string;
  teacherId: string;
  role: 'PRIMARY' | 'SECONDARY';
}

type SectionKey = 'intake' | 'classInfo';

const DEFAULT_OPEN: SectionKey[] = ['intake', 'classInfo'];

export function ClassStatusSummaryPanel({ inqId }: { inqId: string }) {
  const { t } = useTranslation(['csl', 'cls', 'common']);
  const navigate = useNavigate();
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

  const { data: assignments = [] } = useQuery({
    queryKey: ['csl', 'teacher-assignments', inqId],
    queryFn: async () => {
      const res = await apiClient.get<TeacherAssignment[]>(
        `/acm/csl/inquiries/${inqId}/teacher-assignments`,
      );
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

  const teacherName = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
  const teacherUserIdByTeacherId = new Map(
    teachers.map((teacher) => [teacher.id, teacher.userId ?? null]),
  );
  const courseName = new Map(
    courses.map((course) => [course.id, `${course.code} — ${course.name}`]),
  );
  const assignedTeachers = assignments
    .map((assignment) => {
      const role = t(`detail.enrollment.assignRole.${assignment.role}`, {
        defaultValue: assignment.role === 'PRIMARY' ? '주' : '부',
      });
      const name = teacherName.get(assignment.teacherId) ?? assignment.teacherId;
      return `${role} ${name}`;
    })
    .join(', ');
  const primaryAssignment = assignments.find((assignment) => assignment.role === 'PRIMARY') ?? assignments[0];
  const createClassPrefill: ClassCreatePrefill = {
    inquiryId: inq?.id,
    courseId: enrollment?.courseId ?? undefined,
    teacherUserId: primaryAssignment
      ? (teacherUserIdByTeacherId.get(primaryAssignment.teacherId) ?? undefined)
      : undefined,
    startedAt: enrollment?.startDate ?? undefined,
    endedAt: enrollment?.endDate ?? undefined,
    studentIds: inq?.stdId ? [inq.stdId] : [],
    primaryStudentId: inq?.stdId ?? undefined,
  };

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {t('detail.classStatus.title', { defaultValue: '6. 수강 현황' })}
          </h2>
          <p className="mt-1 text-[11px] text-secondary">
            {t('detail.classStatus.subtitle', {
              defaultValue: '접수 내용과 현재 운영 중인 수업 정보를 한 번에 확인합니다.',
            })}
          </p>
        </div>
        <Button
          type="button"
          onClick={() =>
            navigate('/admin/cls', {
              state: { createClassPrefill },
            })
          }
        >
          {t('cls:actions.createClass', { defaultValue: '수업 생성' })}
        </Button>
      </div>

      <AccordionSection
        open={openSections.has('intake')}
        onToggle={() => toggle('intake')}
        title={t('detail.classStatus.sections.intake', { defaultValue: '1. 접수 내용' })}
      >
        {!inq ? (
          <p className="text-sm text-secondary">—</p>
        ) : (
          <div className="grid gap-2 text-sm md:grid-cols-2 md:gap-x-6">
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
            <Info
              label={t('detail.intake.field.registeredAt')}
              value={inq.registeredAt ?? '—'}
            />
            <Info
              label={t('form.followupMemo')}
              value={formatFollowup(inq.followupAt, inq.followupMemo)}
            />
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        open={openSections.has('classInfo')}
        onToggle={() => toggle('classInfo')}
        title={t('detail.classStatus.sections.classInfo', {
          defaultValue: '2. 수업 정보',
        })}
      >
        <div className="grid gap-4">
          <div className="grid gap-2 text-sm md:grid-cols-2 md:gap-x-6">
            <Info
              label={t('detail.enrollment.course')}
              value={
                (enrollment?.courseId && courseName.get(enrollment.courseId)) ||
                enrollment?.courseFreetext ||
                '—'
              }
            />
            <Info
              label={t('detail.enrollment.teacherAssignments')}
              value={assignedTeachers || '—'}
            />
            <Info
              label={t('detail.enrollment.sessionCount')}
              value={enrollment?.sessionCount?.toString() ?? '—'}
            />
            <Info
              label={t('detail.enrollment.classMinutes')}
              value={enrollment?.classMinutes ? `${enrollment.classMinutes}분` : '—'}
            />
            <Info
              label={t('detail.enrollment.startDate')}
              value={enrollment?.startDate ?? '—'}
            />
            <Info
              label={t('detail.enrollment.endDate')}
              value={enrollment?.endDate ?? '—'}
            />
          </div>

          <SummaryBlock
            title={t('detail.classStatus.sections.levelTest', {
              defaultValue: '레벨테스트 요약',
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
                      {displayTestType(row)}
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
          </SummaryBlock>

          <SummaryBlock
            title={t('detail.classStatus.sections.trial', {
              defaultValue: '데모수업 이력',
            })}
          >
            {trialClasses.length === 0 ? (
              <p className="text-sm text-secondary">—</p>
            ) : (
              <div className="grid gap-2">
                {trialClasses.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3 text-sm md:grid-cols-3"
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
          </SummaryBlock>
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

function SummaryBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-semibold text-secondary">{title}</div>
      {children}
    </div>
  );
}

function Info({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'grid gap-1' : 'grid grid-cols-[120px_1fr] gap-1'}>
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-sm whitespace-pre-wrap break-words">{value}</span>
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

function formatFollowup(followupAt?: string | null, followupMemo?: string | null): string {
  const parts = [followupAt, followupMemo].filter(Boolean);
  return parts.length ? parts.join('\n') : '—';
}

function displayTestType(row: { testType: string; testTypeOther: string | null }): string {
  if (row.testType === 'OTHER' && row.testTypeOther) return row.testTypeOther;
  if (row.testType === 'TOEFL_JR') return 'TOEFL Jr';
  return row.testType;
}
