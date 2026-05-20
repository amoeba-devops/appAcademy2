import { useTranslation } from 'react-i18next';

/**
 * Phase 1 placeholder for portal pages — renders the page title from the
 * `portal` namespace plus a "Coming in Phase 3" note. Each route gets its
 * own thin wrapper so React DevTools shows a meaningful component name and
 * Phase 3 can drop in the real implementation by editing only the wrapper.
 */
function PortalStub({ titleKey, subtitleKey }: { titleKey: string; subtitleKey?: string }) {
  const { t } = useTranslation('portal');
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <h1 className="text-2xl sm:text-3xl font-semibold text-accent-700 mb-2">
        {t(titleKey, { defaultValue: titleKey })}
      </h1>
      {subtitleKey && (
        <p className="text-secondary">{t(subtitleKey, { defaultValue: '' })}</p>
      )}
      <div className="mt-8 rounded-md border border-dashed border-[var(--border-subtle)] bg-surface px-4 py-6 text-sm text-secondary">
        Coming soon — Phase 3 implementation.
      </div>
    </section>
  );
}

export function PortalHomeStub() {
  return <PortalStub titleKey="home.hero.title" subtitleKey="home.hero.subtitle" />;
}
export function AboutStub() {
  return <PortalStub titleKey="about.title" subtitleKey="about.subtitle" />;
}
export function ProgramsStub() {
  return <PortalStub titleKey="programs.title" />;
}
export function ProgramDetailStub() {
  return <PortalStub titleKey="programs.title" />;
}
export function NewsListStub() {
  return <PortalStub titleKey="news.title" />;
}
export function NewsDetailStub() {
  return <PortalStub titleKey="news.title" />;
}
