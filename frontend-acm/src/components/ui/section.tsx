import type { ReactNode } from "react";

/** UI-261019 — 상자 표준: 모서리 8px, 테두리 gray-200, 배경 surface, 제목 15px/600. */
export function Section({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClassName = "p-4 sm:p-5",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-[var(--border-subtle)] bg-surface ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-primary">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** 필터 영역: 상자 하나, 입력 높이 36px 기준. */
export function FilterBar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border-subtle)] bg-surface p-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** 표 바로 위 한 줄: 결과 수 · 페이지 */
export function ResultBar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
      <span>{children}</span>
      {right && <span>{right}</span>}
    </div>
  );
}
