import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle, type LucideIcon } from "lucide-react";

/** UI-261019 — 빈 목록 안내 하나로 통일. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <Icon size={28} className="text-[var(--gray-400)]" aria-hidden="true" />
      <p className="text-sm font-medium text-primary">{title}</p>
      {description && <p className="max-w-md text-sm text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

type NoticeTone = "info" | "success" | "warning" | "error";
const NOTICE: Record<NoticeTone, { cls: string; icon: LucideIcon }> = {
  info: { cls: "border-blue-200 bg-blue-50 text-blue-800", icon: Info },
  success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2 },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-800", icon: AlertTriangle },
  error: { cls: "border-red-200 bg-red-50 text-red-700", icon: XCircle },
};

/** UI-261019 — 안내·주의·오류 박스 하나로 통일. */
export function Notice({ tone = "info", children }: { tone?: NoticeTone; children: ReactNode }) {
  const { cls, icon: Icon } = NOTICE[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
