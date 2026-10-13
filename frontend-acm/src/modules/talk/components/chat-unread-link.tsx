import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth.store";
import { talkApi, type TalkMode } from "../api/talk-api";
export function ChatUnreadLink({
  mode,
  badgeOnly = false,
}: {
  mode: TalkMode;
  badgeOnly?: boolean;
}) {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => (mode === "admin" ? s.user : s.portal.user));
  const allowed =
    user &&
    ("kind" in user
      ? user.kind === "TEACHER"
      : ["ADMIN", "APP_ADMIN"].includes(user.role ?? ""));
  const id = user
    ? `${user.entId}:${"refId" in user ? user.refId : user.id}`
    : "";
  const q = useQuery({
    queryKey: ["talk-channels", mode, id, "active"],
    queryFn: () => talkApi.channels(mode),
    enabled: !!allowed,
    refetchInterval: 15000,
  });
  if (!allowed) return null;
  const n = (q.data ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
  if (badgeOnly)
    return n > 0 ? (
      <span className="rounded-full bg-red-600 px-1.5 text-xs text-white">
        {n > 99 ? "99+" : n}
      </span>
    ) : null;
  return (
    <Link
      className="relative p-2"
      to={`/${mode === "admin" ? "admin" : "portal"}/chat`}
      aria-label={`${t("nav.chat")}: ${n}`}
    >
      <MessagesSquare size={20} />
      {n > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
      {q.isError && <span role="status">!</span>}
    </Link>
  );
}
