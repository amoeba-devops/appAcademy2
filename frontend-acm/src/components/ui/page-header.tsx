import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";

/**
 * UI-261019 — 운영 콘솔 화면 틀 표준.
 * [← 상위]  /  [아이콘] 제목(20px/600) … [보조] [주]  /  설명 한 줄  /  (탭)
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  meta,
  back,
  actions,
  tabs,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** 상세 화면: 설명 대신 요약(상태·담당·수정일 등) */
  meta?: ReactNode;
  back?: { to: string; label: ReactNode };
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="mb-5 min-w-0">
      {back && (
        <Link
          to={back.to}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
            {Icon && <Icon size={20} className="shrink-0 text-accent-700" aria-hidden="true" />}
            <span className="min-w-0 break-words">{title}</span>
          </h1>
          {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
          {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-secondary">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-4">{tabs}</div>}
    </div>
  );
}
