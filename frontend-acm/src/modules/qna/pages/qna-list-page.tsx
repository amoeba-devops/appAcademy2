import { useTranslation } from 'react-i18next';

export function QnaListPage() {
  const { t } = useTranslation('qna');
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">{t('title')}</h1>
      <div className="rounded-lg bg-surface border border-[var(--border-subtle)] p-6 text-secondary">
        {t('todo')}
      </div>
    </div>
  );
}
