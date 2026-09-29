import { useId, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  formatTuition,
  parseTuitionInput,
  tuitionCaret,
} from "../lib/tuition-format";
export function TuitionInput({
  value,
  onChange,
  errorMessage,
}: {
  value: string;
  onChange: (value: string) => void;
  errorMessage: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const messageId = useId();
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);
  return (
    <div>
      <Input
        ref={input}
        type="text"
        inputMode="numeric"
        value={formatTuition(value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? messageId : undefined}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          const pos = el.selectionStart ?? 0;
          if (el.selectionStart !== el.selectionEnd) return;
          if (e.key === "Backspace" && el.value[pos - 1] === ",")
            el.setSelectionRange(pos - 1, pos - 1);
          if (e.key === "Delete" && el.value[pos] === ",")
            el.setSelectionRange(pos + 1, pos + 1);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const parsed = parseTuitionInput(raw);
          if (parsed === null) {
            setInvalid(true);
            e.target.setCustomValidity(errorMessage);
            return;
          }
          setInvalid(false);
          e.target.setCustomValidity("");
          const count = raw
            .slice(0, e.target.selectionStart ?? raw.length)
            .replace(/\D/g, "").length;
          const pos = tuitionCaret(formatTuition(parsed), count);
          caret.current = pos;
          onChange(parsed);
          if (parsed === value) {
            e.target.value = formatTuition(parsed);
            e.target.setSelectionRange(pos, pos);
            caret.current = null;
          }
        }}
      />
      {invalid && (
        <p id={messageId} role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
