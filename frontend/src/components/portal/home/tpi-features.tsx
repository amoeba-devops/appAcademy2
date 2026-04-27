"use client";

import { useTranslation } from "react-i18next";
import { TPI_FEATURE_KEYS } from "@/lib/portal/tpi-content";

export function TpiFeatures() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          {t("home.features.title")}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TPI_FEATURE_KEYS.map((key, idx) => (
            <article
              key={key}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-7 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-lg"
            >
              <span
                aria-hidden="true"
                className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600"
              >
                FEATURE {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-3 text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                {t(`home.features.${key}-title`)}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {t(`home.features.${key}-body`)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
