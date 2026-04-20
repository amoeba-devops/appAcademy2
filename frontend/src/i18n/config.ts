'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

export const SUPPORTED_LOCALES = ['ko', 'en', 'vi', 'zh-CN'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ko';

export const NAMESPACES = [
  'common',
  'validation',
  'errors',
  'portal',
  'admin',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      ns: NAMESPACES as unknown as string[],
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'tac-locale',
      },
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      react: { useSuspense: false },
    });
}

export default i18n;
