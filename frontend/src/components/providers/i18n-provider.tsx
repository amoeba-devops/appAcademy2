'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from '@/i18n/config';
import { installZodI18n } from '@/i18n/zod-error-map';

installZodI18n();

function detectClientLocale(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
      return saved;
    }
  } catch {
    // localStorage unavailable (private mode, quota, SSR edge) — fall through.
  }

  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  if ((SUPPORTED_LOCALES as readonly string[]).includes(nav)) return nav;
  const short = nav.split('-')[0];
  if ((SUPPORTED_LOCALES as readonly string[]).includes(short)) return short;

  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const detected = detectClientLocale();
    if (detected !== i18n.language) {
      void i18n.changeLanguage(detected).then(() => {
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, detected);
        } catch {
          // ignore — persistence is best-effort
        }
      });
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
