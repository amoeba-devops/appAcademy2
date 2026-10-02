// Local synthetic UI fixture. Axios is replaced entirely; never contacts an API.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalCalendarPage } from "../src/modules/portal-app/pages/portal-calendar-page";
import { CalEventModal } from "../src/modules/cal/components/cal-event-modal";
import { apiClient } from "../src/lib/api-client";
import { ToastProvider } from "../src/components/ui/toast";
import { ConfirmProvider } from "../src/components/ui/confirm-dialog";
import { useAuthStore } from "../src/stores/auth.store";
import type { CalEvent } from "../src/modules/cal/types";
import i18n from "../src/i18n";
import "../src/styles/globals.css";
i18n.changeLanguage("ko");
const today = new Date();
const events = Array.from({ length: 8 }, (_, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  title: `학생 ${i + 1} 영어 수업`,
  primaryStudentName: `학생 ${i + 1}`,
  category: "REGULAR_CLASS",
  startAt: new Date(
    today.getFullYear(),
    today.getMonth(),
    20,
    10 + i,
  ).toISOString(),
  endAt: new Date(
    today.getFullYear(),
    today.getMonth(),
    20,
    11 + i,
  ).toISOString(),
  allDay: false,
  source: "MANUAL",
  ownerUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  meetingProvider: "GOOGLE_MEET",
  meetingUrl: null,
  invitees: [],
  attachments: [],
}));
useAuthStore.setState({
  user: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    entId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    role: "ADMIN",
  },
});
apiClient.defaults.adapter = async (config) => {
  const url = config.url || "";
  let data: unknown = {};
  if (url.endsWith("video-capabilities"))
    data = { provider: "GOOGLE_MEET", bodaEnabled: false };
  else if (url.endsWith("/events"))
    data = { items: events, total: events.length };
  else if (url.includes("/recurrence/events/") || url.endsWith("/ics"))
    data = null;
  else if (url.endsWith("/revisions")) data = { items: [] };
  else if (
    url.includes("invitee") ||
    url.includes("candidates") ||
    url.endsWith("/attachments") ||
    url.endsWith("/color-settings")
  )
    data = [];
  else if (url.endsWith(events[0].id)) data = events[0];
  else if (url.includes("teachers")) data = { items: [], total: 0 };
  else if (url.includes("settings")) data = { timezone: "Asia/Seoul" };
  if (config.method === "patch" || config.method === "put")
    document.getElementById("saved")!.textContent =
      `저장 payload: ${config.data}`;
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data: { success: true, data },
  };
};
function Fixture() {
  const [edit, setEdit] = useState(false);
  return (
    <main className="p-4">
      <p>로컬 테스트 · 가상 학생 8명</p>
      <button onClick={() => setEdit(true)}>수정 모달 테스트</button>
      <p id="saved" />
      <PortalCalendarPage />
      <CalEventModal
        open={edit}
        onClose={() => setEdit(false)}
        initial={events[0] as CalEvent}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <ConfirmProvider>
          <Fixture />
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  </MemoryRouter>,
);
