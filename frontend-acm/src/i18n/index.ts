/**
 * i18n bootstrap — NFR-016 / C-006 compliance.
 *
 * Languages: Korean (default) / English / Vietnamese / Simplified Chinese
 * Namespaces: common, csl, ref, sch, qna, dsh, cls
 *
 * Persisted user choice via localStorage key `acm.lang`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import koCommon from './locales/ko/common.json';
import koAuth from './locales/ko/auth.json';
import koCsl from './locales/ko/csl.json';
import koDsh from './locales/ko/dsh.json';
import koSch from './locales/ko/sch.json';
import koRef from './locales/ko/ref.json';
import koQna from './locales/ko/qna.json';
import koCls from './locales/ko/cls.json';
import koStd from './locales/ko/std.json';
import koWeb from './locales/ko/web.json';
import koTch from './locales/ko/tch.json';
import koStf from './locales/ko/stf.json';
import koCal from './locales/ko/cal.json';
import koMpq from './locales/ko/mpq.json';
import koPortal from './locales/ko/portal.json';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enCsl from './locales/en/csl.json';
import enDsh from './locales/en/dsh.json';
import enSch from './locales/en/sch.json';
import enRef from './locales/en/ref.json';
import enQna from './locales/en/qna.json';
import enCls from './locales/en/cls.json';
import enStd from './locales/en/std.json';
import enWeb from './locales/en/web.json';
import enTch from './locales/en/tch.json';
import enStf from './locales/en/stf.json';
import enCal from './locales/en/cal.json';
import enMpq from './locales/en/mpq.json';
import enPortal from './locales/en/portal.json';

import viCommon from './locales/vi/common.json';
import viAuth from './locales/vi/auth.json';
import viCsl from './locales/vi/csl.json';
import viDsh from './locales/vi/dsh.json';
import viSch from './locales/vi/sch.json';
import viRef from './locales/vi/ref.json';
import viQna from './locales/vi/qna.json';
import viCls from './locales/vi/cls.json';
import viStd from './locales/vi/std.json';
import viWeb from './locales/vi/web.json';
import viTch from './locales/vi/tch.json';
import viStf from './locales/vi/stf.json';
import viCal from './locales/vi/cal.json';
import viMpq from './locales/vi/mpq.json';
import viPortal from './locales/vi/portal.json';

import zhCommon from './locales/zh-CN/common.json';
import zhAuth from './locales/zh-CN/auth.json';
import zhCsl from './locales/zh-CN/csl.json';
import zhDsh from './locales/zh-CN/dsh.json';
import zhSch from './locales/zh-CN/sch.json';
import zhRef from './locales/zh-CN/ref.json';
import zhQna from './locales/zh-CN/qna.json';
import zhCls from './locales/zh-CN/cls.json';
import zhStd from './locales/zh-CN/std.json';
import zhWeb from './locales/zh-CN/web.json';
import zhTch from './locales/zh-CN/tch.json';
import zhStf from './locales/zh-CN/stf.json';
import zhCal from './locales/zh-CN/cal.json';
import zhMpq from './locales/zh-CN/mpq.json';
import zhPortal from './locales/zh-CN/portal.json';

export const SUPPORTED_LANGS = ['ko', 'en', 'vi', 'zh-CN'] as const;
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
  // Try full tag (e.g. "zh-CN") then language prefix ("zh", "ko", ...).
  const nav = typeof navigator !== 'undefined' ? navigator.language : undefined;
  if (nav && (SUPPORTED_LANGS as readonly string[]).includes(nav)) {
    return nav as SupportedLang;
  }
  const short = nav?.slice(0, 2);
  if (short && (SUPPORTED_LANGS as readonly string[]).includes(short)) {
    return short as SupportedLang;
  }
  return DEFAULT_LANG;
}

void i18n.use(initReactI18next).init({
  lng: detectInitialLang(),
  fallbackLng: DEFAULT_LANG,
  supportedLngs: SUPPORTED_LANGS as unknown as string[],
  defaultNS: 'common',
  ns: ['common', 'auth', 'csl', 'dsh', 'sch', 'ref', 'qna', 'cls', 'std', 'web', 'tch', 'stf', 'cal', 'mpq', 'portal'],
  interpolation: { escapeValue: false },
  resources: {
    ko: {
      common: koCommon,
      auth: koAuth,
      csl: koCsl,
      dsh: koDsh,
      sch: koSch,
      ref: koRef,
      qna: koQna,
      cls: koCls,
      std: koStd,
      web: koWeb,
      tch: koTch,
      stf: koStf,
      cal: koCal,
      mpq: koMpq,
      portal: koPortal,
    },
    en: {
      common: enCommon,
      auth: enAuth,
      csl: enCsl,
      dsh: enDsh,
      sch: enSch,
      ref: enRef,
      qna: enQna,
      cls: enCls,
      std: enStd,
      web: enWeb,
      tch: enTch,
      stf: enStf,
      cal: enCal,
      mpq: enMpq,
      portal: enPortal,
    },
    vi: {
      common: viCommon,
      auth: viAuth,
      csl: viCsl,
      dsh: viDsh,
      sch: viSch,
      ref: viRef,
      qna: viQna,
      cls: viCls,
      std: viStd,
      web: viWeb,
      tch: viTch,
      stf: viStf,
      cal: viCal,
      mpq: viMpq,
      portal: viPortal,
    },
    'zh-CN': {
      common: zhCommon,
      auth: zhAuth,
      csl: zhCsl,
      dsh: zhDsh,
      sch: zhSch,
      ref: zhRef,
      qna: zhQna,
      cls: zhCls,
      std: zhStd,
      web: zhWeb,
      tch: zhTch,
      stf: zhStf,
      cal: zhCal,
      mpq: zhMpq,
      portal: zhPortal,
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
