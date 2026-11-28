import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HEX_RE, PRESET_COLORS, toneOf } from '../lib/cal-colors';

/**
 * REQ-261128-CAL — color picker: swatch button → native picker + HEX input +
 * quick picks + card preview. Opens inline (no popover) so it works in dialogs
 * and on phones.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  preview,
}: {
  value: string;
  onChange: (hex: string) => void;
  /** Accessible name, e.g. the category name. */
  label: string;
  /** Text shown in the preview card. */
  preview?: string;
}) {
  const { t } = useTranslation('cal');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = !HEX_RE.test(text);
  const [bg, fg, border] = toneOf(value);

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t('colors.picker.open', { name: label })}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-9 items-center gap-2 rounded border bg-surface px-2 text-xs sm:min-h-0 sm:py-1"
      >
        <span
          className="h-5 w-5 shrink-0 rounded border"
          style={{ backgroundColor: value, borderColor: border }}
        />
        <span className="font-mono">{value.toUpperCase()}</span>
      </button>
      {open && (
        <div id={id} className="mt-2 space-y-2 rounded border bg-surface p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              aria-label={t('colors.picker.pick', { name: label })}
              value={value}
              onChange={(e) => onChange(e.target.value.toLowerCase())}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
            />
            <label className="flex items-center gap-1 text-xs">
              HEX
              <input
                value={text}
                maxLength={7}
                aria-invalid={invalid}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  const next = v.startsWith('#') ? v : `#${v}`;
                  setText(next);
                  if (HEX_RE.test(next)) onChange(next.toLowerCase());
                }}
                className={`w-24 rounded border p-1 font-mono text-base sm:text-xs ${invalid ? 'border-red-500' : ''}`}
              />
            </label>
          </div>
          {invalid && (
            <p role="alert" className="text-xs text-red-700">
              {t('colors.picker.invalid')}
            </p>
          )}
          <div>
            <span className="text-xs text-secondary">{t('colors.picker.presets')}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRESET_COLORS.map((p) => (
                <button
                  type="button"
                  key={p}
                  aria-label={`${label}: ${p}`}
                  aria-pressed={value === p}
                  onClick={() => onChange(p)}
                  className={`h-9 w-9 rounded-full border sm:h-6 sm:w-6 ${value === p ? 'ring-2 ring-accent-500 ring-offset-2' : ''}`}
                  style={{ backgroundColor: p }}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-secondary">{t('colors.picker.preview')}</span>
            <div
              className="mt-1 truncate rounded border-l-4 px-2 py-1 text-xs"
              style={{ backgroundColor: bg, color: fg, borderColor: border }}
            >
              {preview ?? label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
