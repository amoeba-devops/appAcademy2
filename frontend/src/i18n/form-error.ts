'use client';

import i18n from './config';

/**
 * Resolves a form error message — if the message looks like an i18n key path,
 * translate it via i18next; otherwise return as-is.
 *
 * Use this when displaying `formState.errors.<field>.message` in a UI so that
 * any message not intercepted by the global zod error map (e.g. manually set
 * server-side errors using key paths) still renders localized.
 */
const KEY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+|:[a-z0-9-]+(?:\.[a-z0-9-]+)*)+$/i;

export function tFormError(message: unknown): string | undefined {
  if (typeof message !== 'string' || !message) return undefined;
  if (!KEY_PATTERN.test(message)) return message;
  const translated = i18n.t(message, { defaultValue: message });
  return String(translated);
}
