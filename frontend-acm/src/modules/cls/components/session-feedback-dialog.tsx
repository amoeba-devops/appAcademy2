import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useFeedback } from '../hooks/use-sessions';
import { useUpsertSessionFeedback } from '../hooks/use-class-mutations';
import type { ClassStudent, FbkStatus, Session } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  session: Session | null;
  students: ClassStudent[];
}

const STATUS_OPTIONS: FbkStatus[] = ['DRAFT', 'SUBMITTED', 'DELIVERED_TO_PARENT'];
const textareaClass =
  'min-h-[96px] w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const selectClass =
  'h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

export function SessionFeedbackDialog({ open, onOpenChange, session, students }: Props) {
  const { t } = useTranslation(['cls', 'common']);
  const toast = useToast();
  const { data: feedbackRows = [], isLoading } = useFeedback(session?.id);
  const upsertMut = useUpsertSessionFeedback(session?.id);
  const [studentUserId, setStudentUserId] = useState('');
  const [status, setStatus] = useState<FbkStatus>('DRAFT');
  const [progress, setProgress] = useState('');
  const [feedback, setFeedback] = useState('');
  const [homework, setHomework] = useState('');
  const [weaknessDev, setWeaknessDev] = useState('');
  const [academicPlan, setAcademicPlan] = useState('');

  const studentNameMap = useMemo(
    () => new Map(students.map((student) => [student.studentUserId, student.studentName ?? student.studentUserId])),
    [students],
  );

  useEffect(() => {
    if (!open) return;
    const defaultStudent = feedbackRows[0]?.studentUserId ?? students[0]?.studentUserId ?? '';
    setStudentUserId(defaultStudent);
  }, [feedbackRows, open, students, session?.id]);

  const currentRow = useMemo(
    () => feedbackRows.find((row) => row.studentUserId === studentUserId) ?? null,
    [feedbackRows, studentUserId],
  );

  useEffect(() => {
    if (!open) return;
    setStatus(currentRow?.status ?? 'DRAFT');
    setProgress(currentRow?.progress ?? '');
    setFeedback(currentRow?.feedback ?? '');
    setHomework(currentRow?.homework ?? '');
    setWeaknessDev(currentRow?.weaknessDev ?? '');
    setAcademicPlan(currentRow?.academicPlan ?? '');
  }, [currentRow, open]);

  const onSubmit = async () => {
    if (!session?.id) return;
    if (!studentUserId) {
      toast.error('학생을 선택해 주세요.');
      return;
    }
    try {
      await upsertMut.mutateAsync({
        studentUserId,
        status,
        progress: progress || undefined,
        feedback: feedback || undefined,
        homework: homework || undefined,
        weaknessDev: weaknessDev || undefined,
        academicPlan: academicPlan || undefined,
      });
      toast.success('피드백을 저장했습니다.');
    } catch (saveError) {
      const message = (
        saveError as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      toast.error(message ?? '피드백 저장에 실패했습니다.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('actions.writeFeedback')}</DialogTitle>
        </DialogHeader>

        {!session ? (
          <p className="text-sm text-secondary">{t('common:status.loading')}</p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">{t('table.students', { defaultValue: '학생' })}</Label>
                <select
                  value={studentUserId}
                  onChange={(event) => setStudentUserId(event.target.value)}
                  className={selectClass}
                >
                  {students.map((student) => (
                    <option key={student.studentUserId} value={student.studentUserId}>
                      {student.studentName ?? student.studentUserId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">{t('feedback.title')}</Label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as FbkStatus)}
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {t(`feedback.statuses.${option}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {currentRow && (
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--gray-50)] px-3 py-2 text-xs text-secondary">
                <div>
                  {studentNameMap.get(currentRow.studentUserId)}
                  {currentRow.slaBreached ? (
                    <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-red-700">
                      {t('feedback.slaBreached')}
                    </span>
                  ) : null}
                </div>
                {currentRow.deliveredToParentAt && (
                  <div className="mt-1">
                    {t('feedback.statuses.DELIVERED_TO_PARENT')}:{' '}
                    {new Date(currentRow.deliveredToParentAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <Field label={t('feedback.progress')}>
              <textarea
                value={progress}
                onChange={(event) => setProgress(event.target.value)}
                className={textareaClass}
              />
            </Field>

            <Field label={t('feedback.feedback')}>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                className={textareaClass}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('feedback.homework')}>
                <textarea
                  value={homework}
                  onChange={(event) => setHomework(event.target.value)}
                  className={textareaClass}
                />
              </Field>

              <Field label={t('feedback.weaknessDev')}>
                <textarea
                  value={weaknessDev}
                  onChange={(event) => setWeaknessDev(event.target.value)}
                  className={textareaClass}
                />
              </Field>
            </div>

            <Field label={t('feedback.academicPlan')}>
              <textarea
                value={academicPlan}
                onChange={(event) => setAcademicPlan(event.target.value)}
                className={textareaClass}
              />
            </Field>

            {isLoading && (
              <p className="text-sm text-secondary">{t('common:status.loading')}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={upsertMut.isPending}>
            {upsertMut.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
