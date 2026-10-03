// Synthetic local fixture: all API requests handled in memory, no real students or bills.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentTopStatistics } from "../src/modules/pay/top-statistics";
import { StatusHistoryPanel } from "../src/modules/std/components/status-history-panel";
import { apiClient } from "../src/lib/api-client";
import i18n from "../src/i18n";
import "../src/styles/globals.css";
void i18n.changeLanguage("ko");
apiClient.defaults.adapter = async (config) => {
  const month = config.params?.month || "2026-10";
  const selected = config.params?.site || "ALL";
  const months = [-2, -1, 0].map((i) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  if (config.method !== "get")
    return {
      data: { success: true, data: { ok: true } },
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
  const data = config.url?.includes("status-history")
    ? [
        {
          id: "test",
          status: "ACTIVE",
          date: null,
          site: "TPI",
          revision: 1,
          source: "BASELINE",
        },
      ]
    : {
        month,
        site: selected,
        asOf: "2026-10-03T00:00:00Z",
        population: months.map((m, i) => ({
          month: m,
          enrolled: selected === "TPI" ? 20 + i : 36 + i * 7,
          newStudents: 12 + i,
          paused: i === 0 ? null : 2,
          knownPaused: 2,
          withdrawn: i === 0 ? null : 4 + i,
          knownWithdrawn: 4 + i,
          historyIncomplete: i === 0,
          review: 3,
        })),
        collections: months
          .slice(1)
          .map((m, i) => ({
            month: m,
            paid: i === 0 ? 31 : 0,
            unpaid: 0,
            total: i === 0 ? 31 : 0,
            drafts: i === 0 ? 0 : 51,
            canceled: 0,
            free: 0,
          })),
      };
  return {
    data: { success: true, data },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
function Fixture() {
  const [month, setMonth] = useState("2026-10"),
    [site, setSite] = useState("ALL");
  return (
    <main className="space-y-4 bg-slate-50 p-4">
      <h1 className="text-xl">수납관리 — 로컬 합성 데이터</h1>
      <PaymentTopStatistics
        identity="fixture"
        month={month}
        site={site}
        onFilter={(m, s) => {
          setMonth(m);
          setSite(s);
        }}
      />
      <StatusHistoryPanel id="synthetic" status="ACTIVE" />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <Fixture />
    </MemoryRouter>
  </QueryClientProvider>,
);
