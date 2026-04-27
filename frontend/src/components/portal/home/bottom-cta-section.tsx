"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TPI_SITE } from "@/lib/portal/tpi-content";

export function BottomCtaSection() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 px-4 py-20 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">
          {t("home.bottom-cta.title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          {t("home.bottom-cta.subtitle")}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={TPI_SITE.kakaoChat}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-yellow-300 px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-colors hover:bg-yellow-200 sm:text-base"
          >
            <span aria-hidden="true">💬</span>
            {t("home.bottom-cta.cta-kakao")}
          </a>
          <a
            href={`tel:${TPI_SITE.phoneDigits}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-colors hover:bg-slate-100 sm:text-base"
          >
            <span aria-hidden="true">📞</span>
            {t("home.bottom-cta.cta-phone")}
          </a>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-slate-900 sm:text-base"
          >
            <span aria-hidden="true">📝</span>
            {t("home.bottom-cta.cta-consult")}
          </Link>
        </div>
      </div>
    </section>
  );
}
