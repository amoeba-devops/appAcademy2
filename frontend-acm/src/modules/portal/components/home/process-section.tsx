import { useTranslation } from 'react-i18next';

interface ProcessStep {
  key: 's1' | 's2' | 's3' | 's4' | 's5';
  icon: string;
}

const GROUPS: Array<{ labelKey: string; steps: ProcessStep[] }> = [
  {
    labelKey: 'home.process.group1-label',
    steps: [
      { key: 's1', icon: 'https://i.ifh.cc/xC3KAv.png' },
      { key: 's2', icon: 'https://i.ifh.cc/MBXTk5.png' },
      { key: 's3', icon: 'https://i.ifh.cc/OYQHV9.png' },
    ],
  },
  {
    labelKey: 'home.process.group2-label',
    steps: [
      { key: 's4', icon: 'https://i.ifh.cc/9X3vHk.png' },
      { key: 's5', icon: 'https://i.ifh.cc/gAX9ts.png' },
    ],
  },
];

/**
 * 2-group enrollment / learning process.
 * Replaces v1 `EnrollmentProcess` (single 5-step horizontal grid).
 * Mirrors reference (tpi-index.mhtml `#process-section` 2 `.process-group`).
 */
export function ProcessSection() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-slate-900 px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {GROUPS.map((group, gi) => (
          <div
            key={group.labelKey}
            className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10"
          >
            {/* Left label */}
            <div className="flex items-center justify-center lg:justify-start">
              <p className="text-center text-base font-medium text-blue-200 sm:text-lg lg:text-left">
                {t(group.labelKey)}
                <br />
                <strong className="block text-3xl font-bold tracking-wide text-white sm:text-4xl">
                  Process {gi + 1}
                </strong>
              </p>
            </div>

            {/* Steps */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.steps.map((step) => {
                const stepLabel = t(`home.process.${step.key}-step`);
                const stepTitle = t(`home.process.${step.key}-title`);
                return (
                  <article
                    key={step.key}
                    className="relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    <div className="flex-1">
                      <span className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
                        {stepLabel}
                      </span>
                      <p className="mt-2 text-sm font-semibold leading-snug text-white sm:text-base">
                        {stepTitle}
                      </p>
                    </div>
                    <img
                      src={step.icon}
                      alt=""
                      className="h-12 w-12 shrink-0 object-contain opacity-90 sm:h-14 sm:w-14"
                    />
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
