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
/**
 * FIX-261026 — 사용자가 이 기기에서 [끄기]를 눌렀다는 표시(모드별). 있으면 자동 복구하지 않는다.
 * 없으면 "기본 켜짐": 권한이 허용된 기기는 구독이 사라져도 앱을 열 때 다시 만든다.
 */
const OPTOUT_KEY = (mode: Mode) => `acm-push-optout:${mode}`;
const optedOut = (mode: Mode) => {
  try {
    return localStorage.getItem(OPTOUT_KEY(mode)) === "1";
  } catch {
    return false;
  }
};
const setOptOut = (mode: Mode, on: boolean) => {
  try {
    if (on) localStorage.setItem(OPTOUT_KEY(mode), "1");
    else localStorage.removeItem(OPTOUT_KEY(mode));
  } catch {
    // 저장 실패는 무시 — 다음 방문에 기본(켜짐)으로 동작한다.
  }
};
/** 이번 로그인에서 "알림 켜기" 안내를 이미 보였는지(세션 단위). */
const PROMPT_KEY = "acm-push-login-prompted";
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
/**
 * 서버 연결을 끊는다. `unsubscribe` 가 false 면 브라우저 구독은 남겨 두어
 * 같은 기기로 다시 로그인하면 자동으로 다시 연결된다(FIX-261026 — 로그아웃).
 */
async function clearDevice(binding: Binding, token?: string | null, unsubscribe = true) {
  localStorage.removeItem(KEY);
  await (await caches.open("acm-push-settings")).delete("/__acm-push-actor");
  if (unsubscribe) {
    const reg = await navigator.serviceWorker.getRegistration("/");
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  }
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
 * 직접 로그아웃: 이 계정과 기기의 서버 연결만 끊는다(로그아웃한 계정 알림이 오지 않게).
 * FIX-261026 — 브라우저 구독과 "켜짐" 상태는 남겨, 같은 기기로 다시 로그인하면 자동으로 다시 받는다.
 */
export function forgetDevicePush(mode: Mode) {
  const s = useAuthStore.getState();
  const token = mode === "admin" ? s.token : s.portal.token;
  const b = stored();
  if (!b || b.base !== baseOf(mode) || !("serviceWorker" in navigator)) return;
  void clearDevice(b, token, false).catch(() => undefined);
}

const toKey = (key: string) =>
  Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** 권한이 허용된 기기에서 구독을 가져오거나(없으면) 새로 만든다. */
async function ensureSubscription(publicKey: string): Promise<PushSubscription> {
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/acm-sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  return (
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) }))
  );
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
      await navigator.serviceWorker.register("/acm-sw.js", { scope: "/" });
      const subscription = await ensureSubscription(key);
      await register(mode, subscription);
      setOptOut(mode, false);
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
      // 사용자가 직접 끈 기기는 자동 복구하지 않는다.
      setOptOut(mode, true);
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
    /** 이 기기에서 한 번도 묻지 않음(첫 안내 대상). */
    askable: supported && Notification.permission === "default" && !optedOut(mode),
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
    // 사용자가 이 기기에서 직접 끈 경우만 그대로 둔다(그 밖에는 기본 켜짐).
    if (optedOut(mode)) return;
    // 한 브라우저 구독은 한 계정 것 — 콘솔·포털을 함께 쓰는 브라우저는 켠 쪽만 갱신한다.
    const b = stored();
    if (b && b.base !== baseOf(mode)) return;
    void (async () => {
      // FIX-261026 — 구독이 사라졌으면(iOS 만료·서버 410 삭제·로그아웃 후) 다시 만든다.
      const reg = await navigator.serviceWorker.getRegistration("/");
      let sub = await reg?.pushManager.getSubscription();
      if (!sub) {
        const config = (
          await apiClient.get<{ enabled: boolean; publicKey: string | null }>(baseOf(mode) + "/push-config")
        ).data;
        if (!config.enabled || !config.publicKey) return;
        sub = await ensureSubscription(config.publicKey);
      }
      await register(mode, sub);
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

/**
 * FIX-261026 — 로그인 직후 한 번 "이 기기에서 알림 받기" 안내(권한을 아직 묻지 않은 기기만).
 * iOS 는 사용자가 눌러야 권한을 물을 수 있어 [켜기] 버튼으로 받는다. 이후로는 자동으로 켜진 상태를 유지한다.
 */
export function PushLoginPrompt({ mode }: { mode: Mode }) {
  const { t } = useTranslation("common");
  const p = useDevicePush(mode);
  const [shown, setShown] = useState(() => {
    try {
      return sessionStorage.getItem(PROMPT_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (shown || !p.checked || !p.configLoaded || !p.configured || p.enabled || !p.askable) return null;
  const close = () => {
    try {
      sessionStorage.setItem(PROMPT_KEY, "1");
    } catch {
      // 이번 화면에서만 닫는다.
    }
    setShown(true);
  };
  return (
    <div
      role="dialog"
      aria-label={t("push.title")}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 shadow-lg"
    >
      <BellRing size={18} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{t("push.banner")}</span>
      <Button
        size="sm"
        disabled={p.busy}
        onClick={() => {
          void p.enable().finally(close);
        }}
      >
        {t("push.turnOn")}
      </Button>
      <button type="button" className="min-h-9 rounded px-2 text-blue-900/70 hover:bg-blue-100" onClick={close}>
        {t("push.later")}
      </button>
    </div>
  );
}
