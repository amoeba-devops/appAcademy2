import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { DataQualityBanner } from "@/components/ui/data-quality-banner";
import type { MonthlyPaymentResult } from "./monthly-types";
import {
  MonthSiteFilter,
  StatisticsCharts,
  type TopStatisticsResult,
} from "./top-statistics";

/**
 * REQ-261112C — 수납관리 대시보드·통계 (사용자 목업 acm-pay-dashboard-mockup.html 기준).
 * ① 고정 필터 바(기준 토글) ② 데이터 품질 배너 A 통계 3종(기존) ③ KPI ④ 청구 진행 퍼널
 * ⑤ 12개월 추이 ⑦ 사이트별 비교·미납 상위 10명.
 */
export type PayBasis = "bill" | "paid";
const ctl =
  "h-9 rounded-md border bg-white px-3 text-sm whitespace-nowrap hover:bg-slate-50";
const card = "min-w-0 rounded-xl border bg-white p-4";

const kstToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** 1·2·2.5·5 × 10ⁿ 눈금 간격. */
function niceStep(x: number) {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 2.5, 5, 10]) if (x <= m * p) return m * p;
  return 10 * p;
}

export function PayDashboard({
  identity,
  month,
  site,
  basis,
  onFilter,
  onBasis,
  onList,
  onDetail,
  onPickStudent,
}: {
  identity: string;
  month: string;
  site: string;
  basis: PayBasis;
  onFilter: (month: string, site: string) => void;
  onBasis: (basis: PayBasis) => void;
  /** Drill down to the monthly list (status, optional scope). */
  onList: (status: string, scope?: string) => void;
  onDetail: (billIds: string[], readOnly: boolean) => void;
  onPickStudent: () => void;
}) {
  const { t, i18n } = useTranslation("common");
  const tr = (k: string, o?: Record<string, unknown>) => t(`payDash.${k}`, o);
  const lang = i18n.language;
  const [statsOpen, setStatsOpen] = useState(true);

  const stats = useQuery({
    queryKey: ["pay", identity, "statistics", month, site],
    queryFn: async () =>
      (
        await apiClient.get<TopStatisticsResult>("/acm/pay/bills/statistics", {
          params: { month, site },
        })
      ).data,
  });
  const monthly = useQuery({
    queryKey: ["pay", identity, "dashboard", month, site],
    queryFn: async () =>
      (
        await apiClient.get<MonthlyPaymentResult>("/acm/pay/bills/monthly", {
          params: { month, site, scope: "ENROLLED", page: 1, size: 50 },
        })
      ).data,
  });
  const r = monthly.data;
  const money = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : n.toLocaleString(lang);
  const monthLabel = (m: string, style: "long" | "short" = "long") =>
    new Intl.DateTimeFormat(lang, {
      year: "numeric",
      month: style,
      timeZone: "UTC",
    }).format(new Date(`${m}-01T00:00:00Z`));
  const siteLabel = (s: string) => t(`payMonthly.${s}`);

  // ── ② data quality ────────────────────────────────────────────────
  const population = stats.data?.population ?? [];
  const incomplete = population.some((p) => p.historyIncomplete);
  const reviewCount = r?.reviewCount ?? 0;
  const banner = (reviewCount > 0 || incomplete) && (
    <DataQualityBanner
      summary={
        <>
          {reviewCount > 0 && <b>{tr("banner.review", { count: reviewCount })}</b>}
          {reviewCount > 0 && incomplete && " · "}
          {incomplete && tr("banner.incomplete")}
        </>
      }
      action={
        <Link className="font-semibold underline-offset-2 hover:underline" to="/admin/std">
          {tr("banner.link")}
        </Link>
      }
      details={
        population.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4">
            {population.map((p) => (
              <li key={p.month}>
                {tr("banner.row", {
                  month: p.month,
                  review: p.review,
                  paused: p.knownPaused,
                  withdrawn: p.knownWithdrawn,
                })}
              </li>
            ))}
          </ul>
        )
      }
    />
  );

  // ── ③ KPI ─────────────────────────────────────────────────────────
  const trend = r?.trend ?? [];
  const prev = trend[trend.length - 2],
    prev2 = trend[trend.length - 3];
  type Kpi = {
    key: string;
    value: number | null;
    unit?: boolean;
    desc: string;
    alert?: boolean;
    bar?: number;
    status?: string;
  };
  const kpis: Kpi[] = !r
    ? []
    : basis === "bill"
      ? [
          { key: "net", value: r.ledger.net, unit: true, desc: tr("kpi.billMonth", { month }) },
          { key: "received", value: r.ledger.received, unit: true, desc: tr("kpi.cumulative") },
          {
            key: "unpaid",
            value: r.ledger.unpaid,
            unit: true,
            desc: tr("kpi.unpaidCount", { count: r.ledger.unpaidStudents }),
            alert: r.ledger.unpaid > 0,
            status: "UNPAID",
          },
          {
            key: "rate",
            value: r.ledger.rate,
            desc: r.ledger.rate === null ? tr("kpi.noBills") : tr("kpi.rateHint"),
            bar: r.ledger.rate ?? 0,
          },
          { key: "prevNet", value: prev?.net ?? null, unit: true, desc: prev?.month ?? "—" },
        ]
      : [
          { key: "paid", value: r.cash.paid, unit: true, desc: tr("kpi.paidMonth", { month }) },
          { key: "refunded", value: r.cash.refunded, unit: true, desc: tr("kpi.refundHint") },
          { key: "cashNet", value: r.cash.received, unit: true, desc: tr("kpi.netOfRefund") },
          { key: "prevCash", value: prev?.cash.received ?? null, unit: true, desc: prev?.month ?? "—" },
          { key: "prev2Cash", value: prev2?.cash.received ?? null, unit: true, desc: prev2?.month ?? "—" },
        ];

  // ── ④ funnel ──────────────────────────────────────────────────────
  const funnel = r
    ? ([
        { key: "enrolled", value: r.summary.enrolled, status: "" },
        { key: "missing", value: r.summary.missing, status: "NONE", tone: r.summary.missing > 0 ? "hot" : "" },
        { key: "draft", value: r.summary.draftStudents, status: "DRAFT" },
        { key: "billed", value: r.summary.billed, status: "FINALIZED" },
        { key: "unpaid", value: r.summary.unpaidStudents, status: "UNPAID", tone: r.summary.unpaidStudents > 0 ? "hot" : "" },
        { key: "review", value: r.reviewCount, status: "", scope: "REVIEW", tone: r.reviewCount > 0 ? "warn" : "" },
      ] as { key: string; value: number; status: string; scope?: string; tone?: string }[])
    : [];

  // ── ⑦ sites ───────────────────────────────────────────────────────
  const siteRows = r?.sites ?? [];
  const siteTotal = siteRows.reduce(
    (n, s) => ({
      enrolled: n.enrolled + s.summary.enrolled,
      net: n.net + s.ledger.net,
      received: n.received + s.ledger.received,
      unpaid: n.unpaid + s.ledger.unpaid,
      cash: n.cash + s.cash.received,
    }),
    { enrolled: 0, net: 0, received: 0, unpaid: 0, cash: 0 },
  );
  const rate = (received: number, net: number) =>
    net > 0 ? `${((received / net) * 100).toFixed(1)}%` : "—";
  const today = kstToday();
  const elapsed = (due: string | null | undefined) => {
    if (!due) return "—";
    const days = Math.floor((Date.parse(today) - Date.parse(due)) / 86400000);
    return days > 0 ? tr("top.days", { count: days }) : tr("top.notDue");
  };

  const th = "px-2 py-2 text-left text-xs font-medium text-secondary whitespace-nowrap";
  const td = "px-2 py-2 whitespace-nowrap";
  return (
    <section className="space-y-4">
      {/* ① 고정 필터 바 */}
      <div className="z-20 -mx-1 flex md:sticky md:top-14 flex-wrap items-center gap-2 border-b bg-canvas px-1 py-3">
        <MonthSiteFilter month={month} site={site} onFilter={onFilter} />
        <div role="group" aria-label={tr("basis.label")} className="inline-flex overflow-hidden rounded-md border bg-white">
          {(["bill", "paid"] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={basis === b}
              className={`h-9 px-3 text-sm ${basis === b ? "bg-indigo-600 font-medium text-white" : "text-secondary hover:bg-slate-50"}`}
              onClick={() => onBasis(b)}
            >
              {tr(`basis.${b}`)}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {r && (
          <span className="text-xs text-secondary tabular-nums">
            {tr("meta", {
              time: new Intl.DateTimeFormat(lang, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(r.asOf)),
            })}
          </span>
        )}
        <button
          type="button"
          className={`${ctl} inline-flex items-center gap-1.5`}
          disabled={stats.isFetching || monthly.isFetching}
          onClick={() => {
            void stats.refetch();
            void monthly.refetch();
          }}
        >
          <RefreshCw size={14} className={stats.isFetching || monthly.isFetching ? "animate-spin" : ""} />
          {tr("refresh")}
        </button>
      </div>

      {/* A 상단 통계 3종 — 기존 유지 */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{tr("stats.title")}</h2>
          <span className="flex-1" />
          <button type="button" className={ctl} aria-expanded={statsOpen} onClick={() => setStatsOpen((o) => !o)}>
            {statsOpen ? `${tr("stats.collapse")} ▴` : `${tr("stats.expand")} ▾`}
          </button>
        </div>
        {statsOpen &&
          (stats.isPending ? (
            <p role="status">{t("status.loading")}</p>
          ) : stats.isError ? (
            <p role="alert">{t("payStats.error")}</p>
          ) : (
            <StatisticsCharts result={stats.data} />
          ))}
      </section>

      {/* ⑤ 12개월 추이 — REQ-261112B: 원생·수납 통계 바로 아래 */}
      {r && (
        <section className={card}>
          <h2 className="font-semibold">{tr("trend.title")}</h2>
          <div className="mb-2 mt-2 flex flex-wrap gap-4 text-xs text-secondary">
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600 align-[-1px]" />{tr("trend.net")}</span>
            <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500 align-[-1px]" />{tr("trend.cash")}</span>
            <span><i className="mr-1.5 inline-block h-0.5 w-3 bg-amber-500 align-[3px]" />{tr("trend.enrolled")}</span>
          </div>
          <div className="overflow-x-auto">
            <TrendChart trend={trend} selected={month} lang={lang} title={tr("trend.title")} money={money} won={tr("won")} netLabel={tr("trend.net")} cashLabel={tr("trend.cash")} enrolledLabel={tr("trend.enrolled")} people={(n) => tr("trend.people", { count: n })} />
          </div>
        </section>
      )}

      {monthly.isPending && <p role="status">{t("status.loading")}</p>}
      {monthly.isError && (
        <p role="alert">
          {t("payMonthly.failed")}{" "}
          <button className={ctl} onClick={() => void monthly.refetch()}>
            {t("payMonthly.retry")}
          </button>
        </p>
      )}
      {r && (
        <>
          {/* ③ KPI */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 font-semibold">
              {tr("kpi.title")}
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {tr(`basis.${basis}`)}
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {kpis.map((k) => (
                <button
                  type="button"
                  key={k.key}
                  className={`${card} text-left transition-colors hover:border-indigo-400`}
                  onClick={() => onList(k.status ?? "")}
                >
                  <span className="block text-sm text-secondary">{tr(`kpi.${k.key}`)}</span>
                  <span className={`mt-1 block text-2xl font-bold tabular-nums ${k.alert ? "text-red-600" : ""}`}>
                    {k.key === "rate"
                      ? k.value === null
                        ? "—"
                        : `${k.value.toFixed(1)}%`
                      : money(k.value)}
                    {k.unit && k.value !== null && (
                      <small className="ml-0.5 text-sm font-medium text-secondary">{tr("won")}</small>
                    )}
                  </span>
                  {k.bar !== undefined && (
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, k.bar))}%` }} />
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-secondary tabular-nums">{k.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ④ 청구 진행 퍼널 */}
          <section className={card}>
            <h2 className="flex items-center gap-2 font-semibold">
              {tr("funnel.title")}
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {tr("funnel.tag")}
              </span>
            </h2>
            <p className="mb-3 mt-1 text-xs text-secondary">{tr("funnel.hint")}</p>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <ol className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
                {funnel.map((f, i) => (
                  <li key={f.key} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onList(f.status, f.scope)}
                      className={`h-full w-full border px-3 py-2.5 text-left max-lg:rounded-md lg:-ml-px ${
                        i === 0 ? "lg:rounded-l-lg" : ""
                      } ${i === funnel.length - 1 ? "lg:rounded-r-lg" : ""} ${
                        f.tone === "hot"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : f.tone === "warn"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <span className="block truncate text-xs text-secondary">{tr(`funnel.${f.key}`)}</span>
                      <span className="block text-xl font-bold tabular-nums">{f.value}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="h-10 shrink-0 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                onClick={onPickStudent}
              >
                {tr("funnel.pick", { count: r.summary.missing })}
              </button>
            </div>
          </section>

          {/* ⑦ 사이트별 비교 · 미납 상위 */}
          <div className="grid gap-4 xl:grid-cols-2">
            <section className={card}>
              <h2 className="font-semibold">{tr("sites.title")}</h2>
              <p className="mb-2 mt-1 text-xs text-secondary">{tr("sites.hint")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={th}>{tr("sites.site")}</th>
                      {["enrolled", "net", "unpaid", "cash", "rate"].map((k) => (
                        <th key={k} className={`${th} text-right`}>{tr(`sites.${k}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {siteRows.map((s) => (
                      <tr key={s.site} className="border-t">
                        <td className={td}>
                          <button type="button" className="font-medium text-indigo-700 hover:underline" onClick={() => onFilter(month, s.site)}>
                            {siteLabel(s.site)}
                          </button>
                        </td>
                        <td className={`${td} text-right`}>{s.summary.enrolled}</td>
                        <td className={`${td} text-right`}>{money(s.ledger.net)}</td>
                        <td className={`${td} text-right`}>{money(s.ledger.unpaid)}</td>
                        <td className={`${td} text-right`}>{money(s.cash.received)}</td>
                        <td className={`${td} text-right`}>{rate(s.ledger.received, s.ledger.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50 font-bold">
                      <td className={td}>{tr("sites.total")}</td>
                      <td className={`${td} text-right`}>{siteTotal.enrolled}</td>
                      <td className={`${td} text-right`}>{money(siteTotal.net)}</td>
                      <td className={`${td} text-right`}>{money(siteTotal.unpaid)}</td>
                      <td className={`${td} text-right`}>{money(siteTotal.cash)}</td>
                      <td className={`${td} text-right`}>{rate(siteTotal.received, siteTotal.net)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
            <section className={card}>
              <h2 className="mb-2 font-semibold">{tr("top.title")}</h2>
              {r.topUnpaid.length === 0 ? (
                <p className="py-7 text-center font-semibold text-emerald-600">
                  ✓ {tr("top.empty")}
                  <small className="mt-0.5 block font-normal text-secondary">
                    {monthLabel(month)} · {siteLabel(site)}
                  </small>
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className={th}>{tr("top.student")}</th>
                        <th className={th}>{tr("sites.site")}</th>
                        <th className={`${th} text-right`}>{tr("top.unpaid")}</th>
                        <th className={`${th} text-right`}>{tr("top.elapsed")}</th>
                        <th className={th} />
                      </tr>
                    </thead>
                    <tbody>
                      {r.topUnpaid.map((s) => (
                        <tr key={s.id} className="border-t">
                          <td className={td}>
                            <Link className="font-medium text-indigo-700 hover:underline" to={`/admin/std/${s.id}`}>
                              {s.name}
                            </Link>
                          </td>
                          <td className={td}>
                            {[...new Set(s.periods.map((p) => p.site || "UNASSIGNED"))]
                              .map((x) => siteLabel(x))
                              .join(", ") || siteLabel(s.site || "UNASSIGNED")}
                          </td>
                          <td className={`${td} text-right font-semibold text-red-600`}>{money(s.unpaid)}</td>
                          <td className={`${td} text-right`}>{elapsed(s.oldestUnpaidDue)}</td>
                          <td className={`${td} text-right`}>
                            {s.billCount > 0 && (
                              <button type="button" className={`${ctl} h-8`} onClick={() => onDetail(s.billIds, true)}>
                                {tr("top.view")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </>
      )}
      {/* ② 데이터 품질 배너 (재원기간 확인 필요) — 맨 아래 */}
      {banner}
    </section>
  );
}

/** ⑤ 최근 12개월 순청구(청구월) · 순수납(실제 수납월) 묶음 막대. */
function TrendChart({
  trend,
  selected,
  lang,
  title,
  money,
  won,
  netLabel,
  cashLabel,
  enrolledLabel,
  people,
}: {
  trend: MonthlyPaymentResult["trend"];
  selected: string;
  lang: string;
  title: string;
  money: (n: number) => string;
  won: string;
  netLabel: string;
  cashLabel: string;
  enrolledLabel: string;
  people: (n: number) => string;
}) {
  const W = 720,
    H = 220,
    L = 56,
    R = 40,
    T = 18,
    B = 28;
  const iw = W - L - R,
    ih = H - T - B,
    gw = iw / Math.max(1, trend.length),
    bw = Math.min(14, gw * 0.32);
  const peak = Math.max(0, ...trend.flatMap((p) => [p.net, Math.abs(p.cash.received)]));
  const step = niceStep(peak / 3 || 1);
  const max = step * Math.max(1, Math.ceil(peak / step));
  const compact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
  const y = (v: number) => T + ih - (ih * v) / max;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  // REQ-261112B — 재원생 수 꺾은선 (오른쪽 축).
  const heads = trend.map((p) => p.enrolled ?? null);
  const hasHeads = heads.some((n) => n !== null);
  const hPeak = Math.max(1, ...heads.map((n) => n ?? 0));
  const hStep = niceStep(hPeak / 3 || 1);
  const hMax = hStep * Math.max(1, Math.ceil(hPeak / hStep));
  const hy = (n: number) => T + ih - (ih * n) / hMax;
  const hx = (i: number) => L + gw * i + gw / 2;
  const hTicks = Array.from({ length: Math.round(hMax / hStep) + 1 }, (_, i) => i * hStep);
  const line = heads
    .map((n, i) => (n === null ? null : `${hx(i)},${hy(n)}`))
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} className="h-auto max-h-[240px] min-w-[640px]">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#eef0f3" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9aa1ac">
            {v ? compact.format(v) : "0"}
          </text>
        </g>
      ))}
      {hasHeads &&
        hTicks.map((n) => (
          <text key={`h${n}`} x={W - R + 6} y={hy(n) + 4} textAnchor="start" fontSize="11" fill="#d97706">
            {n}
          </text>
        ))}
      {trend.map((p, i) => {
        const cx = L + gw * i + gw / 2,
          on = p.month === selected,
          cash = p.cash.received,
          hn = (ih * Math.max(0, p.net)) / max,
          hc = (ih * Math.abs(cash)) / max;
        return (
          <g key={p.month}>
            {p.net > 0 && (
              <>
                <rect x={cx - bw - 1} y={T + ih - hn} width={bw} height={hn} rx="3" fill="#4f46e5">
                  <title>{`${p.month} ${netLabel} ${money(p.net)}${won}`}</title>
                </rect>
                <text x={cx - 1} y={T + ih - hn - 4} textAnchor="end" fontSize="10" fill="#4f46e5" fontWeight="600">
                  {compact.format(p.net)}
                </text>
              </>
            )}
            {cash !== 0 && (
              <>
                <rect x={cx + 1} y={T + ih - hc} width={bw} height={hc} rx="3" fill={cash < 0 ? "#e5484d" : "#10b981"}>
                  <title>{`${p.month} ${cashLabel} ${money(cash)}${won}`}</title>
                </rect>
                <text x={cx + 1} y={T + ih - hc - 4} textAnchor="start" fontSize="10" fill={cash < 0 ? "#e5484d" : "#059669"} fontWeight="600">
                  {compact.format(cash)}
                </text>
              </>
            )}
            <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={on ? "#4f46e5" : "#9aa1ac"} fontWeight={on ? 700 : 400}>
              {new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" }).format(new Date(`${p.month}-01T00:00:00Z`))}
            </text>
          </g>
        );
      })}
      {hasHeads && (
        <g>
          <polyline points={line} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" />
          {heads.map((n, i) =>
            n === null ? null : (
              <g key={`p${i}`}>
                <circle cx={hx(i)} cy={hy(n)} r="3.5" fill="#fff" stroke="#f59e0b" strokeWidth="2">
                  <title>{`${trend[i].month} ${enrolledLabel} ${people(n)}`}</title>
                </circle>
                <text x={hx(i)} y={hy(n) - 8} textAnchor="middle" fontSize="10" fill="#b45309" fontWeight="600">
                  {people(n)}
                </text>
              </g>
            ),
          )}
        </g>
      )}
    </svg>
  );
}
