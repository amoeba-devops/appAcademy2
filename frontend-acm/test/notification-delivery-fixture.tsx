// Synthetic fixture: API requests intercepted; no actual email or push delivery.
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "../src/modules/notifications/components-inbox";
import { TeacherFeedbackEmail } from "../src/modules/portal-app/components/teacher-feedback-email";
import { ChatUnreadLink } from "../src/modules/talk/components/chat-unread-link";
import { apiClient } from "../src/lib/api-client";
import { useAuthStore } from "../src/stores/auth.store";
import i18n from "../src/i18n";
import "../src/styles/globals.css";
void i18n.changeLanguage("ko");
useAuthStore.setState({
  token: null,
  user: { id: "admin", entId: "tenant", role: "ADMIN" },
  portal: {
    token: null,
    user: {
      id: "account",
      entId: "tenant",
      refId: "teacher",
      kind: "TEACHER",
      loginId: "test",
      mustChangePassword: false,
    },
  },
});
let read = false,
  sent = false;
apiClient.defaults.adapter = async (config) => {
  let data: unknown = {};
  const url = config.url ?? "";
  if (url.endsWith("push-config")) data = { enabled: false, publicKey: null };
  else if (url.endsWith("/count"))
    data = { unreadCount: read ? 1 : 2, asOf: new Date().toISOString() };
  else if (url.endsWith("/inbox"))
    data = {
      items: [
        {
          id: "one",
          type: "REVIEW_OVERDUE",
          targetId: "lesson",
          payload: {
            title: "수학 수업",
            hours: 5,
            missing: "feedback,homework",
          },
          readAt: read ? new Date().toISOString() : null,
          createdAt: new Date().toISOString(),
        },
        {
          id: "two",
          type: "CHAT_MESSAGE",
          targetId: "message",
          payload: { title: "강사방" },
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      nextCursor: null,
      asOf: new Date().toISOString(),
      unreadCount: 2,
    };
  else if (url.endsWith("/read")) {
    read = true;
    data = { href: "/portal/calendar/lesson#review" };
  } else if (url.endsWith("/channels")) data = [{ unreadCount: 3 }];
  else if (url.endsWith("/recipients"))
    data = {
      smtpConfigured: true,
      hasFeedback: true,
      students: [
        {
          stdId: "s",
          stdName: "검증용 학생",
          parents: [
            {
              parId: "p",
              name: "검증용 학부모",
              email: "parent@example.invalid",
            },
          ],
        },
      ],
    };
  else if (url.endsWith("/send-email")) {
    sent = true;
    data = { results: [{ stdId: "s", parId: "p", status: "SENT" }] };
  } else if (url.endsWith("/email-history"))
    data = sent
      ? [
          {
            createdAt: new Date().toISOString(),
            result: { results: [{ stdId: "s", parId: "p", status: "SENT" }] },
          },
        ]
      : [];
  return {
    data: { success: true, data },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
function App() {
  const loc = useLocation();
  return (
    <main className="mx-auto max-w-lg p-3">
      <header className="flex items-center justify-between">
        <h1>ACM · 알림 검증</h1>
        <div className="flex">
          <ChatUnreadLink mode="portal" />
          <NotificationBell mode="portal" />
        </div>
      </header>
      <section className="mt-8 space-y-3">
        <h2>수업 피드백</h2>
        <p>검증용 피드백이 저장되었습니다.</p>
        <TeacherFeedbackEmail
          evtId="lesson"
          version="2026-10-13T00:00:00.000Z"
          disabled={false}
        />
      </section>
      <output className="mt-6 block break-all">
        이동 경로: {loc.pathname}
        {loc.search}
        {loc.hash}
      </output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <MemoryRouter initialEntries={["/portal/calendar/lesson"]}>
      <App />
    </MemoryRouter>
  </QueryClientProvider>,
);
