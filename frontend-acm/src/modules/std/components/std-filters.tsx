import { useTranslation } from 'react-i18next';

export interface StdFilterValue {
  q: string;
  status: string;
  school: string;
  grade: string;
  showInactive: boolean;
}

export interface StdFiltersProps {
  value: StdFilterValue;
  onChange: (next: StdFilterValue) => void;
}

const selectClass =
  'h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const inputClass =
  'h-9 flex-1 min-w-[180px] rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

export function StdFilters({ value, onChange }: StdFiltersProps) {
  const { t } = useTranslation('std');
  const set = <K extends keyof StdFilterValue>(k: K, v: StdFilterValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <input
        type="search"
        placeholder={t('filter.searchPlaceholder')}
        value={value.q}
        onChange={(e) => set('q', e.target.value)}
        className={inputClass}
      />

      <select
        aria-label={t('filter.labelStatus')}
        value={value.status}
        onChange={(e) => set('status', e.target.value)}
        className={selectClass}
      >
        <option value="ACTIVE">{t('status.ACTIVE')}</option>
        <option value="INACTIVE">{t('status.INACTIVE')}</option>
        <option value="WITHDRAWN">{t('status.WITHDRAWN')}</option>
        <option value="ALL">{t('filter.all')}</option>
      </select>

      <input
        type="text"
        placeholder={t('filter.schoolPlaceholder')}
        value={value.school}
        onChange={(e) => set('school', e.target.value)}
        className={`${inputClass} min-w-[120px] flex-none`}
      />

      <input
        type="text"
        placeholder={t('filter.gradePlaceholder')}
        value={value.grade}
        onChange={(e) => set('grade', e.target.value)}
        className={`${inputClass} min-w-[80px] flex-none`}
      />
    </div>
  );
}
