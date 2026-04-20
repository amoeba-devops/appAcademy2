"use client";

import { useTranslation } from "react-i18next";
import { SITE } from "@/lib/portal/site-content";

export function ContactDetails() {
  const { t } = useTranslation("portal");
  return (
    <section className="border-t border-slate-200 bg-cream-deep px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        <Card title={t("site.campus-jeju.name")}>
          {t("site.campus-jeju.line1")}
          <br />
          {t("site.campus-jeju.line2")}
          <span className="mt-2 block text-xs text-slate-500">
            {t("site.campus-jeju.note")}
          </span>
        </Card>
        <Card title={t("site.campus-seoul.name")}>
          {t("site.campus-seoul.line1")}
          <span className="mt-2 block text-xs text-slate-500">
            {t("site.campus-seoul.note")}
          </span>
        </Card>
      </div>
      <div className="mx-auto mt-5 max-w-3xl space-y-2 text-center text-sm text-slate-700">
        <p>
          <span className="font-semibold text-navy">{t("footer.consultation-hours")}</span>{" "}
          {t("site.hours-consultation")}
          <span className="mx-2 text-slate-400">·</span>
          <span className="font-semibold text-navy">{t("footer.class-hours")}</span>{" "}
          {t("site.hours-class")}
        </p>
        <p className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <a href={`tel:${SITE.phones[0]}`} className="hover:text-gold-deep">
            📞 {SITE.phones[0]}
          </a>
          <a href={`tel:${SITE.phones[1]}`} className="hover:text-gold-deep">
            📱 {SITE.phones[1]}
          </a>
          <a href={`mailto:${SITE.email}`} className="hover:text-gold-deep">
            ✉️ {SITE.email}
          </a>
        </p>
      </div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="mb-2 font-semibold text-navy">{title}</p>
      <p className="text-sm leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}
