import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";

const KEY = "acm-push-binding";
type Binding = { id: string; actor: string; base: string };
function stored(): Binding | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null") as Binding | null;
  } catch {
    return null;
  }
}
async function clearDevice(binding: Binding, token?: string | null) {
  localStorage.removeItem(KEY);
  await (await caches.open("acm-push-settings")).delete("/__acm-push-actor");
  const reg = await navigator.serviceWorker.getRegistration("/");
  await (await reg?.pushManager.getSubscription())?.unsubscribe();
  if (token)
    await fetch(`/api${binding.base}/push-subscriptions/${binding.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
}
export function PushSettings({ mode }: { mode: "admin" | "portal" }) {
  const { t } = useTranslation("common");
  const user = useAuthStore((s) => (mode === "admin" ? s.user : s.portal.user));
  const token = useAuthStore((s) =>
    mode === "admin" ? s.token : s.portal.token,
  );
  const actor = user
    ? `${user.entId}:${mode === "admin" ? "USER" : "TEACHER"}:${"refId" in user ? user.refId : user.id}`
    : "";
  const base =
    mode === "admin"
      ? "/acm/notifications/inbox"
      : "/portal/notifications/inbox";
  const supported =
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const q = useQuery({
    queryKey: ["push-config", mode],
    queryFn: async () =>
      (
        await apiClient.get<{ enabled: boolean; publicKey: string | null }>(
          base + "/push-config",
        )
      ).data,
  });
  useEffect(() => {
    if (!supported) return;
    const check = async () => {
      try {
        const b = stored();
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (
          b?.actor === actor &&
          sub &&
          Notification.permission === "granted"
        ) {
          const json = sub.toJSON();
          await apiClient.post(base + "/push-subscriptions", {
            endpoint: json.endpoint,
            keys: json.keys,
          });
          setEnabled(true);
        } else setEnabled(false);
      } catch {
        setEnabled(false);
        setError(true);
      }
    };
    void check();
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("focus", check);
    };
  }, [actor, mode, supported, token, base]);
  const toggle = async () => {
    setBusy(true);
    setError(false);
    try {
      const old = stored();
      if (enabled && old) {
        await clearDevice(old, token);
        setEnabled(false);
        return;
      }
      if (!q.data?.publicKey) throw new Error("not configured");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("permission");
      const reg = await navigator.serviceWorker.register("/acm-push-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      // One browser subscription belongs to one current ACM account.
      if (old && old.actor !== actor) await clearDevice(old);
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(
            atob(q.data.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        }));
      const json = subscription.toJSON();
      const res = (
        await apiClient.post<{ id: string; actor: string }>(
          base + "/push-subscriptions",
          { endpoint: json.endpoint, keys: json.keys },
        )
      ).data;
      await (
        await caches.open("acm-push-settings")
      ).put("/__acm-push-actor", new Response(res.actor));
      localStorage.setItem(KEY, JSON.stringify({ ...res, base }));
      setEnabled(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded border p-3 text-sm space-y-2">
      <strong>{t("push.title")}</strong>
      <p>
        {!supported
          ? t("push.unsupported")
          : Notification.permission === "denied"
            ? t("push.blocked")
            : enabled
              ? t("push.enabled")
              : t("push.disabled")}
      </p>
      <p className="text-xs">{t("push.ios")}</p>
      {q.data && !q.data.enabled && <p>{t("push.unconfigured")}</p>}
      {(error || q.isError) && <p role="alert">{t("push.failed")}</p>}
      <Button
        disabled={busy || !supported || !q.data?.enabled}
        onClick={() => void toggle()}
      >
        {enabled ? t("push.off") : t("push.on")}
      </Button>
    </section>
  );
}

export function PushSessionSync({ mode }: { mode: "admin" | "portal" }) {
  const token = useAuthStore((s) =>
    mode === "admin" ? s.token : s.portal.token,
  );
  const user = useAuthStore((s) => (mode === "admin" ? s.user : s.portal.user));
  const actor = user
    ? `${user.entId}:${mode === "admin" ? "USER" : "TEACHER"}:${"refId" in user ? user.refId : user.id}`
    : "";
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    // Clear the device binding on logout/account change, including expired sessions.
    const stop = useAuthStore.subscribe((next, prev) => {
      const n = mode === "admin" ? next.user : next.portal.user;
      const p = mode === "admin" ? prev.user : prev.portal.user;
      const nt = mode === "admin" ? next.token : next.portal.token;
      if (p && (!n || n.id !== p.id || !nt)) {
        const b = stored();
        if (b?.actor === actor)
          void clearDevice(b, token).catch(() => undefined);
      }
    });
    return stop;
  }, [actor, mode, token]);
  return null;
}

export function hasDevicePush(actor: string): boolean {
  return (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    stored()?.actor === actor
  );
}
