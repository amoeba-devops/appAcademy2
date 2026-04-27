/**
 * i18n bootstrap — NFR-016 / C-006 compliance.
 *
 * Languages: Korean (default) / English / Vietnamese
 * Namespaces: common, csl, ref, sch, qna, dsh
 *
 * Persisted user choice via localStorage key `acm.lang`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from './locales/ko/common.json';
import koCsl from './locales/ko/csl.json';
import koDsh from './locales/ko/dsh.json';
import koSch from './locales/ko/sch.json';
import koRef from './locales/ko/ref.json';
import koQna from './locales/ko/qna.json';
import koCls from './locales/ko/cls.json';

import enCommon from './locales/en/common.json';
import enCsl from './locales/en/csl.json';
import enDsh from './locales/en/dsh.json';
import enSch from './locales/en/sch.json';
import enRef from './locales/en/ref.json';
import enQna from './locales/en/qna.json';
import enCls from './locales/en/cls.json';

import viCommon from './locales/vi/common.json';
import viCsl from './locales/vi/csl.json';
import viDsh from './locales/vi/dsh.json';
import viSch from './locales/vi/sch.json';
import viRef from './locales/vi/ref.json';
import viQna from './locales/vi/qna.json';
import viCls from './locales/vi/cls.json';

export const SUPPORTED_LANGS = ['ko', 'en', 'vi'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const STORAGE_KEY = 'acm.lang';
const DEFAULT_LANG: SupportedLang = 'ko';

function detectInitialLang(): SupportedLang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
      return saved as SupportedLang;
    }
  } catch {
    /* localStorage unavailable */
  }
  // Fall back to browser language prefix
  const nav = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2) : undefined;
  if (nav && (SUPPORTED_LANGS as readonly string[]).includes(nav)) {
    return nav as SupportedLang;
  }
  return DEFAULT_LANG;
}

void i18n.use(initReactI18next).init({
  lng: detectInitialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED_LANGS as unknown as string[],
  defaultNS: 'common',
  ns: ['common', 'csl', 'dsh', 'sch', 'ref', 'qna', 'cls'],
  interpolation: { escapeValue: false },
  resources: {
    ko: {
      common: koCommon,
      csl: koCsl,
      dsh: koDsh,
      sch: koSch,
      ref: koRef,
      qna: koQna,
      cls: koCls,
    },
    en: {
      common: enCommon,
      csl: enCsl,
      dsh: enDsh,
      sch: enSch,
      ref: enRef,
      qna: enQna,
      cls: enCls,
    },
    vi: {
      common: viCommon,
      csl: viCsl,
      dsh: viDsh,
      sch: viSch,
      ref: viRef,
      qna: viQna,
      cls: viCls,
    },
  },
});

export function changeLanguage(lng: SupportedLang): void {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
}

export default i18n;
