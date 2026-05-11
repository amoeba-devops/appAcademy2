import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateStudent, useUpdateStudent } from '../hooks/use-students';
import type { ParentInput, StudentDetail } from '../types';
import { ParentSubform } from './parent-subform';

interface StdFormModalProps {
  open: boolean;
  onClose: () => void;
  initial?: StudentDetail;
}

type FormValues = {
  stdName: string;
  stdEnglishName: string;
  stdGender: string;
  stdBirthDate: string;
  stdPhone: string;
  stdEmail: string;
  stdResidence: string;
  stdSchool: string;
  stdGrade: string;
  stdMapReading: string;
  stdMapMath: string;
  stdMapLanguage: string;
  stdTeacher: string;
  stdSubject: string;
  stdCurriculum: string;
  stdMobility: string;
  stdGpa: string;
  stdGoalsNote: string;
  stdSpecialNote: string;
  stdStatus: string;
  stdStartDate: string;
  stdParents: ParentInput[];
};

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

export function StdFormModal({ open, onClose, initial }: StdFormModalProps) {
  const { t } = useTranslation('std');
  const isEdit = !!initial;

  const { register, handleSubmit, reset, control } = useForm<FormValues>({
    defaultValues: {
      stdName: initial?.name ?? '',
      stdEnglishName: initial?.englishName ?? '',
      stdGender: initial?.gender ?? '',
      stdBirthDate: initial?.birthDate ?? '',
      stdPhone: initial?.phone ?? '',
      stdEmail: initial?.email ?? '',
      stdResidence: initial?.residence ?? '',
      stdSchool: initial?.school ?? '',
      stdGrade: initial?.grade ?? '',
      stdMapReading: initial?.mapReading != null ? String(initial.mapReading) : '',
      stdMapMath: initial?.mapMath != null ? String(initial.mapMath) : '',
      stdMapLanguage: initial?.mapLanguage != null ? String(initial.mapLanguage) : '',
      stdTeacher: initial?.teacher ?? '',
      stdSubject: initial?.subject ?? '',
      stdCurriculum: initial?.curriculum ?? '',
      stdMobility: initial?.mobility ?? '',
      stdGpa: initial?.gpa ?? '',
      stdGoalsNote: initial?.goalsNote ?? '',
      stdSpecialNote: initial?.specialNote ?? '',
      stdStatus: initial?.status ?? 'ACTIVE',
      stdStartDate: initial?.startDate ?? '',
      stdParents:
        initial?.parents?.map((p) => ({
          parId: p.id,
          parName: p.name,
          parRelation: p.relation ?? '',
          parPhone: p.phone ?? '',
          parEmail: p.email ?? '',
          spIsPrimary: p.isPrimary,
        })) ?? [],
    },
  });

  const createMut = useCreateStudent();
  const updateMut = useUpdateStudent(initial?.id ?? '');
  const isLoading = createMut.isPending || updateMut.isPending;

  const onSubmit = async (values: FormValues) => {
    const dto: Record<string, unknown> = {};
    Object.entries(values).forEach(([k, v]) => {
      if (k === 'stdParents') return;
      if (v !== '') dto[k] = v;
    });
    if (dto.stdMapReading) dto.stdMapReading = Number(dto.stdMapReading);
    if (dto.stdMapMath) dto.stdMapMath = Number(dto.stdMapMath);
    if (dto.stdMapLanguage) dto.stdMapLanguage = Number(dto.stdMapLanguage);

    // Sanitize parents: drop empty rows + empty optional fields
    const cleanParents = (values.stdParents ?? [])
      .filter((p) => (p.parName ?? '').trim() !== '')
      .map((p) => {
        const o: Record<string, unknown> = { parName: p.parName.trim() };
        if (p.parId) o.parId = p.parId;
        if (p.parRelation) o.parRelation = p.parRelation;
        if (p.parPhone) o.parPhone = p.parPhone;
        if (p.parEmail) o.parEmail = p.parEmail;
        if (p.spIsPrimary) o.spIsPrimary = true;
        return o;
      });
    dto.stdParents = cleanParents;

    if (isEdit) {
      await updateMut.mutateAsync(dto);
    } else {
      await createMut.mutateAsync(dto);
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.titleEdit') : t('form.titleCreate')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {/* 기본 인적사항 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">{t('form.sectionBasic')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.name')} *</label>
                <input {...register('stdName', { required: true })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.englishName')}</label>
                <input {...register('stdEnglishName')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.gender')}</label>
                <select {...register('stdGender')} className={inputClass}>
                  <option value="">—</option>
                  <option value="M">{t('gender.M')}</option>
                  <option value="F">{t('gender.F')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.birthDate')}</label>
                <input type="date" {...register('stdBirthDate')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.phone', '전화번호')}</label>
                <input {...register('stdPhone')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.email', '이메일')}</label>
                <input type="email" {...register('stdEmail')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.residence')}</label>
                <input {...register('stdResidence')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.school')}</label>
                <input {...register('stdSchool')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.grade')}</label>
                <input {...register('stdGrade')} className={inputClass} placeholder="G5, G8, 중1…" />
              </div>
            </div>
          </fieldset>

          {/* 학부모 정보 */}
          <ParentSubform
            control={control as unknown as import('react-hook-form').Control<import('react-hook-form').FieldValues>}
            register={register as unknown as import('react-hook-form').UseFormRegister<import('react-hook-form').FieldValues>}
          />

          {/* MAP 점수 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">{t('form.sectionMap')}</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t('field.mapReading')}</label>
                <input type="number" {...register('stdMapReading')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.mapMath')}</label>
                <input type="number" {...register('stdMapMath')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.mapLanguage')}</label>
                <input type="number" {...register('stdMapLanguage')} className={inputClass} />
              </div>
            </div>
          </fieldset>

          {/* 수업 정보 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">{t('form.sectionClass')}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.teacher')}</label>
                <input {...register('stdTeacher')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.subject')}</label>
                <input {...register('stdSubject')} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>{t('field.curriculum')}</label>
                <input {...register('stdCurriculum')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.mobility')}</label>
                <input {...register('stdMobility')} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('field.gpa')}</label>
                <input {...register('stdGpa')} className={inputClass} />
              </div>
            </div>
          </fieldset>

          {/* 메모/상태 */}
          <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
            <legend className="text-xs font-semibold text-secondary px-1">{t('form.sectionMemo')}</legend>
            <div>
              <label className={labelClass}>{t('field.goalsNote')}</label>
              <textarea {...register('stdGoalsNote')} rows={2}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none" />
            </div>
            <div>
              <label className={labelClass}>{t('field.specialNote')}</label>
              <textarea {...register('stdSpecialNote')} rows={2}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('field.status')}</label>
                <select {...register('stdStatus')} className={inputClass}>
                  <option value="ACTIVE">{t('status.ACTIVE')}</option>
                  <option value="INACTIVE">{t('status.INACTIVE')}</option>
                  <option value="WITHDRAWN">{t('status.WITHDRAWN')}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t('field.startDate')}</label>
                <input type="date" {...register('stdStartDate')} className={inputClass} />
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common:status.saving') : t('common:actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
