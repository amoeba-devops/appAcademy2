'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { Program } from "@/types/program";

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Basic",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

function gradeRange(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  if (min && max) return `G${min} – G${max}`;
  if (min) return `G${min}+`;
  return `~G${max}`;
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("portal");

  const formatFee = (amount: string | null): string => {
    if (!amount) return t("programs.fee-inquiry");
    const n = Number(amount);
    return isNaN(n) ? amount : `₩${n.toLocaleString()}`;
  };

  const categoryLabel = (key: string) =>
    t(`programs.category.${key}`, { defaultValue: key });

  const { data: program, isLoading } = useQuery<Program | null>({
    queryKey: ["portal-program", id],
    queryFn: async () => {
      const res = await fetch(`/api/portal/programs/${id}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20">
        <div className="h-56 animate-pulse rounded-xl bg-navy/5" />
        <div className="mt-8 h-40 animate-pulse rounded-xl bg-navy/5" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="py-32 text-center">
        <h2 className="font-display text-2xl font-bold text-navy">
          {t("programs.not-found-title")}
        </h2>
        <Link
          href="/programs"
          className="mt-4 inline-block text-sm text-gold hover:underline"
        >
          {t("programs.back-to-list")}
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <section
        className={`px-4 py-16 text-cream sm:px-6 sm:py-24 lg:px-8 ${
          program.category === "MATH"
            ? "bg-gradient-to-br from-ama-accent/90 to-ama-accent"
            : "bg-gradient-to-br from-navy via-navy-700 to-navy-500"
        }`}
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap gap-2">
            {program.level && (
              <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-gold">
                {LEVEL_LABELS[program.level] ?? program.level}
              </span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-cream">
              {categoryLabel(program.category)}
            </span>
            {(program.targetAgeMin || program.targetAgeMax) && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-cream">
                {gradeRange(program.targetAgeMin, program.targetAgeMax)}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-cream sm:text-5xl">
            {program.name}
          </h1>
          {program.description && (
            <p className="mt-4 max-w-2xl text-base text-cream/85 sm:text-lg">
              {program.description}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-4 font-serif text-lg text-gold sm:text-xl">
            {program.setting?.sessionCount && program.durationWeeks && (
              <span>
                {t("programs.weekly-prefix")}{" "}
                {Math.round(
                  program.setting.sessionCount / program.durationWeeks
                )}
                {t("programs.weekly-suffix")}
              </span>
            )}
            {program.durationWeeks && (
              <>
                <span>·</span>
                <span>{program.durationWeeks}{t("programs.weeks-suffix")}</span>
              </>
            )}
            {program.setting?.capacityMax && (
              <>
                <span>·</span>
                <span>{t("programs.capacity", { count: program.setting.capacityMax })}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          {/* Left — Info */}
          <div className="space-y-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
                OVERVIEW
              </p>
              <h3 className="mt-2 font-display text-xl font-bold text-navy">
                {t("programs.overview")}
              </h3>
              <p className="mt-4 text-sm leading-[1.8] text-deep-ink/80">
                {program.description ?? t("programs.overview-placeholder")}
              </p>
            </div>
          </div>

          {/* Right — Enrollment card */}
          <aside>
            <div className="sticky top-24 rounded-xl border border-gold/15 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
                ENROLLMENT
              </p>
              <div className="mt-2 font-serif text-3xl text-gold">
                {formatFee(program.setting?.feeAmount ?? null)}
              </div>
              {program.durationWeeks && (
                <p className="mt-1 text-xs text-deep-ink/50">
                  {t("programs.vat-note", { weeks: program.durationWeeks })}
                </p>
              )}

              <div className="mt-5 rounded-lg bg-cream p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-deep-ink/50">
                  REFUND POLICY
                </p>
                <div className="mt-2 space-y-1 text-xs leading-relaxed text-deep-ink/70">
                  <p className="font-semibold">{t("programs.refund-policy-title")}</p>
                  <p>{t("programs.refund-tier-1")}</p>
                  <p>{t("programs.refund-tier-2")}</p>
                  <p>{t("programs.refund-tier-3")}</p>
                  <p>{t("programs.refund-tier-4")}</p>
                </div>
              </div>

              <Link
                href="/contact"
                className="mt-5 flex w-full items-center justify-center rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-navy transition-colors hover:bg-gold/90"
              >
                {t("programs.cta-book-consult")}
              </Link>
              <Link
                href="/map-test"
                className="mt-2 flex w-full items-center justify-center rounded-lg border border-navy/20 px-4 py-2.5 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
              >
                {t("programs.cta-map-diagnosis")}
              </Link>
            </div>
          </aside>
        </div>

        <div className="mt-10 border-t border-gold/10 pt-6">
          <Link
            href="/programs"
            className="text-sm text-navy hover:text-gold transition-colors"
          >
            {t("programs.back-to-list-full")}
          </Link>
        </div>
      </section>
    </>
  );
}
