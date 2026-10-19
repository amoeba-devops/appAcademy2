import type { ReactNode } from "react";
import { useScrollHint } from "@/hooks/use-scroll-hint";

/** UI-261019 — 화면 안 보기 전환은 밑줄 탭 하나로 통일. */
export function UnderlineTabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { key: K; label: ReactNode; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  label?: string;
}) {
  // TST-261019 M7 — 넘치는 탭은 오른쪽 흐림 표시 + 선택 탭 자동 스크롤. 휴대폰 탭 높이 ≥40px.
  const { ref, hasMore } = useScrollHint<HTMLDivElement>(value);
  return (
    <div className="relative min-w-0">
      <div ref={ref} role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={value === it.key}
            onClick={() => onChange(it.key)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium md:py-2 ${
              value === it.key
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            {it.label}
            {it.count !== undefined && (
              <span className="ml-1.5 rounded-full bg-[var(--gray-100)] px-1.5 py-0.5 text-xs text-secondary">{it.count}</span>
            )}
          </button>
        ))}
      </div>
      {hasMore && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
      )}
    </div>
  );
}
