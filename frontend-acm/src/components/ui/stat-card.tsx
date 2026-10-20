import type { ReactNode } from "react";

type Tone = "default" | "accent" | "success" | "warning" | "danger";
const TONE: Record<Tone, string> = {
  default: "",
  accent: "border-l-4 border-l-[var(--acm-accent-500)]",
  success: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-500",
  danger: "border-l-4 border-l-red-500",
};

/** UI-261019 — 숫자 카드 표준: 라벨 12px / 값 24px 600 / 보조 12px. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onClick,
  active,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
      <span className="block text-xs text-secondary">{label}</span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums text-primary">{value}</span>
      {hint && <span className="mt-1 block text-xs text-secondary">{hint}</span>}
    </>
  );
  const cls = `min-w-0 rounded-lg border bg-surface p-4 text-left ${TONE[tone]} ${
    active ? "border-accent-500 ring-1 ring-accent-500" : "border-[var(--border-subtle)]"
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={`${cls} hover:bg-[var(--gray-50)]`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
