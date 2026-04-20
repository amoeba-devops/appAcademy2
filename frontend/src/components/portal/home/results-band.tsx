"use client";

import { useTranslation } from "react-i18next";
import { SchoolChip } from "./school-chip";

const SCHOOLS = [
  { name: "NLCS", region: "JEJU" },
  { name: "SJA", region: "JEJU" },
  { name: "KIS", region: "JEJU" },
  { name: "CHADWICK", region: "INTL" },
];

export function ResultsBand() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-cream-deep px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">
            {t("home.results.eyebrow")}
          </p>
          <h2 className="mt-3 whitespace-pre-line font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">
            {t("home.results.title")}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
            {t("home.results.lead")}
          </p>

          <div className="mt-8 rounded-xl bg-navy p-6 text-center text-cream shadow-xl shadow-navy/10">
            <div className="font-display text-5xl font-bold leading-none text-gold sm:text-6xl">
              {t("home.results.stat-value")}
              <span className="text-3xl sm:text-4xl">{t("home.results.stat-unit")}</span>
            </div>
            <p className="mt-3 text-xs tracking-[0.1em] text-cream/85 sm:text-sm">
              {t("home.results.stat-label")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SCHOOLS.map((s) => (
            <SchoolChip key={s.name} name={s.name} region={s.region} />
          ))}
        </div>
      </div>
    </section>
  );
}

const STATS_ITEMS = [
  { value: "230+", labelKey: "home.results-stats.item-graduates" },
  { value: "144", labelKey: "home.results-stats.item-admitted" },
  { value: "99%", labelKey: "home.results-stats.item-pass-rate" },
  { value: "2020", labelKey: "home.results-stats.item-founded" },
] as const;

export function ResultsStatsBand() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-cream-deep px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">
          {t("home.results-stats.eyebrow")}
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-navy sm:text-4xl">
          {t("home.results-stats.title")}
        </h2>
        <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS_ITEMS.map((item) => (
            <div key={item.labelKey}>
              <div className="font-display text-4xl font-bold text-gold-deep sm:text-5xl lg:text-6xl">
                {item.value}
              </div>
              <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                {t(item.labelKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
