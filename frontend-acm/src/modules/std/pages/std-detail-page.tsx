import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudent, useChangeStudentStatus } from '../hooks/use-students';
import { StdStatusBadge } from '../components/std-status-badge';
import { StdFormModal } from '../components/std-form-modal';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="py-1.5">
      <dt className="text-xs text-secondary">{label}</dt>
      <dd className="text-sm text-primary">{value ?? '—'}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

export function StdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('std');
  const [showEdit, setShowEdit] = useState(false);

  const { data: student, isLoading } = useStudent(id);
  const statusMut = useChangeStudentStatus(id ?? '');

  if (isLoading) {
    return <p className="text-secondary py-12 text-center">{t('common:status.loading')}</p>;
  }

  if (!student) {
    return <p className="text-secondary py-12 text-center">{t('detail.notFound')}</p>;
  }

  const handleDeactivate = async () => {
    if (!confirm(t('detail.confirmDeactivate'))) return;
    await statusMut.mutateAsync('INACTIVE');
  };

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/std')}
            className="mb-2 flex items-center gap-1 text-sm text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            {t('detail.back')}
          </button>
          <h1 className="text-2xl font-semibold">
            {student.name}
            {student.englishName && (
              <span className="ml-2 text-lg text-secondary">({student.englishName})</span>
            )}
          </h1>
          <div className="mt-1">
            <StdStatusBadge status={student.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil size={14} className="mr-1" />
            {t('actions.edit')}
          </Button>
          {student.status === 'ACTIVE' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivate}
              disabled={statusMut.isPending}
            >
              <UserX size={14} className="mr-1" />
              {t('actions.deactivate')}
            </Button>
          )}
        </div>
      </div>

      {/* 기본 인적사항 */}
      <Section title={t('form.sectionBasic')}>
        <InfoRow label={t('field.name')} value={student.name} />
        <InfoRow label={t('field.englishName')} value={student.englishName} />
        <InfoRow
          label={t('field.gender')}
          value={student.gender === 'M' ? t('gender.M') : student.gender === 'F' ? t('gender.F') : undefined}
        />
        <InfoRow label={t('field.birthDate')} value={student.birthDate} />
        <InfoRow label={t('field.phone')} value={student.phone} />
        <InfoRow label={t('field.residence')} value={student.residence} />
        <InfoRow label={t('field.school')} value={student.school} />
        <InfoRow label={t('field.grade')} value={student.grade} />
        <InfoRow label={t('field.startDate')} value={student.startDate} />
      </Section>

      {/* MAP 점수 */}
      <Section title={t('form.sectionMap')}>
        <InfoRow label={t('field.mapReading')} value={student.mapReading} />
        <InfoRow label={t('field.mapMath')} value={student.mapMath} />
        <InfoRow label={t('field.mapLanguage')} value={student.mapLanguage} />
        <div className="col-span-2 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t('field.mapNote')}</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">{student.mapNote ?? '—'}</dd>
        </div>
      </Section>

      {/* 수업 정보 */}
      <Section title={t('form.sectionClass')}>
        <InfoRow label={t('field.teacher')} value={student.teacher} />
        <InfoRow label={t('field.subject')} value={student.subject} />
        <InfoRow label={t('field.curriculum')} value={student.curriculum} />
        <InfoRow label={t('field.materials')} value={student.materials} />
        <InfoRow label={t('field.mobility')} value={student.mobility} />
        <InfoRow label={t('field.gpa')} value={student.gpa} />
        <InfoRow label={t('field.ssatIseeNote')} value={student.ssatIseeNote} />
      </Section>

      {/* 메모 */}
      <Section title={t('form.sectionMemo')}>
        <div className="col-span-2 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t('field.goalsNote')}</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">{student.goalsNote ?? '—'}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3 py-1.5">
          <dt className="text-xs text-secondary">{t('field.specialNote')}</dt>
          <dd className="text-sm text-primary whitespace-pre-wrap">{student.specialNote ?? '—'}</dd>
        </div>
        <InfoRow label={t('field.satisfactionNote')} value={student.satisfactionNote} />
        <InfoRow label={t('field.lastCounselDate')} value={student.lastCounselDate} />
      </Section>

      <p className="text-xs text-secondary">
        {t('detail.updatedAt')}: {new Date(student.updatedAt).toLocaleString()}
      </p>

      <StdFormModal open={showEdit} onClose={() => setShowEdit(false)} initial={student} />
    </div>
  );
}
