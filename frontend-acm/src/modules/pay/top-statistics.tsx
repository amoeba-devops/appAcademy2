import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
      <div
        className="max-w-full overflow-x-auto rounded-xl border bg-white"
        tabIndex={0}
        role="region"
        aria-label={tr("title")}
      >
        {/* TST-261019 M6 — 휴대폰은 차트 3개 세로 배치, md 이상은 기존 3열. */}
        <div className="grid grid-cols-1 divide-y md:min-w-[600px] md:grid-cols-3 md:divide-x md:divide-y-0">
          <section className="min-w-0 p-3">
            <h2 className="text-center text-sm font-semibold">
              {tr("population")}
            </h2>
            <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
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
              className="mx-auto w-full max-w-[280px]"
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
          </section>
          {result.collections.map((p) => (
            <section
              key={p.month}
              className="flex min-w-0 flex-col items-center p-3"
            >
              <h2 className="text-center text-sm font-semibold">
                {monthName(p.month)} {tr("collections")}
              </h2>
              <div
                role="img"
                aria-label={`${tr("paid")}: ${p.paid}, ${tr("unpaid")}: ${p.unpaid}`}
                className="my-4 flex aspect-square w-3/4 max-w-[160px] shrink-0 items-center justify-center rounded-full"
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
              <div className="flex flex-wrap justify-center gap-2 text-xs">
                {(["paid", "unpaid"] as const).map((k) => (
                  <p key={k}>
                    <span
                      style={{ color: k === "paid" ? "#2879b8" : "#ae570c" }}
                    >
                      ●{" "}
                    </span>
                    {tr(k)}:{" "}
                    {p.total ? ((p[k] / p.total) * 100).toFixed(1) + "%" : "—"}{" "}
                    ({p[k]} {tr("bills")})
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
      </div>
      <p className="text-xs text-secondary">{tr("basis")}</p>
    </>
  );
}
/**
 * 월 이동(◀ 월 ▶ 이번 달) + 학원 선택. REQ-261112 — 월별 납부 목록은 이 컨트롤을
 * 검색·필터와 같은 한 줄에 두기 위해 분리했다(Fragment 라 부모 flex 줄에 그대로 놓인다).
 */
export function MonthSiteFilter({
  month,
  site,
  onFilter,
}: {
  month: string;
  site: string;
  onFilter: (month: string, site: string) => void;
}) {
  const { t } = useTranslation("common");
  const tr = (k: string) => t(`payStats.${k}`);
  const change = (m: string, s: string) => {
    if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)) onFilter(m, s);
  };
  const move = (n: number) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    change(d.toISOString().slice(0, 7), site);
  };
  return (
    <>
      <button
        className={field}
        aria-label={t("payMonthly.previousMonth")}
        onClick={() => move(-1)}
      >
        ◀
      </button>
      <MonthPicker
        label={tr("month")}
        month={month}
        onPick={(m) => change(m, site)}
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
    </>
  );
}

/**
 * REQ-261112C — 월을 언어별 글자(예: 2026년 12월)로 보여 주고, 누르면 연도 이동 + 12개월 선택 창.
 * Safari 데스크톱은 type="month" 를 지원하지 않아 직접 만든다.
 */
function MonthPicker({
  label,
  month,
  onPick,
}: {
  label: string;
  month: string;
  onPick: (month: string) => void;
}) {
  const { i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    setYear(Number(month.slice(0, 4)));
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, month]);
  const fmt = (m: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language, { ...opts, timeZone: "UTC" }).format(
      new Date(`${m}-01T00:00:00Z`),
    );
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`${field} min-w-[8.5rem] font-semibold tabular-nums`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {fmt(month, { year: "numeric", month: "long" })}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-lg border bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="h-8 w-8 rounded hover:bg-slate-100" aria-label={String(year - 1)} onClick={() => setYear(year - 1)}>
              ◀
            </button>
            <span className="font-semibold tabular-nums">{year}</span>
            <button type="button" className="h-8 w-8 rounded hover:bg-slate-100" aria-label={String(year + 1)} onClick={() => setYear(year + 1)}>
              ▶
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const m = `${year}-${String(i + 1).padStart(2, "0")}`;
              const on = m === month;
              return (
                <button
                  type="button"
                  key={m}
                  aria-pressed={on}
                  disabled={year < 2000 || year > 2099}
                  className={`h-9 rounded text-sm ${on ? "bg-indigo-600 font-semibold text-white" : "hover:bg-slate-100"}`}
                  onClick={() => {
                    onPick(m);
                    setOpen(false);
                  }}
                >
                  {fmt(m, { month: "short" })}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
