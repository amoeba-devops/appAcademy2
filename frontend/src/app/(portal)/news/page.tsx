'use client';

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { NewsPost } from "@/types/news";
import { NEWS_CATEGORY_LABEL_KEYS, NEWS_CATEGORY_COLORS } from "@/types/news";

const CATEGORY_FILTER_KEYS = [
  { value: "", key: "news.filter.all" },
  { value: "RESULT", key: "news.filter.result" },
  { value: "EVENT", key: "news.filter.event" },
  { value: "NOTICE", key: "news.filter.notice" },
] as const;

const GRADIENT_BY_CATEGORY: Record<string, string> = {
  RESULT: "from-navy to-navy-500",
  EVENT: "from-gold/80 to-gold",
  NOTICE: "from-ama-accent/80 to-ama-accent",
};

export default function NewsPage() {
  const [category, setCategory] = useState("");
  const { t, i18n } = useTranslation("portal");

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(i18n.resolvedLanguage ?? "ko", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const { data: posts = [], isLoading } = useQuery<NewsPost[]>({
    queryKey: ["portal-news", category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      const qs = params.toString();
      const res = await fetch(`/api/portal/news${qs ? `?${qs}` : ""}`);
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
                NEWS &amp; EVENTS
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-navy sm:text-4xl">
                {t("news.title")}
              </h1>
            </div>
            <div className="flex gap-2">
              {CATEGORY_FILTER_KEYS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setCategory(f.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    category === f.value
                      ? "bg-navy text-cream"
                      : "bg-navy/5 text-navy hover:bg-navy/10"
                  }`}
                >
                  {t(f.key)}
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
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl bg-navy/5"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center text-deep-ink/50">
            <p className="text-lg">{t("news.empty-section")}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-gold/10 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Cover */}
                <div
                  className={`h-40 bg-gradient-to-br ${
                    GRADIENT_BY_CATEGORY[post.category] ?? "from-navy to-navy-500"
                  }`}
                />
                <div className="p-5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      NEWS_CATEGORY_COLORS[post.category] ?? "bg-navy/5 text-navy"
                    }`}
                  >
                    {NEWS_CATEGORY_LABEL_KEYS[post.category] ? t(NEWS_CATEGORY_LABEL_KEYS[post.category]) : post.category}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-navy group-hover:text-gold transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-deep-ink/60">
                    {post.bodyMd.replace(/[#*_\[\]]/g, "").slice(0, 100)}
                  </p>
                  <p className="mt-3 text-xs text-deep-ink/40">
                    {formatDate(post.publishedAt ?? post.createdAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
