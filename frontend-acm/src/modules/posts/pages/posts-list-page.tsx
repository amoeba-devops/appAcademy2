import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePosts } from '../hooks/use-posts';
import type { Post } from '../types';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'RESULT', label: 'Result' },
  { value: 'EVENT', label: 'Event' },
  { value: 'NOTICE', label: 'Notice' },
] as const;

export function PostsListPage() {
  const { t, i18n } = useTranslation('admin');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const { data: posts = [], isLoading } = usePosts({
    status: status || undefined,
    category: category || undefined,
  });

  const formatDate = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '-';

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            {t('posts.title', 'News & Posts')}
          </h1>
          <p className="text-secondary max-w-2xl">
            {t(
              'posts.description',
              'Manage academy news, announcements, and portal posts from this page.',
            )}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/admin/posts/new')}>
          {t('actions.create', 'Create Post')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-surface p-4">
          <div className="text-sm font-semibold text-primary">
            {t('filters.title', 'Filters')}
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-secondary">
              {t('posts.filter.status', 'Status')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm"
            >
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`posts.status.${item.value || 'all'}`, item.label)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm text-secondary">
              {t('posts.filter.category', 'Category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`posts.category.${item.value || 'all'}`, item.label)}
                </option>
              ))}
            </select>
          </div>
        </aside>

        <section className="rounded-3xl border border-[var(--border-subtle)] bg-surface p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">
              {t('posts.listSummary', {
                defaultValue: `${posts.length} posts found`,
                count: posts.length,
              })}
            </p>
          </div>

          {isLoading ? (
            <p className="text-secondary">{t('common:status.loading', 'Loading posts...')}</p>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center text-secondary">
              {t('posts.empty', 'No posts found for the selected filters.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--gray-100)] text-secondary">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">{t('posts.table.title', 'Title')}</th>
                    <th className="px-4 py-3">{t('posts.table.category', 'Category')}</th>
                    <th className="px-4 py-3">{t('posts.table.status', 'Status')}</th>
                    <th className="px-4 py-3">{t('posts.table.publishedAt', 'Published')}</th>
                    <th className="px-4 py-3">{t('posts.table.createdAt', 'Created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post: Post) => (
                    <tr
                      key={post.id}
                      className="border-t border-[var(--border-subtle)] hover:bg-[var(--gray-50)] cursor-pointer"
                      onClick={() => navigate(`/admin/posts/${post.id}`)}
                    >
                      <td className="px-4 py-3 text-secondary">{post.id}</td>
                      <td className="px-4 py-3 font-medium">{post.title}</td>
                      <td className="px-4 py-3 text-secondary">{post.category}</td>
                      <td className="px-4 py-3 text-secondary">{post.status}</td>
                      <td className="px-4 py-3 text-secondary">{formatDate(post.publishedAt)}</td>
                      <td className="px-4 py-3 text-secondary">{formatDate(post.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
