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

/**
 * DSN-260629 §3.1 — stepper navigates between stages. Stages at or before
 * `currentStage` are clickable (operator can review past data). Future
 * stages are disabled — clicking them would have no data to show. The
 * forward-transition gate still lives on the header "→ STAGE" buttons.
 */
export function CslStageStepper({
  currentStage,
  selectedStage,
  onSelect,
}: {
  currentStage: CslStage;
  selectedStage?: CslStage;
  onSelect?: (stage: CslStage) => void;
}) {
  const { t } = useTranslation('csl');
  const isDropped = currentStage === 'DROPPED';
  const currentIdx = isDropped ? -1 : ORDER.indexOf(currentStage);
  const selectedIdx = selectedStage ? ORDER.indexOf(selectedStage) : currentIdx;

  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-2">
      {ORDER.map((s, i) => {
        // "Done" = past stages relative to currentStage (server truth)
        const done = currentIdx > i;
        // "Active" = the stage the panel is currently showing
        const active = selectedIdx === i;
        // Future stages (past currentIdx) are not yet reached → no data
        const reachable = i <= currentIdx && !isDropped;
        const clickable = !!onSelect && reachable;

        return (
          <li key={s} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(s)}
              aria-current={active ? 'step' : undefined}
              title={
                !reachable
                  ? t('stepper.notReached', '아직 도달하지 않은 단계입니다')
                  : undefined
              }
              className={
                `flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition ` +
                (active
                  ? 'border-accent-500 bg-accent-50 text-accent-700 font-medium ring-2 ring-accent-200'
                  : done
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : reachable
                      ? 'border-[var(--border-subtle)] bg-surface text-secondary hover:bg-[var(--surface-strong)]'
                      : 'border-[var(--border-subtle)] bg-surface text-secondary opacity-50 cursor-not-allowed')
              }
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
            </button>
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
