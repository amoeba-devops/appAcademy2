import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useMapApplyDetail,
  useUpdateMapApply,
  type MapApplyGender,
} from '@/modules/csl/hooks/use-map-applications';

interface EditState {
  studentNameEn: string;
  birthdate: string;
  gender: MapApplyGender | '';
  examLocation: string;
  preferredSlot: string;
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
      <span className="text-xs text-secondary">{label}</span>
      <span className="text-sm text-primary">{value}</span>
    </div>
  );
}

/** CSL-PLN-260916 — `/admin/test/:id` 맵테스트 신청 상세. */
export function MapApplyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(['csl', 'common']);
  const toast = useToast();
  const { data, isLoading, isError } = useMapApplyDetail(id);
  const update = useUpdateMapApply(id ?? '');
  const [edit, setEdit] = useState<EditState | null>(null);

  useEffect(() => {
    if (!data) return;
    setEdit({
      studentNameEn: data.studentNameEn ?? '',
      birthdate: data.birthdate ?? data.birthdateRaw ?? '',
      gender: data.gender ?? '',
      examLocation: data.examLocation ?? '',
      preferredSlot: data.preferredSlot ?? '',
    });
  }, [data]);

  if (isLoading) return <p className="text-secondary">{t('common:status.loading')}</p>;
  if (isError || !data || !edit)
    return <p className="text-red-600">{t('mapApply.loadFailed')}</p>;

  const onSave = async () => {
    try {
      await update.mutateAsync({
        studentNameEn: edit.studentNameEn,
        birthdate: edit.birthdate,
        gender: edit.gender === '' ? null : edit.gender,
        examLocation: edit.examLocation,
        preferredSlot: edit.preferredSlot,
      });
      toast.success(t('mapApply.saved'));
    } catch {
      toast.error(t('mapApply.saveFailed'));
    }
  };

  const set = <K extends keyof EditState>(k: K, v: EditState[K]) =>
    setEdit((s) => (s ? { ...s, [k]: v } : s));

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/admin/test"
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft size={16} />
          {t('mapApply.backToList')}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/csl/${data.inqId}`}
            className="inline-flex items-center gap-1 text-sm text-accent-700 hover:underline"
          >
            {t('mapApply.openInquiry')}
            <ExternalLink size={14} />
          </Link>
          <Button size="sm" onClick={onSave} disabled={update.isPending}>
            {update.isPending ? t('common:actions.saving') : t('common:actions.save')}
          </Button>
        </div>
      </div>

      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">
          {t('mapApply.detailTitle', { seqNo: data.seqNo })}
        </h1>
        <span className="rounded bg-[var(--canvas-subtle)] px-2 py-0.5 text-xs">
          {t(`stage.${data.currentStage}`)}
        </span>
        <span className="text-sm text-secondary">
          {t(`sourceSite.${data.sourceSite}`)}
        </span>
        <span className="text-xs text-secondary">
          {new Date(data.submittedAt).toLocaleString()} {t('mapApply.submitted')}
        </span>
      </header>

      {/* 신청서 원본 */}
      <section className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium">{t('mapApply.section.original')}</h2>

        <ReadRow label={t('mapApply.field.studentName')} value={data.studentName} />

        <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
          <Label className="text-xs text-secondary">
            {t('mapApply.field.studentNameEn')}
          </Label>
          <Input
            value={edit.studentNameEn}
            onChange={(e) => set('studentNameEn', e.target.value)}
            className="h-8 max-w-sm text-sm"
          />
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
          <Label className="text-xs text-secondary">
            {t('mapApply.field.birthdate')}
          </Label>
          <span className="flex items-center gap-2">
            <Input
              value={edit.birthdate}
              onChange={(e) => set('birthdate', e.target.value)}
              placeholder="YYYY-MM-DD"
              className="h-8 w-[160px] text-sm"
            />
            {data.birthdateRaw && (
              <span className="text-[11px] text-amber-700">
                {t('mapApply.birthdateRaw', { raw: data.birthdateRaw })}
              </span>
            )}
          </span>
        </div>

        <ReadRow label={t('mapApply.field.grade')} value={data.grade ?? '—'} />

        <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
          <Label className="text-xs text-secondary">
            {t('mapApply.field.gender')}
          </Label>
          <select
            className="h-8 rounded-md border border-[var(--border-subtle)] bg-surface px-2 text-sm"
            value={edit.gender}
            onChange={(e) => set('gender', e.target.value as EditState['gender'])}
          >
            <option value="">{t('mapApply.gender.none')}</option>
            <option value="M">{t('mapApply.gender.M')}</option>
            <option value="F">{t('mapApply.gender.F')}</option>
          </select>
        </div>

        <ReadRow
          label={t('mapApply.field.parentPhone')}
          value={data.parentPhone ?? '—'}
        />
        <ReadRow
          label={t('mapApply.field.parentEmail')}
          value={data.parentEmail ?? '—'}
        />

        <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
          <Label className="text-xs text-secondary">
            {t('mapApply.field.examLocation')}
          </Label>
          <Input
            value={edit.examLocation}
            onChange={(e) => set('examLocation', e.target.value)}
            className="h-8 max-w-sm text-sm"
          />
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-2 py-1.5">
          <Label className="text-xs text-secondary">
            {t('mapApply.field.preferredSlot')}
          </Label>
          <Input
            value={edit.preferredSlot}
            onChange={(e) => set('preferredSlot', e.target.value)}
            className="h-8 max-w-sm text-sm"
          />
        </div>
      </section>

      {/* 운영 정보 (읽기 전용 — 편집은 상담 상세에서) */}
      <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium">{t('mapApply.section.ops')}</h2>
        <ReadRow
          label={t('mapApply.field.registeredAt')}
          value={data.registeredAt}
        />
        <ReadRow
          label={t('mapApply.field.followupAt')}
          value={data.followupAt ?? '—'}
        />
        <ReadRow
          label={t('mapApply.field.followupMemo')}
          value={data.followupMemo ?? '—'}
        />
        <p className="mt-3 text-[11px] text-secondary">{t('mapApply.opsNote')}</p>
      </section>
    </div>
  );
}
