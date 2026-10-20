import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BellRing, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { isIos, isStandalone } from "@/lib/pwa";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";

type Mode = "admin" | "portal";
const KEY = "acm-push-binding";
/** REQ-261020C — "이 기기에서 알림 받기" 안내를 닫은 시각(14일 동안 다시 보이지 않음). */
const BANNER_KEY = "acm-push-banner-dismissed";
const BANNER_SNOOZE_MS = 14 * 24 * 3600 * 1000;
type Binding = { id: string; actor: string; base: string };
const baseOf = (mode: Mode) =>
  mode === "admin" ? "/acm/notifications/inbox" : "/portal/notifications/inbox";
function stored(): Binding | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null") as Binding | null;
  } catch {
    return null;
  }
}
const pushSupported = () =>
  typeof Notification !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window;
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
/** 서버에 이 기기 구독을 (다시) 등록하고, 서비스워커가 아는 계정을 맞춘다. */
async function register(mode: Mode, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const res = (
    await apiClient.post<{ id: string; actor: string }>(
      baseOf(mode) + "/push-subscriptions",
      { endpoint: json.endpoint, keys: json.keys },
    )
  ).data;
  await (
    await caches.open("acm-push-settings")
  ).put("/__acm-push-actor", new Response(res.actor));
  localStorage.setItem(KEY, JSON.stringify({ ...res, base: baseOf(mode) }));
}
function useActor(mode: Mode) {
  const user = useAuthStore((s) => (mode === "admin" ? s.user : s.portal.user));
  return user
    ? `${user.entId}:${mode === "admin" ? "USER" : "TEACHER"}:${"refId" in user ? user.refId : user.id}`
    : "";
}

/**
 * REQ-261020C — 직접 로그아웃할 때만 이 기기 푸시를 끊는다.
 * 로그인 만료로는 끊지 않는다(같은 기기에서 다시 로그인하면 계속 받는다).
 */
export function forgetDevicePush(mode: Mode) {
  const s = useAuthStore.getState();
  const token = mode === "admin" ? s.token : s.portal.token;
  const b = stored();
  if (!b || b.base !== baseOf(mode) || !("serviceWorker" in navigator)) return;
  void clearDevice(b, token).catch(() => undefined);
}

