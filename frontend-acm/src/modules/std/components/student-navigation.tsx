import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const links = [
  ["tpi", "TPI"],
  ["trinity", "TRINITY"],
  ["santa-croce", "SANTACROCE"],
  ["withdrawn", "WITHDRAWN"],
] as const;
export function StudentNavigation({ iconOnly, onNavigate }: { iconOnly: boolean; onNavigate: () => void }) {
  const { t } = useTranslation("std");
  const location = useLocation();
  const [expanded, setExpanded] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
    if (
      location.pathname.startsWith("/admin/std") &&
      !location.pathname.startsWith("/admin/std/parents")
    )
      setExpanded(true);
  }, [location.pathname]);
  const root = (
    <NavLink
      onClick={() => { setOpen(false); onNavigate(); }}
      end
      to="/admin/std"
      className={({ isActive }) =>
        `block rounded px-3 py-2 text-sm ${isActive ? "bg-accent-50 text-accent-700" : "text-secondary hover:bg-[var(--gray-100)]"}`
      }
    >
      {t("navigation.integrated")}
    </NavLink>
  );
  const children = links.map(([path, key]) => (
    <NavLink
      key={path}
      onClick={() => { setOpen(false); onNavigate(); }}
      end
      to={`/admin/std/${path}`}
      className={({ isActive }) =>
        `block rounded px-3 py-2 text-sm ${isActive ? "bg-accent-50 text-accent-700" : "text-secondary hover:bg-[var(--gray-100)]"}`
      }
    >
      {key === "WITHDRAWN" ? t("status.WITHDRAWN") : t(`site.${key}`)}
    </NavLink>
  ));
  if (iconOnly)
    return (
      <>
        <button
          type="button"
          className="flex justify-center w-full py-2 rounded text-secondary hover:bg-[var(--gray-100)]"
          aria-label={t("title")}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <UserRound size={18} />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>
            <nav aria-label={t("title")}>
              {root}
              {children}
            </nav>
          </DialogContent>
        </Dialog>
      </>
    );
  return (
    <div>
      <div className="flex items-center">
        <NavLink
          onClick={() => { setOpen(false); onNavigate(); }}
          end
          to="/admin/std"
          className={({ isActive }) =>
            `flex flex-1 gap-3 items-center px-3 py-2 text-sm rounded ${isActive ? "bg-accent-50 text-accent-700" : "text-secondary"}`
          }
        >
          <UserRound size={18} />
          {t("title")}
        </NavLink>
        <button
          type="button"
          className="p-2 text-secondary"
          aria-label={t("navigation.toggle")}
          aria-expanded={expanded}
          aria-controls="student-submenus"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={16} className={expanded ? "" : "-rotate-90"} />
        </button>
      </div>
      {expanded && (
        <div id="student-submenus" className="ml-7 border-l pl-1">
          {children}
        </div>
      )}
    </div>
  );
}
