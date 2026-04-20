"use client";

import { useTranslation } from "react-i18next";
import { SITE } from "@/lib/portal/site-content";

export function PortalFooter() {
  const { t } = useTranslation("portal");
  return (
    <footer className="bg-navy px-4 pb-6 pt-16 text-cream sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="grid gap-5 md:grid-cols-2">
          <CampusBlock
            name={t("site.campus-jeju.name")}
            line1={t("site.campus-jeju.line1")}
            line2={t("site.campus-jeju.line2")}
            note={t("site.campus-jeju.note")}
          />
          <CampusBlock
            name={t("site.campus-seoul.name")}
            line1={t("site.campus-seoul.line1")}
            note={t("site.campus-seoul.note")}
          />
        </div>

        <div className="mt-8 space-y-2 text-center text-sm">
          <p>
            <span className="font-semibold text-gold">{t("footer.consultation-hours")}</span>{" "}
            {t("site.hours-consultation")}
            <span className="mx-3 text-gold/40">·</span>
            <span className="font-semibold text-gold">{t("footer.class-hours")}</span>{" "}
            {t("site.hours-class")}
          </p>
          <p className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-cream/85">
            <a href={`tel:${SITE.phones[0]}`} className="hover:text-gold">
              📞 {SITE.phones[0]}
            </a>
            <a href={`tel:${SITE.phones[1]}`} className="hover:text-gold">
              📱 {SITE.phones[1]}
            </a>
            <a href={`mailto:${SITE.email}`} className="hover:text-gold">
              ✉️ {SITE.email}
            </a>
            <a
              href={SITE.kakao}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold"
            >
              {t("footer.kakao-channel")}
            </a>
          </p>
        </div>

        <div className="mt-10 border-t border-cream/10 pt-5 text-center text-xs text-cream/60">
          <p className="mb-2 text-cream/40">{t("footer.business-info")}</p>
          <p>{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}

function CampusBlock({
  name,
  line1,
  line2,
  note,
}: {
  name: string;
  line1: string;
  line2?: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-gold/20 p-5">
      <p className="mb-2 font-semibold text-gold">{name}</p>
      <p className="text-sm leading-relaxed text-cream/90">
        {line1}
        {line2 && (
          <>
            <br />
            {line2}
          </>
        )}
      </p>
      {note && <p className="mt-3 text-xs text-cream/60">{note}</p>}
    </div>
  );
}
