import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { usePost } from '../hooks/use-post';
import { useCreatePost, useDeletePost, useUpdatePost } from '../hooks/use-post-mutations';
import type { CreatePostPayload, UpdatePostPayload } from '../types';
import { isValidSlug, slugFromTitle, slugify } from '../lib/slugify';

const STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
const CATEGORY_VALUES = ['NOTICE', 'EVENT', 'RESULT'] as const;

/** 서버 메시지(class-validator 배열/문자열)를 사용자 노출용으로 추출. */
function extractApiMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { message?: unknown; code?: string } } })
    ?.response?.data;
  if (!data) return null;
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.message === 'string') return data.message;
  if (typeof data.code === 'string') return data.code;
  return null;
}

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
  // PLN-260728D — slug 를 사용자가 직접 수정했는지(자동생성 중지 플래그).
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!postQuery.data || isNew) return;
    setSlugTouched(true); // 기존 글의 slug 는 유지(제목 편집이 덮어쓰지 않음).
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

  const isBusy = createPost.isPending || updatePost.isPending || deletePost.isPending;

  const handleChange =
    (key: keyof PostFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  // PLN-260728D — 제목 입력 시 slug 자동생성(사용자가 slug 를 직접 수정하기 전까지).
  const handleTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const title = event.target.value;
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  };

  const handleSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug: event.target.value }));
  };

  // 입력을 벗어날 때 slug 를 서버 규칙에 맞게 정규화.
  const handleSlugBlur = () => {
    setForm((prev) => ({ ...prev, slug: slugify(prev.slug) }));
  };

  const slugInvalid = form.slug.trim().length > 0 && !isValidSlug(form.slug.trim());

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // PLN-260728D — slug 자동보정: 비었으면 제목으로 생성(한글 전용이면 fallback).
    const effectiveSlug = form.slug.trim() || slugFromTitle(form.title, new Date());
    if (!isValidSlug(effectiveSlug)) {
      toast.error(t('posts.editor.slugInvalid'));
      return;
    }
    const cover = form.coverImageUrl.trim();
    if (cover && !/^https?:\/\/.+/i.test(cover)) {
      toast.error(t('posts.editor.coverInvalid'));
      return;
    }

    try {
      if (isNew) {
        const payload: CreatePostPayload = {
          title: form.title.trim(),
          slug: effectiveSlug,
          bodyMd: form.bodyMd.trim(),
          coverImageUrl: cover || undefined,
          category: form.category || 'NOTICE',
        };
        const created = await createPost.mutateAsync(payload);
        toast.success(t('posts.editor.created', 'Post created successfully.'));
        navigate(`/admin/posts/${created.id}`);
      } else {
        const payload: UpdatePostPayload = {
          title: form.title.trim(),
          slug: effectiveSlug,
          bodyMd: form.bodyMd.trim(),
          coverImageUrl: cover || undefined,
          category: form.category || 'NOTICE',
          status: form.status,
          publishedAt: form.publishedAt || null,
        };
        await updatePost.mutateAsync(payload);
        toast.success(t('posts.editor.updated', 'Post updated successfully.'));
      }
    } catch (error) {
      // 서버 검증 메시지(있으면)를 노출해 원인 파악을 돕는다.
      toast.error(extractApiMessage(error) ?? t('toast.error', 'Something went wrong.'));
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
          <h1 className="text-2xl font-semibold text-primary">
            {isNew ? t('posts.editor.createTitle') : t('posts.editor.editTitle')}
          </h1>
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
                onChange={handleTitleChange}
                required
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="slug">{t('posts.editor.field.slug', 'URL slug')}</Label>
              <input
                id="slug"
                className={`w-full rounded-md border bg-canvas px-3 py-2 text-sm text-primary outline-none focus:border-accent-700 ${
                  slugInvalid ? 'border-red-300' : 'border-[var(--border-subtle)]'
                }`}
                value={form.slug}
                onChange={handleSlugChange}
                onBlur={handleSlugBlur}
                placeholder="notice-2026-07"
              />
              <p className={`text-xs ${slugInvalid ? 'text-red-600' : 'text-secondary'}`}>
                {slugInvalid
                  ? t('posts.editor.slugInvalid')
                  : t('posts.editor.slugHint')}
              </p>
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
                {CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`posts.category.${value}`)}
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
                  {STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {t(`posts.status.${value}`)}
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
