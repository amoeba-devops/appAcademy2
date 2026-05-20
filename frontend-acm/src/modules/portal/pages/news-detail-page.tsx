import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { portalApi } from '../api/portal-api';
import { NEWS_CATEGORY_LABEL_KEYS, NEWS_CATEGORY_COLORS } from '../types';

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation('portal');

  const formatDate = (dateStr: string | null): string =>
    dateStr
      ? new Date(dateStr).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

  const { data: post, isLoading } = useQuery({
    queryKey: ['portal', 'news-detail', slug],
    queryFn: () => portalApi.newsDetail(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <div className="h-12 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-32 text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          {t('news.not-found-title', { defaultValue: 'Not found' })}
        </h2>
        <Link
          to="/news"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          {t('news.back-to-list', { defaultValue: '← Back' })}
        </Link>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        to="/news"
        className="text-sm text-slate-500 transition-colors hover:text-blue-700"
      >
        {t('news.back-link', { defaultValue: '← News' })}
      </Link>

      <div className="mt-6">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            NEWS_CATEGORY_COLORS[post.category] ?? 'bg-slate-100 text-slate-700'
          }`}
        >
          {NEWS_CATEGORY_LABEL_KEYS[post.category]
            ? t(NEWS_CATEGORY_LABEL_KEYS[post.category], { defaultValue: post.category })
            : post.category}
        </span>
        <p className="mt-2 text-sm text-slate-500">
          {formatDate(post.publishedAt ?? post.createdAt)}
        </p>
      </div>

      <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{post.title}</h1>

      <div className="prose mt-8 max-w-none text-slate-700">
        {post.bodyMd?.split('\n').map((line, i) => {
          if (line.startsWith('# '))
            return (
              <h2 key={i} className="mt-8 text-2xl font-bold text-slate-900">
                {line.slice(2)}
              </h2>
            );
          if (line.startsWith('## '))
            return (
              <h3 key={i} className="mt-6 text-xl font-bold text-slate-900">
                {line.slice(3)}
              </h3>
            );
          if (line.trim() === '') return <br key={i} />;
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
