import { useFieldArray, type Control, type UseFormRegister, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ParentInput } from '../types';

interface ParentSubformProps {
  control: Control<FieldValues>;
  register: UseFormRegister<FieldValues>;
}

const inputClass =
  'w-full h-9 rounded-md border border-[var(--border-subtle)] bg-canvas px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const labelClass = 'block text-xs text-secondary mb-1';

const RELATION_OPTIONS = [
  { value: 'FATHER', label: '아버지' },
  { value: 'MOTHER', label: '어머니' },
  { value: 'GUARDIAN', label: '보호자' },
  { value: 'OTHER', label: '기타' },
];

export function ParentSubform({ control, register }: ParentSubformProps) {
  const { t } = useTranslation('std');
  const { fields, append, remove } = useFieldArray({ control, name: 'stdParents' });

  const blank: ParentInput = { parName: '', parRelation: '', parPhone: '', parEmail: '', spIsPrimary: false };

  return (
    <fieldset className="rounded-md border border-[var(--border-subtle)] p-4 space-y-3">
      <legend className="text-xs font-semibold text-secondary px-1">{t('form.sectionParents', '학부모 정보')}</legend>

      {fields.length === 0 && (
        <p className="text-xs text-secondary py-2">{t('form.parentsEmpty', '등록된 학부모가 없습니다. + 버튼으로 추가하세요.')}</p>
      )}

      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="rounded-md border border-[var(--border-subtle)] p-3 space-y-2 bg-[var(--canvas-subtle)]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-primary">#{idx + 1}</span>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-danger-500 hover:text-danger-600"
              aria-label="remove parent"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('field.parentName', '이름')} *</label>
              <input
                {...register(`stdParents.${idx}.parName` as const, { required: true })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('field.parentRelation', '관계')}</label>
              <select {...register(`stdParents.${idx}.parRelation` as const)} className={inputClass}>
                <option value="">—</option>
                {RELATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('field.parentPhone', '전화번호')}</label>
              <input {...register(`stdParents.${idx}.parPhone` as const)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('field.parentEmail', '이메일')}</label>
              <input
                type="email"
                {...register(`stdParents.${idx}.parEmail` as const)}
                className={inputClass}
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id={`primary-${idx}`}
                {...register(`stdParents.${idx}.spIsPrimary` as const)}
                className="h-4 w-4"
              />
              <label htmlFor={`primary-${idx}`} className="text-xs text-secondary">
                {t('field.parentPrimary', '대표 학부모')}
              </label>
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => append(blank)}>
        <Plus className="h-4 w-4 mr-1" />
        {t('form.addParent', '학부모 추가')}
      </Button>
    </fieldset>
  );
}
