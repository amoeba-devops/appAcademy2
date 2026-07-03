import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CslListFiltersValue {
  q: string;
  stage: string;
  inflowType: string;
  applyType: string;
  applyPurpose: string;
  registeredFrom: string;
  registeredTo: string;
  followupState: '' | 'SET' | 'EMPTY';
}

const STAGES = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'DROPPED',
] as const;

const INFLOW_TYPES = ['HOMEPAGE', 'KAKAO_CHANNEL', 'PHONE'] as const;
const APPLY_TYPES = ['COUNSELING_ONLY', 'EXAM_ONLY', 'BOTH'] as const;
const APPLY_PURPOSES = [
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
  value: CslListFiltersValue;
  onChange: <K extends keyof CslListFiltersValue>(
    key: K,
    next: CslListFiltersValue[K],
  ) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation(['csl', 'common']);

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4 mb-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(120px,1fr))]">
        <Input
          value={value.q}
          onChange={(e) => onChange('q', e.target.value)}
          placeholder={t('filters.searchPlaceholder', {
            defaultValue: '학생명 / 학부모명 검색',
          })}
        />
        <Select
          value={value.stage}
          onChange={(e) => onChange('stage', e.target.value)}
        >
          <option value="">{t('filters.allStages', { defaultValue: '전체 단계' })}</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {t(`stage.${stage}`)}
            </option>
          ))}
        </Select>
        <Select
          value={value.inflowType}
          onChange={(e) => onChange('inflowType', e.target.value)}
        >
          <option value="">{t('filters.allInflows', { defaultValue: '전체 유입' })}</option>
          {INFLOW_TYPES.map((item) => (
            <option key={item} value={item}>
              {t(`inflow.${item}`)}
            </option>
          ))}
        </Select>
        <Select
          value={value.applyType}
          onChange={(e) => onChange('applyType', e.target.value)}
        >
          <option value="">{t('filters.allApplyTypes', { defaultValue: '전체 신청유형' })}</option>
          {APPLY_TYPES.map((item) => (
            <option key={item} value={item}>
              {t(`applyType.${item}`)}
            </option>
          ))}
        </Select>
        <Select
          value={value.applyPurpose}
          onChange={(e) => onChange('applyPurpose', e.target.value)}
        >
          <option value="">
            {t('filters.allPurposes', { defaultValue: '전체 신청목적' })}
          </option>
          {APPLY_PURPOSES.map((item) => (
            <option key={item} value={item}>
              {t(`applyPurpose.${item}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 mt-3 md:grid-cols-2 xl:grid-cols-[repeat(2,minmax(140px,1fr))_minmax(140px,1fr)_auto]">
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
        <Select
          value={value.followupState}
          onChange={(e) =>
            onChange('followupState', e.target.value as CslListFiltersValue['followupState'])
          }
        >
          <option value="">
            {t('filters.followup.all', { defaultValue: '전체 팔로업' })}
          </option>
          <option value="SET">
            {t('filters.followup.set', { defaultValue: '팔로업 있음' })}
          </option>
          <option value="EMPTY">
            {t('filters.followup.empty', { defaultValue: '팔로업 없음' })}
          </option>
        </Select>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onReset}>
            {t('common:actions.reset', { defaultValue: '초기화' })}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
    />
  );
}
