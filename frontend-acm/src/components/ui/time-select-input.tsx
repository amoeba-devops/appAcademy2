import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/**
 * REQ-261111 — 30분 단위 선택 목록 + 오른쪽 직접 입력 칸(HH:MM).
 * 목록에 없는 시각(10분 단위·이른 아침 등)은 직접 입력하고, 둘은 같은 값을 공유한다.
 */

/** 30분 간격 시각 목록 (fromHour:00 ~ toHour:30). */
export function halfHourSlots(fromHour: number, toHour: number): string[] {
  const out: string[] = [];
  for (let h = fromHour; h <= toHour; h++) {
    const hh = String(h).padStart(2, '0');
    out.push(`${hh}:00`, `${hh}:30`);
  }
  return out;
}

/**
 * 입력 문자열을 "HH:MM" 으로 정규화. 빈 값은 "", 잘못된 값은 null.
 * 허용: "840"·"0840" → 08:40, "8:40"·"08:40"·"08:40:00" → 08:40, "8"·"13" → 08:00·13:00.
 */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return '';
  let h: number;
  let m: number;
  let mt = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (mt) {
    h = Number(mt[1]);
    m = Number(mt[2]);
  } else if ((mt = /^(\d{1,2})$/.exec(s))) {
    h = Number(mt[1]);
    m = 0;
  } else if ((mt = /^(\d{1,2})(\d{2})$/.exec(s))) {
    h = Number(mt[1]);
    m = Number(mt[2]);
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 입력이 끝난 모양(분 두 자리까지 입력)인지 — 입력 중에도 바로 반영할지 판단. */
const looksComplete = (s: string) => /^\d{1,2}:\d{2}$|^\d{4}$/.test(s.trim());

export interface TimeSelectInputProps {
  value: string;
  onChange: (value: string) => void;
  slots: string[];
  ariaLabel?: string;
  /** 빈 값('—') 선택 허용. 기본 true. */
  allowEmpty?: boolean;
  className?: string;
  /** 선택 목록·입력 칸 공통 클래스(높이·테두리 등 화면별 모양 맞춤). */
  controlClassName?: string;
}

export function TimeSelectInput({
  value,
  onChange,
  slots,
  ariaLabel,
  allowEmpty = true,
  className,
  controlClassName,
}: TimeSelectInputProps) {
  const { t } = useTranslation('common');
  const errId = useId();
  const cur = value ? value.slice(0, 5) : '';
  const [text, setText] = useState(cur);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(cur);
    setInvalid(false);
  }, [cur]);

  const commit = (raw: string) => {
    const n = normalizeTime(raw);
    if (n === null || (n === '' && !allowEmpty)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(n);
    if (n !== cur) onChange(n);
  };

  const custom = cur && !slots.includes(cur);
  const control =
    'h-9 rounded-md border border-[var(--border-subtle)] bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex min-w-0 items-center gap-1">
        <select
          aria-label={ariaLabel}
          value={cur}
          onChange={(e) => onChange(e.target.value)}
          className={cn(control, 'min-w-0 flex-1 px-2', controlClassName)}
        >
          {(allowEmpty || !cur) && <option value="">—</option>}
          {custom && <option value={cur}>{t('timeInput.custom', { time: cur })}</option>}
          {slots.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          placeholder={t('timeInput.placeholder')}
          title={t('timeInput.manual')}
          aria-label={`${ariaLabel ? `${ariaLabel} · ` : ''}${t('timeInput.manual')}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errId : undefined}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            setInvalid(false);
            if (looksComplete(v)) {
              const n = normalizeTime(v);
              if (n && n !== cur) onChange(n);
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
            }
          }}
          className={cn(
            control,
            'w-[4.75rem] shrink-0 px-2 tabular-nums',
            invalid && 'border-red-500',
            controlClassName,
          )}
        />
      </div>
      {invalid && (
        <p id={errId} role="alert" className="text-xs text-red-600">
          {t('timeInput.invalid')}
        </p>
      )}
    </div>
  );
}
