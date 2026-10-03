import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { monthlySites } from "./monthly-payment-view";
export interface PopulationPoint {
  month: string;
  enrolled: number;
  newStudents: number;
  paused: number | null;
  knownPaused: number;
  withdrawn: number | null;
  knownWithdrawn: number;
  historyIncomplete: boolean;
  review: number;
}
export interface CollectionPoint {
  month: string;
  paid: number;
  unpaid: number;
  total: number;
  drafts: number;
  canceled: number;
  free: number;
}
export interface TopStatisticsResult {
  month: string;
  site: string;
  population: PopulationPoint[];
  collections: CollectionPoint[];
  asOf: string;
}
const field = "rounded border bg-white px-3 py-2 text-sm";
const colors = {
  enrolled: "#7eb4ea",
  newStudents: "#45464c",
  paused: "#69b957",
  withdrawn: "#f59b55",
};
export function StatisticsCharts({ result }: { result: TopStatisticsResult }) {
  const { t, i18n } = useTranslation("common");
  const tr = (k: string) => t(`payStats.${k}`);
  const points = result.population;
  const maxStock = Math.max(
    2,
    Math.ceil(Math.max(0, ...points.map((p) => p.enrolled)) / 2) * 2,
  );
  const maxFlow = Math.max(
    2,
    Math.ceil(
      Math.max(
        0,
        ...points.flatMap((p) => [
          p.newStudents,
          p.paused || 0,
          p.withdrawn || 0,
        ]),
      ) / 2,
    ) * 2,
  );
  const x = (i: number) => 75 + i * 110;
  const y = (n: number, max: number) => 210 - (n / max) * 170;
  const monthName = (m: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${m}-01T00:00:00Z`));
  return (
    <>
      <div className="grid grid-cols-1 divide-y rounded-xl border bg-white xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        <section className="min-w-0 p-5">
          <h2 className="text-center text-lg font-semibold">
            {tr("population")}
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
            {Object.entries(colors).map(([k, c]) => (
              <span key={k}>
                <span aria-hidden style={{ color: c }}>
                  ●{" "}
                </span>
                {tr(k)}
              </span>
            ))}
          </div>
          <svg
            viewBox="0 0 370 255"
            className="w-full"
            role="img"
            aria-label={tr("axes")}
          >
            <title>{tr("population")}</title>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line
                  x1="40"
                  x2="330"
                  y1={y(f, 1)}
                  y2={y(f, 1)}
                  stroke="#e5e7eb"
                />
                <text x="32" y={y(f, 1) + 4} textAnchor="end" fontSize="11">
                  {Math.round(maxFlow * f)}
                </text>
                <text x="336" y={y(f, 1) + 4} fontSize="11" fill="#2879b8">
                  {Math.round(maxStock * f)}
                </text>
              </g>
            ))}
            {points.map((p, i) => (
              <g key={p.month}>
                <rect
                  x={x(i) - 25}
                  y={y(p.enrolled, maxStock)}
                  width="50"
                  height={210 - y(p.enrolled, maxStock)}
                  fill={colors.enrolled}
                  rx="3"
                />
                <text x={x(i)} y="233" textAnchor="middle" fontSize="11">
                  {p.month.slice(2)}
                </text>
              </g>
            ))}
            {(["newStudents", "paused", "withdrawn"] as const).map((k) => (
              <g key={k}>
                {points.map((p, i) => {
                  const v = p[k];
                  const prev = points[i - 1]?.[k];
                  return v === null ? null : (
                    <g key={i}>
                      {i > 0 && prev !== null && prev !== undefined && (
                        <line
                          x1={x(i - 1)}
                          y1={y(prev, maxFlow)}
                          x2={x(i)}
                          y2={y(v, maxFlow)}
                          stroke={colors[k]}
                          strokeWidth="2.5"
                        />
                      )}
                      <circle
                        cx={x(i)}
                        cy={y(v, maxFlow)}
                        r="4"
                        fill={colors[k]}
                      >
                        <title>
                          {monthName(p.month)} {tr(k)}: {v}
                        </title>
                      </circle>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
          <p className="text-xs text-secondary">{tr("axes")}</p>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer">{tr("numbers")}</summary>
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr>
                  <th>{tr("month")}</th>
                  {Object.keys(colors).map((k) => (
                    <th key={k}>{tr(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.month}>
                    <th>{p.month}</th>
                    <td>{p.enrolled}</td>
                    <td>{p.newStudents}</td>
                    <td>{p.paused === null ? tr("unknown") : p.paused}</td>
                    <td>
                      {p.withdrawn === null ? tr("unknown") : p.withdrawn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {points.some((p) => p.historyIncomplete || p.review > 0) && (
            <div className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">
              {tr("historyNotice")}
              {points.map((p) => (
                <p key={p.month}>
                  {p.month}: {tr("review")} {p.review} · {tr("knownPaused")}{" "}
                  {p.knownPaused} · {tr("knownWithdrawn")} {p.knownWithdrawn}
                </p>
              ))}
              <Link className="underline" to="/admin/std">
                {tr("historyLink")}
              </Link>
            </div>
          )}
        </section>
        {result.collections.map((p) => (
          <section
            key={p.month}
            className="flex min-w-0 flex-col items-center p-5"
          >
            <h2 className="text-lg font-semibold">
              {monthName(p.month)} {tr("collections")}
            </h2>
            <div
              role="img"
              aria-label={`${tr("paid")}: ${p.paid}, ${tr("unpaid")}: ${p.unpaid}`}
              className="my-7 flex aspect-square w-48 items-center justify-center rounded-full sm:w-56"
              style={{
                background: p.total
                  ? `conic-gradient(#7eb4ea 0 ${(p.paid / p.total) * 100}%, #f59b55 ${(p.paid / p.total) * 100}% 100%)`
                  : "#f3f4f6",
              }}
            >
              {!p.total && (
                <span className="p-4 text-center text-sm text-secondary">
                  {tr("empty")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              {(["paid", "unpaid"] as const).map((k) => (
                <p key={k}>
                  <span style={{ color: k === "paid" ? "#2879b8" : "#ae570c" }}>
                    ●{" "}
                  </span>
                  {tr(k)}:{" "}
                  {p.total ? ((p[k] / p.total) * 100).toFixed(1) + "%" : "—"} (
                  {p[k]} {tr("bills")})
                </p>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-secondary">
              {tr("drafts")} {p.drafts} · {tr("canceled")} {p.canceled} ·{" "}
              {tr("free")} {p.free}
            </p>
          </section>
        ))}
      </div>
      <p className="text-xs text-secondary">
        {tr("basis")} · {tr("updated")}{" "}
        {new Date(result.asOf).toLocaleString(i18n.language)}
      </p>
    </>
  );
}
export function PaymentTopStatistics({
  identity,
  month,
  site,
  onFilter,
}: {
  identity: string;
  month: string;
  site: string;
  onFilter: (month: string, site: string) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (k: string) => t(`payStats.${k}`);
  const query = useQuery({
    queryKey: ["pay", identity, "statistics", month, site],
    queryFn: async () =>
      (
        await apiClient.get<TopStatisticsResult>("/acm/pay/bills/statistics", {
          params: { month, site },
        })
      ).data,
  });
  const change = (m: string, s: string) => {
    if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)) onFilter(m, s);
  };
  const move = (n: number) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    change(d.toISOString().slice(0, 7), site);
  };
  return (
    <section className="space-y-3" aria-label={tr("title")}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={field}
          aria-label={t("payMonthly.previousMonth")}
          onClick={() => move(-1)}
        >
          ◀
        </button>
        <input
          className={field}
          aria-label={tr("month")}
          type="month"
          min="2000-01"
          max="2099-12"
          value={month}
          onChange={(e) => change(e.target.value, site)}
        />
        <button
          className={field}
          aria-label={t("payMonthly.nextMonth")}
          onClick={() => move(1)}
        >
          ▶
        </button>
        <button
          className={field}
          onClick={() =>
            change(
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "2-digit",
              })
                .format(new Date())
                .slice(0, 7),
              site,
            )
          }
        >
          {t("payMonthly.thisMonth")}
        </button>
        <select
          className={field}
          aria-label={t("payMonthly.site")}
          value={site}
          onChange={(e) => change(month, e.target.value)}
        >
          {monthlySites.map((s) => (
            <option key={s} value={s}>
              {t(`payMonthly.${s}`)}
            </option>
          ))}
        </select>
        <button
          className={field}
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {tr("refresh")}
        </button>
      </div>
      {query.isPending ? (
        <p role="status">{t("status.loading")}</p>
      ) : query.isError ? (
        <p role="alert">{tr("error")}</p>
      ) : (
        query.data && <StatisticsCharts result={query.data} />
      )}
    </section>
  );
}
