import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BarChart3, Bot, ChevronRight, MessageCircle, Settings, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ConfigCard {
  to: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

/** REQ-261018 — 테넌트 마스터 전용 노출 연동 설정. */
export const INTEGRATION_CARDS: ConfigCard[] = [
  { to: "/admin/config/ai", icon: Bot, titleKey: "aiConfig.title", descKey: "aiConfig.description" },
  { to: "/admin/config/ama", icon: Settings, titleKey: "config.cards.ama.title", descKey: "config.cards.ama.description" },
  { to: "/admin/config/video", icon: Video, titleKey: "video.title", descKey: "video.description" },
  { to: "/admin/config/kakao", icon: MessageCircle, titleKey: "config.cards.kakao.title", descKey: "config.cards.kakao.description" },
  { to: "/admin/config/ga4", icon: BarChart3, titleKey: "config.cards.ga4.title", descKey: "config.cards.ga4.description" },
];

export function ConfigCardGrid({ cards }: { cards: ConfigCard[] }) {
  const { t } = useTranslation("common");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map(({ to, icon: Icon, titleKey, descKey }) => (
        <Link
          key={to}
          to={to}
          className="group flex flex-col rounded-lg border border-[var(--border-subtle)] bg-surface p-5 transition-colors hover:border-accent-300 hover:bg-accent-50/40"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-50 text-accent-700">
              <Icon size={20} />
            </span>
            <ChevronRight
              size={18}
              className="text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700"
            />
          </div>
          <h2 className="text-base font-semibold text-primary">{t(titleKey)}</h2>
          <p className="mt-1 text-sm text-secondary">{t(descKey)}</p>
        </Link>
      ))}
    </div>
  );
}
