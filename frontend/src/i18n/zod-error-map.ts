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
  return i18n.t(key as never, { ns: 'validation', ...options }) as string;
}

function resolveCustomMessage(message: string | undefined): string | null {
  if (!message) return null;
  if (!TRANSLATION_KEY_PATTERN.test(message)) return null;
  const translated = i18n.t(message as never, { defaultValue: message });
  return translated === message ? message : String(translated);
}

// zod v4 renamed/collapsed several issue codes. We cast the issue handler to
// the legacy shape so existing case labels still compile; runtime codes that
// no longer exist simply fall through to the default branch.
type LegacyIssue = { code: string; message?: unknown; received?: string; type?: string; minimum?: number; maximum?: number; validation?: string };
type LegacyCtx = { defaultError: string };

export const zodI18nErrorMap: ZodErrorMap = ((issue: LegacyIssue, ctx: LegacyCtx) => {
  const custom = resolveCustomMessage(typeof issue.message === 'string' ? issue.message : undefined);
  if (custom !== null) {
    return { message: custom };
  }

  const code = issue.code;
  switch (code) {
    case 'invalid_type': {
      if (issue.received === 'undefined' || issue.received === 'null') {
        return { message: translate('required') };
      }
      return { message: translate('invalid-type') };
    }
    case 'too_small': {
      if (issue.type === 'string') {
        return { message: translate('min-length', { count: issue.minimum }) };
      }
      return { message: translate('number-min', { min: issue.minimum }) };
    }
    case 'too_big': {
      if (issue.type === 'string') {
        return { message: translate('max-length', { count: issue.maximum }) };
      }
      return { message: translate('number-max', { max: issue.maximum }) };
    }
    // zod v4: `invalid_string` → `invalid_format`; `invalid_enum_value` → `invalid_value`.
    case 'invalid_string':
    case 'invalid_format': {
      if (issue.validation === 'email') {
        return { message: translate('email-invalid') };
      }
      return { message: translate('invalid-input') };
    }
    case 'invalid_enum_value':
    case 'invalid_value':
      return { message: translate('invalid-enum') };
    case 'custom':
      return { message: ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
}) as unknown as ZodErrorMap;

let installed = false;
export function installZodI18n() {
  if (installed) return;
  z.setErrorMap(zodI18nErrorMap);
  installed = true;
}
