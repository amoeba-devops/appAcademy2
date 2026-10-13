const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
function worker(actor = "tenant:USER:user") {
  const handlers = {},
    shown = [],
    opened = [];
  let work;
  const self = {
    location: { origin: "https://acm.example.test" },
    addEventListener: (k, f) => (handlers[k] = f),
    skipWaiting: () => {},
    registration: { showNotification: async (t, o) => shown.push({ t, o }) },
    clients: {
      claim: () => {},
      matchAll: async () => [],
      openWindow: async (u) => opened.push(u),
    },
  };
  const caches = {
    open: async () => ({
      match: async () => (actor ? { text: async () => actor } : null),
    }),
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../public/acm-push-sw.js"), "utf8"),
    { self, caches, URL },
  );
  return {
    shown,
    opened,
    run: async (k, extra) => {
      handlers[k]({ waitUntil: (p) => (work = p), ...extra });
      await work;
    },
  };
}
test("push uses persistent notification and stable tag", async () => {
  const w = worker();
  await w.run("push", {
    data: {
      json: () => ({
        title: "ACM",
        body: "New notification",
        tag: "one",
        actor: "tenant:USER:user",
        url: "/admin/chat?channelId=c",
      }),
    },
  });
  assert.equal(w.shown[0].o.tag, "one");
});
test("old-account push is ignored after logout/rebind", async () => {
  const w = worker("new-account");
  await w.run("push", { data: { json: () => ({ actor: "old-account" }) } });
  assert.equal(w.shown.length, 0);
});
test("notification opens exact internal target", async () => {
  const w = worker();
  await w.run("notificationclick", {
    notification: {
      close() {},
      data: { actor: "tenant:USER:user", url: "/portal/calendar/e#review" },
    },
  });
  assert.equal(
    w.opened[0],
    "https://acm.example.test/portal/calendar/e#review",
  );
});
test("external and protocol-relative click URLs are rejected", async () => {
  for (const url of [
    "https://evil.test",
    "//evil.test/admin/chat",
    "/web/other",
  ]) {
    const w = worker();
    await w.run("notificationclick", {
      notification: { close() {}, data: { actor: "tenant:USER:user", url } },
    });
    assert.equal(w.opened.length, 0);
  }
});