/** 이 기기 푸시 상태와 켜기/끄기(설정 창·안내 배너 공용). */
export function useDevicePush(mode: Mode) {
  const actor = useActor(mode);
  const token = useAuthStore((s) =>
    mode === "admin" ? s.token : s.portal.token,
  );
  const supported = pushSupported();
  const [enabled, setEnabled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const config = useQuery({
    queryKey: ["push-config", mode],
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
    queryFn: async () =>
      (
        await apiClient.get<{ enabled: boolean; publicKey: string | null }>(
          baseOf(mode) + "/push-config",
        )
      ).data,
  });
  const check = useCallback(async () => {
    if (!supported || !actor) {
      setChecked(true);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEnabled(
        !!sub && Notification.permission === "granted" && stored()?.actor === actor,
      );
    } catch {
      setEnabled(false);
    } finally {
      setChecked(true);
    }
  }, [actor, supported]);
  useEffect(() => {
    void check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);
  const enable = async () => {
    setBusy(true);
    setError(false);
    try {
      const key = config.data?.publicKey;
      if (!key) throw new Error("not configured");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("permission");
      const reg = await navigator.serviceWorker.register("/acm-sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(
            atob(key.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        }));
      await register(mode, subscription);
      setEnabled(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  const disable = async () => {
    setBusy(true);
    setError(false);
    try {
      const b = stored();
      if (b) await clearDevice(b, token);
      setEnabled(false);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return {
    supported,
    checked,
    enabled,
    busy,
    error: error || config.isError,
    configured: !!config.data?.enabled,
    configLoaded: !!config.data,
    blocked: supported && Notification.permission === "denied",
    iosBrowser: isIos() && !isStandalone(),
    enable,
    disable,
  };
}

export function PushSettings({ mode }: { mode: Mode }) {
  const { t } = useTranslation("common");
  const p = useDevicePush(mode);
  return (
    <section className="rounded border p-3 text-sm space-y-2">
      <strong>{t("push.title")}</strong>
      <p>
        {!p.supported
          ? t("push.unsupported")
          : p.blocked
            ? t("push.blocked")
            : p.enabled
              ? t("push.enabled")
              : t("push.disabled")}
      </p>
      <p className="text-xs">{t("push.ios")}</p>
      {p.configLoaded && !p.configured && <p>{t("push.unconfigured")}</p>}
      {p.error && <p role="alert">{t("push.failed")}</p>}
      <Button
        disabled={p.busy || !p.supported || !p.configured}
        onClick={() => void (p.enabled ? p.disable() : p.enable())}
      >
        {p.enabled ? t("push.off") : t("push.on")}
      </Button>
    </section>
  );
}

/**
 * REQ-261020C — 알림 목록 위 "이 기기에서 알림 받기 [켜기]" 안내.
 * 이미 켜져 있거나 서버 푸시가 준비되지 않았으면 보이지 않는다. 닫으면 14일 동안 숨긴다.
 */
export function PushEnableBanner({ mode }: { mode: Mode }) {
  const { t } = useTranslation("common");
  const p = useDevicePush(mode);
  const [hidden, setHidden] = useState(() => {
    try {
      return (
        Date.now() - Number(localStorage.getItem(BANNER_KEY) || 0) <
        BANNER_SNOOZE_MS
      );
    } catch {
      return false;
    }
  });
  if (hidden || !p.checked || !p.configLoaded || !p.configured || p.enabled)
    return null;
  // iOS Safari 탭은 홈 화면 앱에서만 푸시 가능. 그 밖의 미지원 브라우저는 안내하지 않는다.
  if (!p.supported && !p.iosBrowser) return null;
  const message =
    p.iosBrowser && !p.supported
      ? t("push.ios")
      : p.blocked
        ? t("push.blocked")
        : t("push.banner");
  const canEnable = p.supported && !p.blocked;
  return (
    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
      <BellRing size={16} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {message}
        {p.error && (
          <span role="alert" className="block text-xs text-red-600">
            {t("push.failed")}
          </span>
        )}
      </span>
      {canEnable && (
        <Button size="sm" disabled={p.busy} onClick={() => void p.enable()}>
          {t("push.turnOn")}
        </Button>
      )}
      <button
        type="button"
        className="rounded p-1 text-blue-900/70 hover:bg-blue-100"
        aria-label={t("push.dismiss")}
        title={t("push.dismiss")}
        onClick={() => {
          try {
            localStorage.setItem(BANNER_KEY, String(Date.now()));
          } catch {
            // 저장 실패 시 이번 화면에서만 숨긴다.
          }
          setHidden(true);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * 로그인 상태와 이 기기 구독을 맞춘다.
 * - 앱을 열 때(권한 허용 기기) 서버 구독을 갱신 → 30일 만료 없음, 다른 계정으로 로그인했으면 그 계정으로 넘긴다.
 * - 같은 화면에서 다른 계정으로 바뀌면 이전 계정 연결을 끊는다.
 * - 로그인 만료(토큰만 사라짐)로는 끊지 않는다. 직접 로그아웃은 forgetDevicePush 가 처리한다.
 */
export function PushSessionSync({ mode }: { mode: Mode }) {
  const actor = useActor(mode);
  const token = useAuthStore((s) =>
    mode === "admin" ? s.token : s.portal.token,
  );
  useEffect(() => {
    if (!actor || !token || !pushSupported()) return;
    if (Notification.permission !== "granted") return;
    // 한 브라우저 구독은 한 계정 것 — 콘솔·포털을 함께 쓰는 브라우저는 켠 쪽만 갱신한다.
    const b = stored();
    if (b && b.base !== baseOf(mode)) return;
    void (async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await register(mode, sub);
    })().catch(() => undefined);
  }, [actor, mode, token]);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("caches" in window)) return;
    const stop = useAuthStore.subscribe((next, prev) => {
      const n = mode === "admin" ? next.user : next.portal.user;
      const p = mode === "admin" ? prev.user : prev.portal.user;
      if (p && n && n.id !== p.id) {
        const b = stored();
        if (b?.actor === actor)
          void clearDevice(
            b,
            mode === "admin" ? prev.token : prev.portal.token,
          ).catch(() => undefined);
      }
    });
    return stop;
  }, [actor, mode]);
  return null;
}

export function hasDevicePush(actor: string): boolean {
  return (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    stored()?.actor === actor
  );
}
