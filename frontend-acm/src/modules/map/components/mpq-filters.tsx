import { useTranslation } from 'react-i18next';
import type { MpqGrade, MpqStatus } from '../types';

export interface MpqFilterValue {
  q: string;
  grade: MpqGrade | 'ALL';
  hasAnswer: 'ALL' | 'YES' | 'NO';
  paired: boolean;
  status: MpqStatus | 'ALL';
}

export interface MpqFiltersProps {
  value: MpqFilterValue;
  onChange: (next: MpqFilterValue) => void;
}

const selectClass =
  'h-9 rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent-500/40';
const inputClass =
  'h-9 flex-1 min-w-[200px] rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-500/40';

export function MpqFilters({ value, onChange }: MpqFiltersProps) {
  const { t } = useTranslation('mpq');
  const set = <K extends keyof MpqFilterValue>(k: K, v: MpqFilterValue[K]) =>
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
        aria-label={t('filter.grade')}
        value={value.grade}
        onChange={(e) => set('grade', e.target.value as MpqFilterValue['grade'])}
        className={selectClass}
      >
        <option value="ALL">{t('filter.allGrades')}</option>
        <option value="G2">G2</option>
        <option value="G3">G3</option>
        <option value="G4">G4</option>
      </select>
      <select
        aria-label={t('filter.hasAnswer')}
        value={value.hasAnswer}
        onChange={(e) => set('hasAnswer', e.target.value as MpqFilterValue['hasAnswer'])}
        className={selectClass}
      >
        <option value="ALL">{t('filter.answerAll')}</option>
        <option value="YES">{t('filter.answerYes')}</option>
        <option value="NO">{t('filter.answerNo')}</option>
      </select>
      <select
        aria-label={t('filter.status')}
        value={value.status}
        onChange={(e) => set('status', e.target.value as MpqFilterValue['status'])}
        className={selectClass}
      >
        <option value="ALL">{t('filter.statusAll')}</option>
        <option value="PUBLISHED">{t('status.PUBLISHED')}</option>
        <option value="DRAFT">{t('status.DRAFT')}</option>
        <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
      </select>
      <label className="flex items-center gap-1.5 text-sm text-secondary">
        <input
          type="checkbox"
          checked={value.paired}
          onChange={(e) => set('paired', e.target.checked)}
        />
        {t('filter.pairedOnly')}
      </label>
    </div>
  );
}
