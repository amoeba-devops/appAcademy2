"use client";

import { useTranslation } from "react-i18next";

const PILLAR_KEYS = ["p1", "p2", "p3", "p4"] as const;
const PILLAR_NUMBERS: Record<(typeof PILLAR_KEYS)[number], string> = {
  p1: "01",
  p2: "02",
  p3: "03",
  p4: "04",
};

export function PillarSection() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-white px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">
            {t("home.pillars-section.eyebrow")}
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-navy sm:text-4xl">
            {t("home.pillars-section.title")}
          </h2>
        </div>

        <div className="mt-12 divide-y divide-slate-200">
          {PILLAR_KEYS.map((key) => (
            <article
              key={key}
              className="grid gap-6 py-10 sm:grid-cols-[88px_1fr] sm:gap-8"
            >
              <div className="font-display text-4xl font-bold leading-none text-gold sm:border-r-2 sm:border-gold sm:pr-6 sm:text-5xl">
                {PILLAR_NUMBERS[key]}
              </div>
              <div>
                <h3 className="font-display text-xl font-bold leading-snug text-navy sm:text-2xl">
                  {t(`home.pillars.${key}.title`)}
                </h3>
                <p className="mt-4 text-base text-slate-600">{t(`home.pillars.${key}.problem`)}</p>
                <p className="mt-4 text-[15px] leading-[1.9] text-slate-900">
                  <span className="font-bold text-navy">{t(`home.pillars.${key}.label`)}</span>{" "}
                  {t(`home.pillars.${key}.solution`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
