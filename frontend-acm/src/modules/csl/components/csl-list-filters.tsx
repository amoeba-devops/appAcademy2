import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CslGlobalFiltersValue {
  q: string;
  registeredFrom: string;
  registeredTo: string;
}

export interface CslColumnFiltersValue {
  stage: string;
  inflowType: string;
  applyType: string;
  applyPurpose: string;
  followupState: '' | 'SET' | 'EMPTY';
}

export type CslListFiltersValue = CslGlobalFiltersValue & CslColumnFiltersValue;

export const STAGES = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'ATTENDING',
  'DROPPED',
] as const;

export const INFLOW_TYPES = ['HOMEPAGE', 'KAKAO_CHANNEL', 'PHONE'] as const;
export const APPLY_TYPES = ['COUNSELING_ONLY', 'EXAM_ONLY', 'BOTH'] as const;
export const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;

export function CslListFilters({
  value,
  onChange,
  onReset,
}: {
  value: CslGlobalFiltersValue;
  onChange: <K extends keyof CslGlobalFiltersValue>(
    key: K,
    next: CslGlobalFiltersValue[K],
  ) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4 mb-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.6fr)_repeat(2,minmax(160px,1fr))_auto]">
        <Input
          value={value.q}
          onChange={(e) => onChange('q', e.target.value)}
          placeholder={t('filters.searchPlaceholder', {
            defaultValue: '학생명 / 학부모명 검색',
          })}
        />
        <Input
          type="date"
          value={value.registeredFrom}
          onChange={(e) => onChange('registeredFrom', e.target.value)}
          aria-label={t('filters.registeredFrom', { defaultValue: '접수일 시작' })}
        />
        <Input
          type="date"
          value={value.registeredTo}
          onChange={(e) => onChange('registeredTo', e.target.value)}
          aria-label={t('filters.registeredTo', { defaultValue: '접수일 종료' })}
        />
        <div className="flex justify-end lg:justify-start">
          <Button type="button" variant="outline" onClick={onReset}>
            {t('common:actions.reset', { defaultValue: '초기화' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CslFilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
    />
  );
}
