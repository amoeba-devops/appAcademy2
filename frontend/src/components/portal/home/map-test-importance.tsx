"use client";

import { useTranslation } from "react-i18next";
import { TPI_IMPORTANCE_KEYS } from "@/lib/portal/tpi-content";

export function MapTestImportance() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          {t("home.importance.title")}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TPI_IMPORTANCE_KEYS.map((key, idx) => (
            <li
              key={key}
              className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                aria-hidden="true"
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-base font-bold text-blue-700"
              >
                {String(idx + 1).padStart(2, "0")}
              </div>
              <p className="text-sm font-medium leading-relaxed text-slate-700 sm:text-base">
                {t(`home.importance.${key}`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
