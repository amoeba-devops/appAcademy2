'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko';

export const LOCALE_STORAGE_KEY = 'tac-locale';

export const NAMESPACES = [
  'common',
  'validation',
  'errors',
  'portal',
  'admin',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

// Initial language is pinned to DEFAULT_LOCALE so that server-rendered HTML
// and the first client render agree (React #425). Client-side preference
// detection runs after hydration in I18nProvider via i18n.changeLanguage().
if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      ns: NAMESPACES as unknown as string[],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      react: { useSuspense: false },
    });
}

export default i18n;
