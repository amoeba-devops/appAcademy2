import { useAuthStore } from "@/stores/auth.store";
import type { TalkMode } from "../api/talk-api";
export function useTalkIdentity(mode: TalkMode) {
  const user = useAuthStore((s) =>
    mode === "portal" ? s.portal.user : s.user,
  );
  return `${user?.entId ?? ""}:${user?.id ?? ""}`;
}
