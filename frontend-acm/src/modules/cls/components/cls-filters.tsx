import { useTranslation } from 'react-i18next';
import type { ClsStatus, ClsSubjectType } from '../types';

const STATUS_OPTIONS: ClsStatus[] = ['PROPOSED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
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

export interface ClsFilterValue {
  status: ClsStatus | '';
  subjectType: ClsSubjectType | '';
  teacher: string;
  search: string;
}

export interface ClsFiltersProps {
  value: ClsFilterValue;
  onChange: (next: ClsFilterValue) => void;
}

export function ClsFilters({ value, onChange }: ClsFiltersProps) {
  const { t } = useTranslation('cls');
  const set = <K extends keyof ClsFilterValue>(k: K, v: ClsFilterValue[K]) =>
    onChange({ ...value, [k]: v });

  const selectClass =
    'h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
  const inputClass =
    'h-9 flex-1 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <select
        aria-label={t('filter.labelStatus')}
        value={value.status}
        onChange={(e) => set('status', e.target.value as ClsStatus | '')}
        className={selectClass}
      >
        <option value="">{`${t('filter.labelStatus')}: ${t('filter.all')}`}</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>

      <select
        aria-label={t('filter.labelSubject')}
        value={value.subjectType}
        onChange={(e) => set('subjectType', e.target.value as ClsSubjectType | '')}
        className={selectClass}
      >
        <option value="">{`${t('filter.labelSubject')}: ${t('filter.all')}`}</option>
        {SUBJECT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {t(`subjectType.${s}`)}
          </option>
        ))}
      </select>

      <input
        aria-label={t('filter.labelTeacher')}
        value={value.teacher}
        onChange={(e) => set('teacher', e.target.value)}
        placeholder={t('filter.labelTeacher')}
        className="h-9 w-40 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/40"
      />

      <input
        aria-label={t('filter.search')}
        value={value.search}
        onChange={(e) => set('search', e.target.value)}
        placeholder={t('filter.search')}
        className={inputClass}
      />
    </div>
  );
}
