'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  useAdminPost,
  useUpdateAdminPost,
  useDeleteAdminPost,
} from '@/hooks/use-admin-posts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Trash2, Send, Archive, RotateCcw, Save } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

export default function AdminPostDetailPage() {
  const { t } = useTranslation('admin');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const { data: post, isLoading } = useAdminPost(id);
  const updatePost = useUpdateAdminPost();
  const deletePost = useDeleteAdminPost();

  const [form, setForm] = useState({
    title: '',
    slug: '',
    category: 'NOTICE',
    bodyMd: '',
    coverImageUrl: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post) {
      setForm({
        title: post.title,
        slug: post.slug,
        category: post.category,
        bodyMd: post.bodyMd,
        coverImageUrl: post.coverImageUrl ?? '',
      });
    }
  }, [post]);

  if (isLoading || !post) {
    return <div className="text-center py-8 text-muted-foreground">{t('posts.loading')}</div>;
  }

  const runUpdate = async (extra: Partial<{ status: string; publishedAt: string | null }> = {}) => {
    setError(null);
    try {
      await updatePost.mutateAsync({
        id,
        data: {
          title: form.title,
          slug: form.slug,
          category: form.category,
          bodyMd: form.bodyMd,
          coverImageUrl: form.coverImageUrl || undefined,
          ...extra,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('posts.form.error-generic'));
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('posts.confirm-delete'))) return;
    await deletePost.mutateAsync(id);
    router.push('/admin/posts');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/posts"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> {t('posts.back')}
        </Link>
        <Badge variant={STATUS_VARIANT[post.status] ?? 'secondary'}>
          {t(`posts.status.${post.status}`, { defaultValue: post.status })}
        </Badge>
      </div>

      <div>
        <Label htmlFor="title">{t('posts.form.title')}</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="slug">{t('posts.form.slug')}</Label>
        <Input
          id="slug"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="category">{t('posts.form.category')}</Label>
        <Select
          value={form.category}
          onValueChange={(v) => v && setForm({ ...form, category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NOTICE">{t('posts.category.NOTICE')}</SelectItem>
            <SelectItem value="EVENT">{t('posts.category.EVENT')}</SelectItem>
            <SelectItem value="RESULT">{t('posts.category.RESULT')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="coverImageUrl">{t('posts.form.cover-image')}</Label>
        <Input
          id="coverImageUrl"
          type="url"
          value={form.coverImageUrl}
          onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="bodyMd">{t('posts.form.body')}</Label>
        <Textarea
          id="bodyMd"
          value={form.bodyMd}
          onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
          rows={14}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        {t('posts.detail.created-at')}: {new Date(post.createdAt).toLocaleString()}
        {post.publishedAt && (
          <> · {t('posts.detail.published-at')}: {new Date(post.publishedAt).toLocaleString()}</>
        )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          onClick={() => runUpdate()}
          disabled={updatePost.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {t('posts.action.save')}
        </Button>

        {post.status === 'DRAFT' && (
          <Button
            onClick={() => runUpdate({ status: 'PUBLISHED' })}
            disabled={updatePost.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {t('posts.action.publish')}
          </Button>
        )}

        {post.status === 'PUBLISHED' && (
          <Button
            variant="outline"
            onClick={() => runUpdate({ status: 'ARCHIVED' })}
            disabled={updatePost.isPending}
          >
            <Archive className="h-4 w-4 mr-2" />
            {t('posts.action.archive')}
          </Button>
        )}

        {post.status === 'ARCHIVED' && (
          <Button
            variant="outline"
            onClick={() => runUpdate({ status: 'PUBLISHED' })}
            disabled={updatePost.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('posts.action.restore')}
          </Button>
        )}

        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={deletePost.isPending}
          className="ml-auto"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {t('posts.action.delete')}
        </Button>
      </div>
    </div>
  );
}
