import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Phase 1 placeholder for /my/* parent pages. Real data fetching arrives
 * in Phase 2 (see PLN §3). Each route wraps `MyStub` so the route tree
 * stays unchanged while Phase 2 swaps the body.
 */
function MyStub({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation('portal');
  const parent = useAuthStore((s) => s.parent.user);
  return (
    <section>
      <header className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-primary">
          {t(titleKey, { defaultValue: titleKey })}
        </h1>
        {parent?.name && (
          <p className="mt-1 text-sm text-secondary">
            {t('my.welcome', { defaultValue: 'Welcome' })}, {parent.name}
          </p>
        )}
      </header>
      <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-surface px-4 py-6 text-sm text-secondary">
        Coming soon — Phase 2 implementation.
      </div>
    </section>
  );
}

export function MyDashboardStub() {
  return <MyStub titleKey="my.title" />;
}
export function MyPaymentsStub() {
  return <MyStub titleKey="my.payments-page.title" />;
}
export function MyScoresStub() {
  return <MyStub titleKey="my.scores-page.title" />;
}
export function MyTimetableStub() {
  return <MyStub titleKey="my.timetable.title" />;
}
