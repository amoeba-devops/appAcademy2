'use client';

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Program } from "@/types/program";

const CATEGORY_VALUES = ["", "ENGLISH", "MATH", "SCIENCE", "OTHER"] as const;

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Basic",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: "bg-gold/20 text-gold",
  INTERMEDIATE: "bg-navy/10 text-navy",
  ADVANCED: "bg-ama-accent/10 text-ama-accent",
};

function gradeRange(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  if (min && max) return `G${min}–G${max}`;
  if (min) return `G${min}+`;
  return `~G${max}`;
}

export default function ProgramsPage() {
  const [category, setCategory] = useState("");
  const { t } = useTranslation("portal");

  const formatFee = (amount: string | null): string => {
    if (!amount) return t("programs.fee-inquiry");
    const n = Number(amount);
    return isNaN(n) ? amount : `₩${n.toLocaleString()}`;
  };

  const categoryLabel = (key: string) =>
    key === "" ? t("programs.category-all") : t(`programs.category.${key}`, { defaultValue: key });

  const { data: programs = [], isLoading } = useQuery<Program[]>({
    queryKey: ["portal-programs", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const qs = params.toString();
      const res = await fetch(`/api/portal/programs${qs ? `?${qs}` : ""}`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? json;
    },
  });

  return (
    <>
      {/* Header */}
      <section className="border-b border-gold/10 bg-cream px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">
                CURRICULUM
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-navy sm:text-4xl">
                {t("programs.find-title")}
              </h1>
            </div>
            <div className="flex gap-2">
              {CATEGORY_VALUES.map((value) => (
                <button
                  key={value}
                  onClick={() => setCategory(value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    category === value
                      ? "bg-navy text-cream"
                      : "bg-navy/5 text-navy hover:bg-navy/10"
                  }`}
                >
                  {categoryLabel(value)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl bg-navy/5"
              />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <div className="py-20 text-center text-deep-ink/50">
            <p className="text-lg">{t("programs.empty-title")}</p>
            <p className="mt-1 text-sm">{t("programs.empty-hint")}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <Link
                key={prog.id}
                href={`/programs/${prog.id}`}
                className="group overflow-hidden rounded-xl border border-gold/10 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Thumbnail band */}
                <div
                  className={`flex h-28 items-center justify-center ${
                    prog.category === "MATH"
                      ? "bg-gradient-to-br from-ama-accent/80 to-ama-accent"
                      : "bg-gradient-to-br from-navy to-navy-500"
                  } px-4 text-cream`}
                >
                  <span className="text-sm font-medium tracking-wider">
                    {categoryLabel(prog.category)}
                    {prog.targetAgeMin || prog.targetAgeMax
                      ? ` · ${gradeRange(prog.targetAgeMin, prog.targetAgeMax)}`
                      : ""}
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between">
                    {prog.level && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                          LEVEL_COLORS[prog.level] ?? "bg-navy/5 text-navy"
                        }`}
                      >
                        {LEVEL_LABELS[prog.level] ?? prog.level}
                      </span>
                    )}
                    {prog.durationWeeks && prog.setting?.sessionCount && (
                      <span className="text-xs text-deep-ink/50">
                        {t("programs.weekly-per-duration", {
                          perWeek: Math.round(prog.setting.sessionCount / prog.durationWeeks),
                          weeks: prog.durationWeeks,
                        })}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-lg font-semibold text-navy group-hover:text-gold transition-colors">
                    {prog.name}
                  </h3>

                  {prog.description && (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-deep-ink/60">
                      {prog.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-serif text-xl text-gold">
                      {formatFee(prog.setting?.feeAmount ?? null)}
                    </span>
                    <span className="text-xs font-medium text-navy group-hover:text-gold transition-colors">
                      {t("programs.detail-link")}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
