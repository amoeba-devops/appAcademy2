import { useTranslation } from 'react-i18next';
import { TPI_PROCESS_KEYS } from '@/modules/portal/content/tpi-content';

export function EnrollmentProcess() {
  const { t } = useTranslation('portal');
  return (
    <section className="bg-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          {t('home.process.title')}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-400" aria-hidden="true" />
        <ol className="mt-14 grid gap-4 lg:grid-cols-5">
          {TPI_PROCESS_KEYS.map((key, idx) => (
            <li
              key={key}
              className="relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <span className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">
                {t(`home.process.${key}-step`)}
              </span>
              <p className="mt-3 text-sm font-semibold leading-snug text-white sm:text-base">
                {t(`home.process.${key}-title`)}
              </p>
              <span
                aria-hidden="true"
                className="absolute -top-3 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white shadow-lg"
              >
                {idx + 1}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
