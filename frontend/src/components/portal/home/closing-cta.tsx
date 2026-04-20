"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { SITE } from "@/lib/portal/site-content";

export function ClosingCta() {
  const { t } = useTranslation("portal");
  return (
    <section className="bg-gradient-to-br from-navy to-navy-700 px-4 py-20 text-center text-cream sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
          {t("home.closing.eyebrow")}
        </p>
        <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-cream sm:text-4xl lg:text-5xl">
          {t("home.closing.title")}
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-cream/85">
          {t("home.closing.lead")}
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          <CloseCard
            href="/map-test"
            icon="📝"
            title={t("closing-cta.map-test-title")}
            sub={t("closing-cta.map-test-sub")}
          />
          <CloseCard
            href="/contact"
            icon="💬"
            title={t("closing-cta.consult-title")}
            sub={t("closing-cta.consult-sub")}
          />
          <CloseCard
            href={`tel:${SITE.phones[0]}`}
            icon="📞"
            title={t("closing-cta.phone-title")}
            phones={SITE.phones as unknown as string[]}
            external
          />
        </div>
      </div>
    </section>
  );
}

function CloseCard({
  href,
  icon,
  title,
  sub,
  phones,
  external,
}: {
  href: string;
  icon: string;
  title: string;
  sub?: string;
  phones?: string[];
  external?: boolean;
}) {
  const classes =
    "block rounded-xl border border-gold/30 bg-white/5 p-6 text-left transition hover:-translate-y-0.5 hover:bg-white/10";
  const content = (
    <>
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold text-gold">
        {title}
      </h3>
      {sub && <p className="mt-2 text-sm text-cream/85">{sub}</p>}
      {phones && (
        <div className="mt-3 space-y-1">
          {phones.map((p) => (
            <p key={p} className="font-display text-lg text-cream sm:text-xl">
              {p}
            </p>
          ))}
        </div>
      )}
    </>
  );
  return external ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
