import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { changeLanguage, SUPPORTED_LANGS, type SupportedLang } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common');
  const current = (i18n.language?.slice(0, 2) as SupportedLang) ?? 'ko';

  return (
    <label className="flex items-center gap-2 text-sm text-secondary">
      <Languages size={16} aria-hidden />
      <span className="sr-only">{t('lang.label')}</span>
      <select
        value={current}
        onChange={(e) => changeLanguage(e.target.value as SupportedLang)}
        className="h-8 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 text-sm"
        aria-label={t('lang.label')}
      >
        {SUPPORTED_LANGS.map((l) => (
          <option key={l} value={l}>
            {t(`lang.${l}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
