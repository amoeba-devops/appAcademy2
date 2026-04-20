"use client";

import { useTranslation } from "react-i18next";

export function CampusBand() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-navy px-4 py-20 text-center text-cream sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          {t("home.campus-band.eyebrow")}
        </p>
        <h2 className="mt-4 whitespace-pre-line font-display text-2xl font-bold leading-tight text-cream sm:text-3xl lg:text-4xl">
          {t("home.campus-band.title")}
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-cream/80">
          {t("home.campus-band.lead")}
        </p>
      </div>
    </section>
  );
}
