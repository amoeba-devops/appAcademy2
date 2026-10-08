import * as React from 'react';
import { useTranslation } from 'react-i18next';

const intermediate = (text: string) => ['-', '.', '-.'].includes(text);

export function formatNumericInput(value: string): string {
  const [integer, fraction] = value.split('.');
  return (
    integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    (fraction === undefined ? '' : `.${fraction}`)
  );
}

/** Quantity input with canonical change values. Use RHF Controller (not register) so form state never reads the formatted DOM value. */
export const NumericInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(
  (
    {
      value,
      defaultValue,
      onChange,
      onBlur,
      onKeyDown,
      min,
      max,
      step,
      required,
      type: _type,
      ...props
    },
    forwardedRef,
  ) => {
    const { t } = useTranslation('common');
    const external =
      value === undefined
        ? undefined
        : typeof value === 'number' && !Number.isFinite(value)
          ? ''
          : String(value ?? '');
    const [draft, setDraft] = React.useState(
      external ?? String(defaultValue ?? ''),
    );
    const input = React.useRef<HTMLInputElement | null>(null);
    const caret = React.useRef<number | null>(null);
    React.useEffect(() => {
      if (external !== undefined)
        setDraft((current) =>
          intermediate(current) &&
          document.activeElement === input.current &&
          (external === '' || external === '0')
            ? current
            : current !== '' &&
                external !== '' &&
                Number(current) === Number(external)
              ? current
              : external,
        );
    }, [external]);
    const display = formatNumericInput(draft);
    React.useLayoutEffect(() => {
      if (caret.current !== null) {
        input.current?.setSelectionRange(caret.current, caret.current);
        caret.current = null;
      }
      if (!input.current) return;
      const validator = document.createElement('input');
      validator.type = 'number';
      if (min !== undefined) validator.min = String(min);
      if (max !== undefined) validator.max = String(max);
      if (step !== undefined) validator.step = String(step);
      validator.required = !!required;
      validator.value =
        draft && Number.isFinite(Number(draft)) ? String(Number(draft)) : draft;
      input.current.setCustomValidity(
        draft && !Number.isFinite(Number(draft))
          ? t('numericInput.invalid')
          : validator.validationMessage,
      );
    }, [draft, display, min, max, step, required, t]);
    const setRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        input.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );
    return (
      <input
        {...props}
        ref={setRef}
        type="text"
        inputMode="decimal"
        required={required}
        value={display}
        onKeyDown={(event) => {
          const el = event.currentTarget,
            pos = el.selectionStart ?? 0;
          if (el.selectionStart === el.selectionEnd) {
            if (event.key === 'Backspace' && el.value[pos - 1] === ',')
              el.setSelectionRange(pos - 1, pos - 1);
            if (event.key === 'Delete' && el.value[pos] === ',')
              el.setSelectionRange(pos + 1, pos + 1);
          }
          onKeyDown?.(event);
        }}
        onChange={(event) => {
          const text = event.target.value;
          const raw = text.replace(/,/g, '');
          if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return;
          const prefix = text
            .slice(0, event.target.selectionStart ?? text.length)
            .replace(/,/g, '').length;
          const formatted = formatNumericInput(raw);
          let pos = 0,
            seen = 0;
          while (pos < formatted.length && seen < prefix) {
            if (formatted[pos] !== ',') seen++;
            pos++;
          }
          caret.current = pos;
          setDraft(raw);
          const canonical = intermediate(raw) ? '' : raw;
          // Controller and controlled consumers receive canonical raw numeric text.
          const target = {
            ...event.target,
            name: props.name ?? '',
            value: canonical,
            valueAsNumber: canonical === '' ? NaN : Number(canonical),
          };
          onChange?.({
            ...event,
            target,
            currentTarget: target,
          } as React.ChangeEvent<HTMLInputElement>);
          if (raw === draft) {
            event.target.value = formatted;
            event.target.setSelectionRange(pos, pos);
            caret.current = null;
          }
        }}
        onBlur={(event) => {
          const raw = ['-', '.', '-.'].includes(draft) ? '' : draft;
          if (raw !== draft) setDraft(raw);
          const target = {
            ...event.target,
            name: props.name ?? '',
            value: raw,
            valueAsNumber: raw === '' ? NaN : Number(raw),
          };
          onBlur?.({
            ...event,
            target,
            currentTarget: target,
          } as React.FocusEvent<HTMLInputElement>);
        }}
      />
    );
  },
);
NumericInput.displayName = 'NumericInput';
