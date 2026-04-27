"use client";

import { useTranslation } from "react-i18next";

export function MapTestIntro() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {t("home.intro.title")}
        </h2>
        <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-blue-500" aria-hidden="true" />
        <p className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {t("home.intro.body")}
        </p>
      </div>
    </section>
  );
}
