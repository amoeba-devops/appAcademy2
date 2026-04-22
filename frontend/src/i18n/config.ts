'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

// Default-locale translations are bundled statically so SSR and the first
// client render resolve `t(...)` from identical, synchronous data. Without
// this, HttpBackend fetches translations async and the first client paint
// races hydration — producing React #418 / #423 / #425 mismatches.
import koCommon from '../../public/locales/ko/common.json';
import koValidation from '../../public/locales/ko/validation.json';
import koErrors from '../../public/locales/ko/errors.json';
import koPortal from '../../public/locales/ko/portal.json';
import koAdmin from '../../public/locales/ko/admin.json';

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
      // Ship ko resources in the bundle; other locales fetch on demand
      // (post-hydration, when the user switches language).
      resources: {
        ko: {
          common: koCommon,
          validation: koValidation,
          errors: koErrors,
          portal: koPortal,
          admin: koAdmin,
        },
      },
      // Required when mixing `resources` with a backend: lets HttpBackend
      // still fetch namespaces for locales not present in `resources`.
      partialBundledLanguages: true,
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
      },
      react: { useSuspense: false },
    });
}

export default i18n;
