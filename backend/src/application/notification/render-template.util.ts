/**
 * Simple `{{variable}}` interpolation. Plain text (no escaping).
 * Undefined variables are replaced with the empty string and reported via warnings.
 *
 * @returns the rendered body and the list of variable keys referenced in the
 *          template that had no matching value.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
): { body: string; missing: string[] } {
  const missing = new Set<string>();
  const body = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const v = variables?.[key];
    if (v === undefined || v === null || v === '') {
      missing.add(key);
      return '';
    }
    return String(v);
  });
  return { body, missing: Array.from(missing) };
}
