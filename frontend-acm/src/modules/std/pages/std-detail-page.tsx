import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil, UserX, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudent, useChangeStudentStatus } from '../hooks/use-students';
import {
  useUnlinkParentFromStudent,
  useSetPrimaryParent,
} from '../hooks/use-parents';
import { StdStatusBadge } from '../components/std-status-badge';
import { StdFormModal } from '../components/std-form-modal';
import { ParentPickOrCreateDialog } from '../components/parent-pick-or-create-dialog';
import { PortalAccountPanel } from '@/modules/portal-admin/components/portal-account-panel';

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
  const [showParentPicker, setShowParentPicker] = useState(false);

  const { data: student, isLoading } = useStudent(id);
  const statusMut = useChangeStudentStatus(id ?? '');
  const unlinkMut = useUnlinkParentFromStudent(id ?? '');
  const setPrimaryMut = useSetPrimaryParent(id ?? '');

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
          <div className="mt-1 flex items-center gap-2">
            <StdStatusBadge status={student.status} />
            {student.sourceInquiry && (
              <Link
                to={`/admin/csl/${student.sourceInquiry.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-xs text-accent-700 hover:bg-accent-100"
              >
                {t('detail.sourceInquiry', '신규상담 연결')} #{student.sourceInquiry.seqNo}
                {' · '}
                {t(`csl:stage.${student.sourceInquiry.currentStage}`, student.sourceInquiry.currentStage)}
              </Link>
            )}
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

      {/* 포털 계정 (PLN-260706) */}
      <div className="rounded-lg border border-[var(--border-subtle)] p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-secondary">
          {t('common:portalAccount.title')}
        </h3>
        <PortalAccountPanel
          kind="STUDENT"
          refId={id!}
          issueDisabled={!student.email}
          issueDisabledNote={t('common:portalAccount.emailRequired', {
            defaultValue: '학생 이메일을 등록해야 포털계정을 발급할 수 있습니다.',
          })}
        />
      </div>

      {/* 학부모 */}
      <div className="rounded-lg border border-[var(--border-subtle)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t('form.sectionParents', '학부모 정보')}
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowParentPicker(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('form.addParent', '학부모 추가')}
          </Button>
        </div>
        {(!student.parents || student.parents.length === 0) && (
          <p className="py-3 text-xs text-secondary">
            {t('form.parentsEmpty', '등록된 학부모가 없습니다. + 버튼으로 추가하세요.')}
          </p>
        )}
        <div className="divide-y divide-[var(--border-subtle)]">
          {student.parents?.map((p) => (
            <div key={p.linkId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">
                  {p.name}
                  {p.relation && (
                    <span className="ml-2 text-xs text-secondary">({p.relation})</span>
                  )}
                  {p.isPrimary && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <Star className="h-3 w-3" />
                      {t('field.parentPrimary', '대표학부모')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-secondary">
                  {p.phone ?? '—'} · {p.email ?? '—'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!p.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setPrimaryMut.isPending}
                    onClick={() => setPrimaryMut.mutate(p.id)}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {t('actions.setPrimary', '대표 지정')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unlinkMut.isPending}
                  onClick={() => {
                    if (confirm(t('actions.confirmUnlink', '이 학부모 연결을 해제하시겠습니까?'))) {
                      unlinkMut.mutate(p.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {t('actions.unlink', '해제')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-secondary">
        {t('detail.updatedAt')}: {new Date(student.updatedAt).toLocaleString()}
      </p>

      <StdFormModal open={showEdit} onClose={() => setShowEdit(false)} initial={student} />
      {id && (
        <ParentPickOrCreateDialog
          open={showParentPicker}
          onClose={() => setShowParentPicker(false)}
          stdId={id}
        />
      )}
    </div>
  );
}
