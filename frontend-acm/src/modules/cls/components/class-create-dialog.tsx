import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useStudents } from '@/modules/std/hooks/use-students';
import type { TeacherDetail } from '@/modules/tch/types';
import type { StudentSummary } from '@/modules/std/types';
import { useCreateClass } from '../hooks/use-class-mutations';
import type { ClsSubjectType, SesMode } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onCreated?: (classId: string) => void;
}

interface CourseOption {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface RecurrenceDraft {
  id: string;
  dayOfWeek: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  startTime: string;
  durationMin: string;
  defaultMode: Exclude<SesMode, 'HYBRID'>;
}

const SUBJECT_OPTIONS: ClsSubjectType[] = [
  'MAP_TEST',
  'SSAT',
  'ISEE',
  'WRITING',
  'LANGUAGE_ARTS',
  'MATH',
  'INTL_PREP',
  'DEMO',
  'OTHER',
];

const DAY_OPTIONS: RecurrenceDraft['dayOfWeek'][] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MODE_OPTIONS: Array<Exclude<SesMode, 'HYBRID'>> = [
  'ONLINE',
  'IN_PERSON',
  'TWO_PERSON_IN_PERSON',
];

const selectClass =
  'h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const textareaClass =
  'min-h-[88px] w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

export function ClassCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation(['cls', 'common']);
  const toast = useToast();
  const createMut = useCreateClass();
  const [subjectType, setSubjectType] = useState<ClsSubjectType>('OTHER');
  const [courseId, setCourseId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState('');
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [endedAt, setEndedAt] = useState('');
  const [hourlyRate, setHourlyRate] = useState('50000');
  const [remark, setRemark] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [primaryStudentId, setPrimaryStudentId] = useState<string>('');
  const [recurrences, setRecurrences] = useState<RecurrenceDraft[]>([
    createRecurrenceDraft(),
  ]);

  const { data: courses = [] } = useQuery({
    queryKey: ['csl', 'courses'],
    queryFn: async () => {
      const res = await apiClient.get<CourseOption[]>('/acm/csl/courses');
      return res.data;
    },
    enabled: open,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['acm', 'teachers'],
    queryFn: async () => {
      const res = await apiClient.get<TeacherDetail[] | { items: TeacherDetail[] }>(
        '/acm/tch/teachers',
        { params: { status: 'ACTIVE', limit: 200 } },
      );
      const body = res.data;
      const rows = Array.isArray(body) ? body : (body?.items ?? []);
      return rows.filter((teacher) => teacher.userId);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const { data: studentsData } = useStudents({
    status: 'ACTIVE',
    limit: 200,
  });

  const students = studentsData?.items ?? [];
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => {
      const school = student.school ?? '';
      const grade = student.grade ?? '';
      return [student.name, student.englishName ?? '', school, grade]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [studentSearch, students]);

  const courseLabelMap = useMemo(
    () =>
      new Map(
        courses.map((course) => [course.id, `${course.code} - ${course.name}`]),
      ),
    [courses],
  );

  const selectedStudents = useMemo(
    () => students.filter((student) => selectedStudentIds.includes(student.id)),
    [selectedStudentIds, students],
  );

  const resetForm = () => {
    setSubjectType('OTHER');
    setCourseId('');
    setTeacherUserId('');
    setStartedAt(new Date().toISOString().slice(0, 10));
    setEndedAt('');
    setHourlyRate('50000');
    setRemark('');
    setStudentSearch('');
    setSelectedStudentIds([]);
    setPrimaryStudentId('');
    setRecurrences([createRecurrenceDraft()]);
  };

  const toggleStudent = (student: StudentSummary) => {
    setSelectedStudentIds((current) => {
      if (current.includes(student.id)) {
        const next = current.filter((id) => id !== student.id);
        if (primaryStudentId === student.id) {
          setPrimaryStudentId(next[0] ?? '');
        }
        return next;
      }
      const next = [...current, student.id];
      if (!primaryStudentId) {
        setPrimaryStudentId(student.id);
      }
      return next;
    });
  };

  const updateRecurrence = <K extends keyof RecurrenceDraft>(
    id: string,
    key: K,
    value: RecurrenceDraft[K],
  ) => {
    setRecurrences((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  };

  const removeRecurrence = (id: string) => {
    setRecurrences((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [createRecurrenceDraft()];
    });
  };

  const onSubmit = async () => {
    if (!teacherUserId) {
      toast.error('강사를 선택해 주세요.');
      return;
    }
    if (!startedAt) {
      toast.error('개강일을 입력해 주세요.');
      return;
    }
    if (selectedStudentIds.length === 0) {
      toast.error('학생을 한 명 이상 선택해 주세요.');
      return;
    }
    if (!primaryStudentId) {
      toast.error('대표 학생을 지정해 주세요.');
      return;
    }

    const validRecurrences = recurrences.filter(
      (row) => row.startTime && row.durationMin && Number(row.durationMin) > 0,
    );
    if (validRecurrences.length === 0) {
      toast.error('일정을 한 건 이상 입력해 주세요.');
      return;
    }

    const rate = Number(hourlyRate);
    if (!Number.isFinite(rate) || rate < 1) {
      toast.error('시급을 올바르게 입력해 주세요.');
      return;
    }

    const body = {
      startedFrom: 'DIRECT_ENROLLMENT',
      subjectType,
      subjectLabel: courseId ? courseLabelMap.get(courseId) : undefined,
      teacherUserId,
      isDemo: subjectType === 'DEMO',
      startedAt,
      endedAt: endedAt || undefined,
      remark: remark.trim() || undefined,
      students: selectedStudentIds.map((studentId) => ({
        studentUserId: studentId,
        hourlyRate: rate,
        capacityRole: studentId === primaryStudentId ? 'PRIMARY' : 'GROUP_PEER',
      })),
      recurrences: validRecurrences.map((row) => ({
        dayOfWeek: row.dayOfWeek,
        startTime: `${row.startTime}:00`,
        durationMin: Number(row.durationMin),
        defaultMode: row.defaultMode,
        effectiveFrom: startedAt,
      })),
    };

    try {
      const created = await createMut.mutateAsync(body);
      await apiClient.post(`/acm/cls/classes/${created.id}/sessions/generate`);
      toast.success('수업을 생성했습니다.');
      onOpenChange(false);
      resetForm();
      onCreated?.(created.id);
    } catch (creationError) {
      const message = (
        creationError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(message ?? '수업 생성에 실패했습니다.');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(false);
          resetForm();
          return;
        }
        onOpenChange(true);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create.title', { defaultValue: '수업 생성' })}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <section className="grid gap-3 rounded-md border border-[var(--border-subtle)] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">{t('create.subjectType', { defaultValue: '수업 분류' })}</Label>
                <select
                  value={subjectType}
                  onChange={(event) => setSubjectType(event.target.value as ClsSubjectType)}
                  className={selectClass}
                >
                  {SUBJECT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`subjectType.${option}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('create.course', { defaultValue: '수업 강좌' })}</Label>
                <select
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('create.coursePlaceholder', { defaultValue: '강좌 선택' })}</option>
                  {courses
                    .filter((course) => course.isActive)
                    .map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('create.teacher', { defaultValue: '강사' })}</Label>
                <select
                  value={teacherUserId}
                  onChange={(event) => setTeacherUserId(event.target.value)}
                  className={selectClass}
                >
                  <option value="">{t('create.teacherPlaceholder', { defaultValue: '강사 선택' })}</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.userId ?? ''}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('create.hourlyRate', { defaultValue: '시급(원)' })}</Label>
                <Input
                  type="number"
                  min={1}
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('create.startedAt', { defaultValue: '개강일' })}</Label>
                <Input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('create.endedAt', { defaultValue: '종강일' })}</Label>
                <Input type="date" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">{t('create.textbook', { defaultValue: '교재 / 메모' })}</Label>
              <textarea
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                className={textareaClass}
                placeholder={t('create.textbookPlaceholder', {
                  defaultValue: '교재명, 수업 메모, 운영 참고사항을 입력합니다.',
                })}
              />
            </div>
          </section>

          <section className="grid gap-3 rounded-md border border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {t('create.students', { defaultValue: '학생 선택' })}
                </h3>
                <p className="text-xs text-secondary">
                  {t('create.studentsHint', {
                    defaultValue: '대표 학생 1명을 지정하고, 나머지는 그룹 학생으로 등록됩니다.',
                  })}
                </p>
              </div>
              <span className="text-xs text-secondary">
                {selectedStudentIds.length}
                {t('create.studentsCount', { defaultValue: '명 선택됨' })}
              </span>
            </div>

            <Input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder={t('create.studentSearch', {
                defaultValue: '학생명 / 학교 / 학년 검색',
              })}
            />

            <div className="max-h-64 overflow-y-auto rounded-md border border-[var(--border-subtle)]">
              {filteredStudents.map((student) => {
                const selected = selectedStudentIds.includes(student.id);
                const isPrimary = primaryStudentId === student.id;
                return (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-sm last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleStudent(student)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{student.name}</div>
                      <div className="text-xs text-secondary">
                        {[student.school, student.grade].filter(Boolean).join(' / ') || '-'}
                      </div>
                    </div>
                    {selected && (
                      <label className="flex items-center gap-1 text-xs text-secondary">
                        <input
                          type="radio"
                          name="primary-student"
                          checked={isPrimary}
                          onChange={() => setPrimaryStudentId(student.id)}
                        />
                        {t('create.primaryStudent', { defaultValue: '대표 학생' })}
                      </label>
                    )}
                  </label>
                );
              })}
              {filteredStudents.length === 0 && (
                <div className="px-3 py-6 text-center text-sm text-secondary">
                  {t('table.empty', { defaultValue: '학생이 없습니다.' })}
                </div>
              )}
            </div>

            {selectedStudents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedStudents.map((student) => (
                  <span
                    key={student.id}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs"
                  >
                    {student.name}
                    {primaryStudentId === student.id && (
                      <span className="rounded bg-accent-50 px-1 py-0.5 text-[10px] text-accent-700">
                        {t('create.primaryStudent', { defaultValue: '대표 학생' })}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-3 rounded-md border border-[var(--border-subtle)] p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {t('create.schedule', { defaultValue: '일정 선택' })}
                </h3>
                <p className="text-xs text-secondary">
                  {t('create.scheduleHint', {
                    defaultValue: '반복 일정을 등록하면 세션이 자동 생성됩니다.',
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRecurrences((current) => [...current, createRecurrenceDraft()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t('create.addSchedule', { defaultValue: '일정 추가' })}
              </Button>
            </div>

            <div className="grid gap-3">
              {recurrences.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-3 rounded-md border border-[var(--border-subtle)] p-3 md:grid-cols-[110px_140px_120px_1fr_auto]"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">{t('recurrence.dayOfWeek', { defaultValue: '요일' })}</Label>
                    <select
                      value={row.dayOfWeek}
                      onChange={(event) =>
                        updateRecurrence(row.id, 'dayOfWeek', event.target.value as RecurrenceDraft['dayOfWeek'])
                      }
                      className={selectClass}
                    >
                      {DAY_OPTIONS.map((day) => (
                        <option key={day} value={day}>
                          {t(`recurrence.days.${day}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-xs">{t('recurrence.startTime', { defaultValue: '시작 시각' })}</Label>
                    <Input
                      type="time"
                      step={1800}
                      value={row.startTime}
                      onChange={(event) => updateRecurrence(row.id, 'startTime', event.target.value)}
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-xs">{t('recurrence.duration', { defaultValue: '수업 시간' })}</Label>
                    <Input
                      type="number"
                      min={30}
                      step={30}
                      value={row.durationMin}
                      onChange={(event) => updateRecurrence(row.id, 'durationMin', event.target.value)}
                    />
                  </div>

                  <div className="grid gap-1">
                    <Label className="text-xs">{t('recurrence.defaultMode', { defaultValue: '수업 방식' })}</Label>
                    <select
                      value={row.defaultMode}
                      onChange={(event) =>
                        updateRecurrence(
                          row.id,
                          'defaultMode',
                          event.target.value as RecurrenceDraft['defaultMode'],
                        )
                      }
                      className={selectClass}
                    >
                      {MODE_OPTIONS.map((mode) => (
                        <option key={mode} value={mode}>
                          {t(`session.modes.${mode}`)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRecurrence(row.id)}
                      disabled={recurrences.length === 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="md:col-span-5 text-[11px] text-secondary">
                    {t('create.scheduleRowLabel', {
                      defaultValue: '{{index}}번째 일정',
                      index: index + 1,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={createMut.isPending}>
            {createMut.isPending
              ? t('common:actions.saving')
              : t('actions.createClass')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createRecurrenceDraft(): RecurrenceDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dayOfWeek: 'MON',
    startTime: '15:00',
    durationMin: '60',
    defaultMode: 'ONLINE',
  };
}
