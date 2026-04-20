"use client";

import { useTranslation } from "react-i18next";

const PROCESS_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;
const STEP_NUMBERS: Record<(typeof PROCESS_KEYS)[number], string> = {
  s1: "01",
  s2: "02",
  s3: "03",
  s4: "04",
  s5: "05",
};

export function ProcessTimeline() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-cream px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-deep">
            {t("home.process-section.eyebrow")}
          </p>
          <h2 className="mt-3 whitespace-pre-line font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">
            {t("home.process-section.title")}
          </h2>
        </div>

        <ol className="relative mt-14 before:absolute before:left-[43px] before:top-14 before:bottom-14 before:w-0.5 before:bg-gradient-to-b before:from-gold before:to-gold/20">
          {PROCESS_KEYS.map((key) => (
            <li
              key={key}
              className="relative grid gap-5 py-8 sm:grid-cols-[88px_1fr] sm:gap-6"
            >
              <div className="relative z-10 flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full border-[3px] border-gold bg-navy font-display font-bold text-gold">
                <span className="text-2xl leading-none">{STEP_NUMBERS[key]}</span>
                <span className="mt-1 text-[10px] tracking-[0.15em]">STEP</span>
              </div>
              <div className="sm:pt-3">
                <h3 className="font-display text-xl font-bold text-navy sm:text-2xl">
                  {t(`home.process.${key}.title`)}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.9] text-slate-900">
                  <span className="font-bold text-navy">{t(`home.process.${key}.label`)}</span>{" "}
                  {t(`home.process.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
