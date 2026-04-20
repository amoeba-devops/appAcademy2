"use client";

import { useTranslation } from "react-i18next";

export function HeroSection() {
  const { t } = useTranslation("portal");
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-navy-700 to-navy-500 px-4 py-28 text-center text-cream sm:px-6 sm:py-36 lg:px-8 lg:py-44">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(201,166,86,0.18),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(201,166,86,0.1),transparent_50%)]"
      />
      <div className="relative mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold sm:text-sm">
          {t("home.hero.eyebrow")}
        </p>
        <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-[0.04em] text-cream sm:text-6xl lg:text-7xl">
          {t("home.hero.title")}
          <span className="mt-4 block text-base font-medium tracking-[0.2em] text-gold sm:text-xl">
            {t("home.hero.subtitle")}
          </span>
        </h1>
        <p className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-cream/85 sm:text-lg">
          {t("home.hero.lead")}
        </p>
      </div>
    </section>
  );
}
