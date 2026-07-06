import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { portalApi } from '../api/portal-api';

export function PortalNoticesPage() {
  const { t, i18n } = useTranslation('common');
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['portal-notices'],
    queryFn: portalApi.notices,
  });

  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">{t('portalApp.nav.notices')}</h1>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : notices.length === 0 ? (
        <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
          {t('portalApp.notices.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
          {notices.map((n) => (
            <li key={n.slug}>
              <Link
                to={`/portal/notices/${n.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--gray-50)]"
              >
                <span className="min-w-0 truncate text-sm text-primary">📌 {n.title}</span>
                <span className="shrink-0 text-xs text-secondary">
                  {n.publishedAt
                    ? new Date(n.publishedAt).toLocaleDateString(i18n.language)
                    : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PortalNoticeDetailPage() {
  const { t, i18n } = useTranslation('common');
  const { slug } = useParams<{ slug: string }>();
  const { data: notice, isLoading } = useQuery({
    enabled: !!slug,
    queryKey: ['portal-notice', slug],
    queryFn: () => portalApi.notice(slug!),
  });

  return (
    <div>
      <Link
        to="/portal/notices"
        className="mb-3 inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
      >
        <ChevronLeft size={12} /> {t('portalApp.notices.back')}
      </Link>
      {isLoading || !notice ? (
        <p className="py-6 text-center text-sm text-secondary">…</p>
      ) : (
        <article className="rounded-md border border-[var(--border-subtle)] p-5">
          <h1 className="text-lg font-semibold text-primary">{notice.title}</h1>
          <p className="mt-1 text-xs text-secondary">
            {notice.publishedAt
              ? new Date(notice.publishedAt).toLocaleDateString(i18n.language)
              : ''}
          </p>
          <div className="mt-4 whitespace-pre-wrap text-sm text-primary">
            {notice.bodyMd ?? ''}
          </div>
        </article>
      )}
    </div>
  );
}
