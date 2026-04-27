import { useTranslation } from 'react-i18next';
import type { CslStage } from '@/modules/csl/pages/csl-detail-page';

const ORDER: CslStage[] = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
];

export function CslStageStepper({ currentStage }: { currentStage: CslStage }) {
  const { t } = useTranslation('csl');
  const isDropped = currentStage === 'DROPPED';
  const activeIdx = isDropped ? -1 : ORDER.indexOf(currentStage);

  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-2">
      {ORDER.map((s, i) => {
        const done = activeIdx > i;
        const active = activeIdx === i;
        return (
          <li key={s} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap ${
                active
                  ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-[var(--border-subtle)] bg-surface text-secondary'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  active
                    ? 'bg-accent-600 text-white'
                    : done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--gray-200)] text-secondary'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              {t(`stage.${s}`)}
            </div>
            {i < ORDER.length - 1 && (
              <span
                className={`h-px w-6 ${done ? 'bg-emerald-400' : 'bg-[var(--border-subtle)]'}`}
              />
            )}
          </li>
        );
      })}
      {isDropped && (
        <li className="ml-2 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 font-medium">
          {t('stage.DROPPED')}
        </li>
      )}
    </ol>
  );
}
