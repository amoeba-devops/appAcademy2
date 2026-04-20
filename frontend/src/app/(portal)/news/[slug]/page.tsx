'use client';

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { NewsPost } from "@/types/news";
import { NEWS_CATEGORY_LABEL_KEYS, NEWS_CATEGORY_COLORS } from "@/types/news";

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation("portal");

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(i18n.resolvedLanguage ?? "ko", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const { data: post, isLoading } = useQuery<NewsPost | null>({
    queryKey: ["portal-news-detail", slug],
    queryFn: async () => {
      const res = await fetch(`/api/portal/news/${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data ?? json;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="h-12 w-2/3 animate-pulse rounded bg-navy/5" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-navy/5" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-32 text-center">
        <h2 className="font-display text-2xl font-bold text-navy">
          {t("news.not-found-title")}
        </h2>
        <Link
          href="/news"
          className="mt-4 inline-block text-sm text-gold hover:underline"
        >
          {t("news.back-to-list")}
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        href="/news"
        className="text-sm text-navy/60 hover:text-gold transition-colors"
      >
        {t("news.back-link")}
      </Link>

      <div className="mt-6">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            NEWS_CATEGORY_COLORS[post.category] ?? "bg-navy/5 text-navy"
          }`}
        >
          {NEWS_CATEGORY_LABEL_KEYS[post.category] ? t(NEWS_CATEGORY_LABEL_KEYS[post.category]) : post.category}
        </span>
        <p className="mt-2 text-sm text-deep-ink/50">
          {formatDate(post.publishedAt ?? post.createdAt)}
        </p>
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold text-navy sm:text-4xl">
        {post.title}
      </h1>

      {/* Markdown body — rendered as plain text for now */}
      <div className="prose mt-8 max-w-none text-deep-ink/80">
        {post.bodyMd.split("\n").map((line, i) => {
          if (line.startsWith("# "))
            return (
              <h2 key={i} className="mt-8 font-display text-2xl font-bold text-navy">
                {line.slice(2)}
              </h2>
            );
          if (line.startsWith("## "))
            return (
              <h3 key={i} className="mt-6 font-display text-xl font-bold text-navy">
                {line.slice(3)}
              </h3>
            );
          if (line.trim() === "") return <br key={i} />;
          return (
            <p key={i} className="mt-3 text-sm leading-[1.8]">
              {line}
            </p>
          );
        })}
      </div>
    </article>
  );
}
