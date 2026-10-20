// REQ-261018D — ACM 앱(PWA) 서비스 워커: 웹 푸시 + 오프라인 안내 화면.
// API·정적 파일·로그인 응답은 가로채거나 저장하지 않는다(개인정보·최신성). 화면 이동만 네트워크 우선 → 실패 시 오프라인 화면.
const SHELL = "acm-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll([OFFLINE_URL, "/acm-icon-192.png"]);
      // 처음 설치(이전 워커 없음)면 바로 사용. 업데이트는 화면의 [새로고침] 에서 SKIP_WAITING 으로.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keep = new Set([SHELL, "acm-push-settings"]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // 오프라인 화면의 아이콘만 저장본으로 대체(네트워크 우선).
  if (req.method === "GET" && url.origin === self.location.origin && url.pathname === "/acm-icon-192.png") {
    e.respondWith(fetch(req).catch(() => caches.match("/acm-icon-192.png", { cacheName: SHELL }).then((r) => r || Response.error())));
    return;
  }
  if (req.mode !== "navigate" || req.method !== "GET") return;
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    (async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match(OFFLINE_URL, { cacheName: SHELL });
        return cached || Response.error();
      }
    })(),
  );
});

// ── 웹 푸시(기존 acm-push-sw.js 와 동일) ─────────────────────────────
self.addEventListener("push", (e) =>
  e.waitUntil(
    (async () => {
      const data = e.data?.json();
      if (!data) return;
      const cache = await caches.open("acm-push-settings");
      const binding = await cache.match("/__acm-push-actor");
      if (!binding || (await binding.text()) !== data.actor) return;
      await self.registration.showNotification(data.title || "ACM", {
        body: data.body,
        tag: data.tag,
        data: { url: data.url, actor: data.actor },
        icon: "/acm-icon-192.png",
      });
    })(),
  ),
);
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const cache = await caches.open("acm-push-settings");
      const binding = await cache.match("/__acm-push-actor");
      if (!binding || (await binding.text()) !== e.notification.data.actor) return;
      const url = new URL(e.notification.data.url, self.location.origin);
      if (url.origin !== self.location.origin || !/^\/(admin|portal)\//.test(url.pathname)) return;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const current = windows.find((w) => new URL(w.url).origin === url.origin);
      if (current) {
        await current.navigate(url.href);
        await current.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
