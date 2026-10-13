// Notification-only worker: never intercept or cache application/API requests.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
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
      if (!binding || (await binding.text()) !== e.notification.data.actor)
        return;
      const url = new URL(e.notification.data.url, self.location.origin);
      if (
        url.origin !== self.location.origin ||
        !/^\/(admin|portal)\//.test(url.pathname)
      )
        return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const current = windows.find((w) => new URL(w.url).origin === url.origin);
      if (current) {
        await current.navigate(url.href);
        await current.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
