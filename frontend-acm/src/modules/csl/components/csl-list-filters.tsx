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
  /** REQ-260921B — 구분 (TUTORING | MAP_TEST) */
  kind: string;
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

export const INFLOW_TYPES = ['HOMEPAGE', 'KAKAO_CHANNEL', 'PHONE', 'WEB_EXTERNAL'] as const;
export const APPLY_TYPES = ['COUNSELING_ONLY', 'EXAM_ONLY', 'BOTH'] as const;
/**
 * 요구 260914F — 신청목적은 **접수 사이트마다 상품이 다르다.** 의미가 비슷해도
 * 합치지 않고 사이트별 코드를 유지한다(합치면 사이트별 상품 통계가 불가능).
 *
 * 라벨 원문 → 코드 매핑은 백엔드 `external-intake.config.ts` 가 갖고 있고,
 * 여기서는 **표시용 그룹핑**만 둔다. 두 곳 모두 아임웹 폼을 원본으로 삼는다.
 */
export const APPLY_PURPOSES_BY_SITE = {
  TPI: [
    'MAP_TEST_TUTORING',
    'ISEE_TUTORING',
    'INTL_SCHOOL_PREP',
    'GPA_MGMT',
    'ADVANCED_COURSES',
  ],
  TRINITY: [
    'TRI_INTL_ACCREDITED',
    'TRI_INTL_UNACCREDITED',
    'TRI_FOREIGN_SCHOOL',
    'TRI_BOARDING_PREP',
    'TRI_ALL_IN_ONE',
  ],
  SANTACROCE: [
    'SAN_EDU_AGENT',
    'SAN_US_UK_ADMISSIONS',
    'SAN_TOP_BOARDING',
    'SAN_TOP_JUNIOR_BOARDING',
    'SAN_PREMIUM_GUARDIAN',
    'SAN_INTL_CONSULTING',
  ],
} as const;

export type ApplyPurposeSite = keyof typeof APPLY_PURPOSES_BY_SITE;
export const APPLY_PURPOSE_SITES = Object.keys(
  APPLY_PURPOSES_BY_SITE,
) as ApplyPurposeSite[];

/** 전체 집합 — 콘솔 직접 등록(사이트 없음)에서 쓴다. */
export const APPLY_PURPOSES = APPLY_PURPOSE_SITES.flatMap(
  (site) => APPLY_PURPOSES_BY_SITE[site],
) as readonly string[];

/**
 * 사이트가 정해진 접수는 그 사이트 항목만, 그 외(콘솔 직접 등록)는 전체.
 * 이미 선택된 코드가 목록 밖이면(사이트 변경·과거 데이터) 뒤에 붙여 잃지 않는다.
 */
export function applyPurposeOptions(
  sourceSite?: string | null,
  selected: readonly string[] = [],
): string[] {
  const base =
    sourceSite && sourceSite in APPLY_PURPOSES_BY_SITE
      ? [...APPLY_PURPOSES_BY_SITE[sourceSite as ApplyPurposeSite]]
      : [...APPLY_PURPOSES];
  const extra = selected.filter((code) => !base.includes(code));
  return [...base, ...extra];
}

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
