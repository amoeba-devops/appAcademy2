import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { portalApi } from '../api/portal-api';
import { NEWS_CATEGORY_LABEL_KEYS, NEWS_CATEGORY_COLORS } from '../types';

const CATEGORY_FILTER_KEYS = [
  { value: '', key: 'news.filter.all' },
  { value: 'RESULT', key: 'news.filter.result' },
  { value: 'EVENT', key: 'news.filter.event' },
  { value: 'NOTICE', key: 'news.filter.notice' },
] as const;

const GRADIENT_BY_CATEGORY: Record<string, string> = {
  RESULT: 'from-slate-800 to-slate-900',
  EVENT: 'from-yellow-500 to-amber-600',
  NOTICE: 'from-blue-600 to-blue-800',
};

export function NewsListPage() {
  const [category, setCategory] = useState<string>('');
  const { t, i18n } = useTranslation('portal');

  const formatDate = (dateStr: string | null): string =>
    dateStr
      ? new Date(dateStr).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '';

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['portal', 'news', category],
    queryFn: () => portalApi.news(category || undefined),
  });

  return (
    <>
      {/* Header */}
      <section className="border-b border-slate-200 bg-slate-50 px-4 pb-8 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
                NEWS &amp; EVENTS
              </p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                {t('news.title')}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTER_KEYS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setCategory(f.value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    category === f.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t(f.key, { defaultValue: f.value || 'All' })}
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
              <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <p className="text-lg">{t('news.empty-section', { defaultValue: t('news.empty') })}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/news/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`h-40 bg-gradient-to-br ${
                    GRADIENT_BY_CATEGORY[post.category] ?? 'from-slate-700 to-slate-900'
                  }`}
                />
                <div className="p-5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      NEWS_CATEGORY_COLORS[post.category] ?? 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {NEWS_CATEGORY_LABEL_KEYS[post.category]
                      ? t(NEWS_CATEGORY_LABEL_KEYS[post.category], {
                          defaultValue: post.category,
                        })
                      : post.category}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-700">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                    {post.bodyMd?.replace(/[#*_[\]]/g, '').slice(0, 100)}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">
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
