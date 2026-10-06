// Browser smoke test with isolated HTTP fixtures; no production credentials/data.
// PLAYWRIGHT_MODULE may point to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.CHAT_UI_URL || "http://127.0.0.1:5173";
const screenshots = path.resolve(
  __dirname,
  "../../docs/report/assets/chat-participants-261006",
);
fs.mkdirSync(screenshots, { recursive: true });
const ids = {
  ent: "00000000-0000-0000-0000-000000000001",
  owner: "00000000-0000-0000-0000-000000000002",
  operator: "00000000-0000-0000-0000-000000000003",
  teacher: "00000000-0000-0000-0000-000000000004",
  channel: "00000000-0000-0000-0000-000000000005",
  message: "00000000-0000-0000-0000-000000000006",
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ["admin", "member", "portal"]) {
      const context = await browser.newContext({
        viewport: { width: 1760, height: 960 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const user = {
        id: mode === "member" ? ids.operator : ids.owner,
        entId: ids.ent,
        role: "ADMIN",
        authSource: "local",
      };
      const portal = {
        id: "portal-test",
        entId: ids.ent,
        refId: ids.teacher,
        kind: "TEACHER",
        loginId: "teacher-test",
        mustChangePassword: false,
      };
      await page.addInitScript(
        ({ user, portal }) => {
          localStorage.setItem("acm.lang", "ko");
          localStorage.setItem(
            "acm-auth",
            JSON.stringify({
              version: 4,
              state: {
                token: "admin-test-token",
                user,
                portal: { token: "portal-test-token", user: portal },
                parent: { token: null, user: null },
                active: "admin",
              },
            }),
          );
        },
        { user, portal },
      );
      let archived = false,
        left = false,
        name = "강사 운영 단체방",
        unread = 1;
      let members = [
        { kind: "USER", refId: ids.owner, name: "운영자", role: "OWNER" },
        { kind: "USER", refId: ids.operator, name: "부운영자", role: "MEMBER" },
        { kind: "TEACHER", refId: ids.teacher, name: "김강사", role: "MEMBER" },
      ];
      const room = () => ({
        id: ids.channel,
        type: "GROUP",
        name,
        members,
        unreadCount: 1,
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: "@김강사 수업 일정을 확인해주세요.",
        mine: mode === "admin",
        archived,
        canSend: true,
      });
      const message = {
        id: ids.message,
        channelId: ids.channel,
        type: "TEXT",
        content: "@김강사 수업 일정을 확인해주세요.",
        senderKind: "USER",
        senderRefId: ids.owner,
        senderName: "운영자",
        mine: mode === "admin",
        createdAt: new Date().toISOString(),
        mentions: [{ ...members[2] }],
      };
      const calls = [];
      await page.route(
        (url) => url.pathname.startsWith("/api/"),
        async (route) => {
          const req = route.request(),
            url = new URL(req.url()),
            p = url.pathname;
          calls.push({
            path: p,
            method: req.method(),
            body: req.postData(),
            auth: req.headers().authorization,
          });
          const json = (data, status = 200) =>
            route.fulfill({
              status,
              contentType: "application/json",
              body: JSON.stringify(data),
            });
          if (p.endsWith("/events"))
            return route.fulfill({
              status: 200,
              contentType: "text/event-stream",
              body: 'data: {"type":"heartbeat"}\n\n',
            });
          if (p.endsWith("/me/config-access")) return json({ allowed: false });
          if (p.endsWith("/me/menus")) return json({ hidden: [], order: [] });
          if (p.includes("/notifications/inbox")) {
            if (p.endsWith("/count"))
              return json({
                unreadCount: unread,
                asOf: new Date().toISOString(),
              });
            if (p.endsWith("/read")) {
              unread = 0;
              return json({
                href: `/${mode === "portal" ? "portal" : "admin"}/chat?channelId=${ids.channel}&messageId=${ids.message}`,
              });
            }
            if (p.endsWith("/read-all")) {
              unread = 0;
              return json({ unreadCount: 0 });
            }
            return json({
              items: [
                {
                  id: "notification-test",
                  type: "CHAT_MENTION",
                  targetId: ids.message,
                  payload: { channelId: ids.channel, senderName: "운영자" },
                  readAt: null,
                  createdAt: new Date().toISOString(),
                },
              ],
              nextCursor: null,
              unreadCount: unread,
              asOf: new Date().toISOString(),
            });
          }
          if (p.endsWith("/candidates"))
            return json([
              { kind: "TEACHER", refId: ids.message, name: "초대강사" },
            ]);
          if (p.endsWith("/invitations")) {
            members.push({
              kind: "TEACHER",
              refId: ids.message,
              name: "초대강사",
              role: "MEMBER",
            });
            return json(room());
          }
          if (req.method() === "DELETE" && p.includes("/members/")) {
            members = members.filter((m) => !p.endsWith("/" + m.refId));
            return json(room());
          }
          if (p.endsWith("/dm"))
            return json({
              ...room(),
              id: "direct-test",
              type: "DIRECT",
              name: "새 DM",
              mine: false,
              members: members.slice(0, 2),
            });
          if (p.endsWith("/channels/direct-test"))
            return json({
              ...room(),
              id: "direct-test",
              type: "DIRECT",
              name: "새 DM",
              mine: false,
              members: members.slice(0, 2),
            });
          if (p.endsWith("/channels"))
            return json(
              left
                ? []
                : (url.searchParams.get("scope") === "archived") === archived
                  ? [room()]
                  : [],
            );
          if (p.endsWith("/archive")) {
            archived = req.postDataJSON().archived;
            return json(room());
          }
          if (p.endsWith("/leave")) {
            left = true;
            return json({});
          }
          if (p.endsWith("/channels/" + ids.channel)) {
            if (left) return json({ message: "NOT_CHANNEL_MEMBER" }, 403);
            if (req.method() === "PATCH") name = req.postDataJSON().name;
            return json(room());
          }
          if (p.endsWith("/messages/" + ids.message)) return json(message);
          if (p.endsWith("/messages"))
            return json({ messages: [message], nextCursor: null });
          if (p.endsWith("/read")) return json({});
          if (p.endsWith("/me")) return json({ user });
          return json({});
        },
      );
      await page.goto(`${base}/${mode === "portal" ? "portal" : "admin"}/chat`);
      await page
        .getByRole("button", { name: /강사 운영 단체방/ })
        .click({ timeout: 10000 })
        .catch(async (e) => {
          await page.screenshot({
            path: path.join(screenshots, "failure.png"),
            fullPage: true,
          });
          console.log({
            url: page.url(),
            errors,
            body: (await page.locator("body").innerText()).slice(0, 3000),
            calls,
          });
          throw e;
        });
      const roomButton = page.getByRole("button", { name: /강사 운영 단체방/ });
      assert.equal(await roomButton.locator("svg.lucide-crown").count(), 1);
      if (mode === "portal")
        await page.getByRole("button", { name: /^참여자 \d+$/ }).click();
      const panel =
        mode === "portal"
          ? page.getByRole("dialog")
          : page.locator("#admin-support-panel");
      await panel
        .getByRole("heading", { name: "참여자 3", exact: true })
        .waitFor();
      assert.equal(
        await panel.getByText("이용 팁", { exact: true }).count(),
        0,
      );
      if (mode === "admin") {
        await panel
          .getByRole("button", { name: "참여자 초대", exact: true })
          .click();
        await page.getByRole("checkbox", { name: /초대강사/ }).check();
        await page
          .getByRole("button", { name: "1명 초대", exact: true })
          .click();
        await panel
          .getByRole("heading", { name: "참여자 4", exact: true })
          .waitFor();
        await page.screenshot({
          path: path.join(screenshots, "admin-owner.png"),
          fullPage: true,
        });
        await panel
          .getByRole("button", { name: "초대강사님 내보내기", exact: true })
          .click();
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "내보내기", exact: true })
          .click();
        await panel
          .getByRole("heading", { name: "참여자 3", exact: true })
          .waitFor();
        await panel
          .getByRole("button", { name: "가리기", exact: true })
          .click();
        assert.equal(await panel.isVisible(), false);
        await page
          .getByRole("button", { name: "우측 패널 보이기", exact: true })
          .click();
        await panel.waitFor({ state: "visible" });
      } else {
        assert.equal(
          await panel
            .getByRole("button", { name: "참여자 초대", exact: true })
            .count(),
          0,
        );
        assert.equal(
          await panel.getByRole("button", { name: /내보내기/ }).count(),
          0,
        );
        await page.screenshot({
          path: path.join(screenshots, mode + "-participants.png"),
          fullPage: true,
        });
      }
      await panel
        .getByRole("button", { name: /DM 보내기/ })
        .first()
        .click();
      await page
        .locator("div.truncate.font-medium")
        .filter({ hasText: /^새 DM$/ })
        .waitFor();
      assert(
        calls.some(
          (c) =>
            c.path.endsWith("/channels/" + ids.channel + "/dm") &&
            c.method === "POST",
        ),
      );
      await page.setViewportSize({ width: 390, height: 844 });
      if (mode === "portal")
        await page.getByRole("button", { name: /^참여자 \d+$/ }).click();
      else await page.getByRole("button", { name: /^참여자 \d+$/ }).click();
      await page.screenshot({
        path: path.join(screenshots, mode + "-mobile.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      console.log(
        mode +
          ": owner crown, tips replacement, role controls, DM and mobile passed",
      );
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
