import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { changeLanguage, SUPPORTED_LANGS, type SupportedLang } from '@/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common');
  const lang = i18n.language ?? 'ko';
  const current: SupportedLang =
    (SUPPORTED_LANGS as readonly string[]).includes(lang)
      ? (lang as SupportedLang)
      : (SUPPORTED_LANGS as readonly string[]).includes(lang.slice(0, 2))
        ? (lang.slice(0, 2) as SupportedLang)
        : 'ko';

  // TST-261019 M8 — 휴대폰(<md)에서는 아이콘+언어 코드만 보이는 좁은 버튼으로 표시하고,
  // 같은 <select> 를 투명하게 겹쳐 눌렀을 때 기본 목록이 열리게 한다. 데스크톱은 그대로.
  return (
    <label className="relative flex items-center gap-2 text-sm text-secondary">
      <Languages size={16} aria-hidden className="hidden md:block" />
      <span
        aria-hidden
        className="flex h-8 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-1.5 text-xs font-medium uppercase md:hidden"
      >
        <Languages size={14} />
        {current.slice(0, 2)}
      </span>
      <span className="sr-only">{t('lang.label')}</span>
      <select
        value={current}
        onChange={(e) => changeLanguage(e.target.value as SupportedLang)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 md:static md:h-8 md:w-auto md:cursor-auto md:rounded-md md:border md:border-[var(--border-subtle)] md:bg-transparent md:px-2 md:text-sm md:opacity-100"
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
