import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePost } from '../hooks/use-post';
import { useCreatePost, useDeletePost, useUpdatePost } from '../hooks/use-post-mutations';
import type { CreatePostPayload, UpdatePostPayload } from '../types';

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'NOTICE', label: 'Notice' },
  { value: 'EVENT', label: 'Event' },
  { value: 'RESULT', label: 'Result' },
] as const;

export function PostEditorPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const postId = id || undefined;
  const isNew = !postId;

  const postQuery = usePost(postId);
  const createPost = useCreatePost();
  const updatePost = useUpdatePost(postId);
  const deletePost = useDeletePost(postId);

  type PostFormState = CreatePostPayload & {
    coverImageUrl: string;
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
    publishedAt: string;
  };

  const [form, setForm] = useState<PostFormState>({
    title: '',
    slug: '',
    bodyMd: '',
    coverImageUrl: '',
    category: 'NOTICE',
    status: 'DRAFT',
    publishedAt: '',
  });

  useEffect(() => {
    if (!postQuery.data || isNew) return;
    const normalizedStatus =
      postQuery.data.status === 'DRAFT' ||
      postQuery.data.status === 'PUBLISHED' ||
      postQuery.data.status === 'ARCHIVED'
        ? postQuery.data.status
        : 'DRAFT';

    setForm({
      title: postQuery.data.title,
      slug: postQuery.data.slug,
      bodyMd: postQuery.data.bodyMd ?? '',
      coverImageUrl: postQuery.data.coverImageUrl ?? '',
      category: postQuery.data.category ?? 'NOTICE',
      status: normalizedStatus,
      publishedAt: postQuery.data.publishedAt ? new Date(postQuery.data.publishedAt).toISOString().slice(0, 16) : '',
    });
  }, [postQuery.data, isNew]);

  const statusLabel = useMemo(
    () => (isNew ? 'Create post' : `Edit post #${postId}`),
    [isNew, postId],
  );

  const isBusy = createPost.isPending || updatePost.isPending || deletePost.isPending;

  const handleChange =
    (key: keyof PostFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (isNew) {
        const payload: CreatePostPayload = {
          title: form.title.trim(),
          slug: form.slug.trim(),
          bodyMd: form.bodyMd.trim(),
          coverImageUrl: form.coverImageUrl.trim() || undefined,
          category: form.category || 'NOTICE',
        };
        const created = await createPost.mutateAsync(payload);
        toast.success(t('posts.editor.created', 'Post created successfully.'));
        navigate(`/admin/posts/${created.id}`);
      } else {
        const payload: UpdatePostPayload = {
          title: form.title.trim(),
          slug: form.slug.trim(),
          bodyMd: form.bodyMd.trim(),
          coverImageUrl: form.coverImageUrl.trim() || undefined,
          category: form.category || 'NOTICE',
          status: form.status,
          publishedAt: form.publishedAt || null,
        };
        await updatePost.mutateAsync(payload);
        toast.success(t('posts.editor.updated', 'Post updated successfully.'));
      }
    } catch (error) {
      toast.error((error as Error).message || t('toast.error', 'Something went wrong.'));
    }
  };

  const handleDelete = async () => {
    if (!postId) return;
    if (!window.confirm(t('posts.editor.deleteConfirm', 'Delete this post? This action cannot be undone.'))) {
      return;
    }
    try {
      await deletePost.mutateAsync();
      toast.success(t('posts.editor.deleted', 'Post deleted.'));
      navigate('/admin/posts');
    } catch (error) {
      toast.error((error as Error).message || t('toast.error', 'Something went wrong.'));
    }
  };

  if (postQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary animate-pulse">
        {t('posts.editor.loading', 'Loading...')}
      </div>
    );
  }

  if (postQuery.isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
        {t('posts.editor.fetchError', 'Failed to load post.')} {String((postQuery.error as Error)?.message)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('posts.editor.title', statusLabel)}</h1>
          <p className="text-secondary text-sm">
            {t(
              isNew ? 'posts.editor.createLead' : 'posts.editor.editLead',
              isNew
                ? 'Create a news post for the portal and manage its publication status.'
                : 'Edit the post content, category, and publication settings.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && (
            <Button variant="outline" onClick={handleDelete} disabled={isBusy}>
              {t('actions.delete', 'Delete')}
            </Button>
          )}
          <Button type="submit" form="post-editor-form" disabled={isBusy}>
            {isNew ? t('actions.create', 'Create Post') : t('actions.save', 'Save Changes')}
          </Button>
        </div>
      </div>

      <form id="post-editor-form" className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-[1.5fr_0.8fr]">
          <div className="space-y-6 rounded-3xl border border-[var(--border-subtle)] bg-surface p-6 shadow-sm">
            <div className="space-y-3">
              <Label htmlFor="title">{t('posts.editor.field.title', 'Title')}</Label>
              <input
                id="title"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                value={form.title}
                onChange={handleChange('title')}
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="slug">{t('posts.editor.field.slug', 'URL slug')}</Label>
              <input
                id="slug"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                value={form.slug}
                onChange={handleChange('slug')}
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="coverImageUrl">{t('posts.editor.field.coverImageUrl', 'Cover image URL')}</Label>
              <input
                id="coverImageUrl"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                value={form.coverImageUrl}
                onChange={handleChange('coverImageUrl')}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="bodyMd">{t('posts.editor.field.bodyMd', 'Body (Markdown)')}</Label>
              <textarea
                id="bodyMd"
                rows={12}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                value={form.bodyMd}
                onChange={handleChange('bodyMd')}
                required
              />
            </div>
          </div>

          <div className="space-y-6 rounded-3xl border border-[var(--border-subtle)] bg-surface p-6 shadow-sm">
            <div className="space-y-3">
              <Label htmlFor="category">{t('posts.editor.field.category', 'Category')}</Label>
              <select
                id="category"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                value={form.category}
                onChange={handleChange('category')}
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {!isNew && (
              <div className="space-y-3">
                <Label htmlFor="status">{t('posts.editor.field.status', 'Status')}</Label>
                <select
                  id="status"
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                  value={form.status}
                  onChange={handleChange('status')}
                >
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isNew && (
              <div className="space-y-3">
                <Label htmlFor="publishedAt">{t('posts.editor.field.publishedAt', 'Published At')}</Label>
                <input
                  id="publishedAt"
                  type="datetime-local"
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700"
                  value={form.publishedAt}
                  onChange={handleChange('publishedAt')}
                />
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--gray-50)] p-4 text-sm text-secondary">
              <p>{t('posts.editor.sideNote', 'Published posts become visible in the public portal news feed.')}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
