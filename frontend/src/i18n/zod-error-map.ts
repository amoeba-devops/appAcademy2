'use client';

import { z, type ZodErrorMap } from 'zod';
import i18n from './config';

/**
 * i18next-aware zod error map.
 *
 * Rule:
 * - If the schema's `message` field already contains a colon (`ns:key.path`)
 *   or a dotted path (`validation.xxx`), it is treated as an i18n key and
 *   resolved via i18next. This is the preferred path — authors set the message
 *   to a translation key and we handle localization.
 * - Otherwise we fall back to localized defaults keyed by the zod issue code.
 *
 * All strings live under the `validation` namespace.
 */

const TRANSLATION_KEY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+|:[a-z0-9-]+(?:\.[a-z0-9-]+)*)+$/i;

function translate(key: string, options: Record<string, unknown> = {}): string {
  return i18n.t(key, { ns: 'validation', ...options }) as string;
}

function resolveCustomMessage(message: string | undefined): string | null {
  if (!message) return null;
  if (!TRANSLATION_KEY_PATTERN.test(message)) return null;
  const translated = i18n.t(message, { defaultValue: message });
  return translated === message ? message : String(translated);
}

export const zodI18nErrorMap: ZodErrorMap = (issue, ctx) => {
  const custom = resolveCustomMessage(typeof issue.message === 'string' ? issue.message : undefined);
  if (custom !== null) {
    return { message: custom };
  }

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type: {
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: translate('required') };
      }
      return { message: translate('invalid-type') };
    }
    case z.ZodIssueCode.too_small: {
      if (issue.type === 'string') {
        return { message: translate('min-length', { count: issue.minimum }) };
      }
      return { message: translate('number-min', { min: issue.minimum }) };
    }
    case z.ZodIssueCode.too_big: {
      if (issue.type === 'string') {
        return { message: translate('max-length', { count: issue.maximum }) };
      }
      return { message: translate('number-max', { max: issue.maximum }) };
    }
    case z.ZodIssueCode.invalid_string: {
      if (issue.validation === 'email') {
        return { message: translate('email-invalid') };
      }
      return { message: translate('invalid-input') };
    }
    case z.ZodIssueCode.invalid_enum_value:
      return { message: translate('invalid-enum') };
    case z.ZodIssueCode.custom:
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

let installed = false;
export function installZodI18n() {
  if (installed) return;
  z.setErrorMap(zodI18nErrorMap);
  installed = true;
}
