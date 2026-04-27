'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAdminPosts, useCreateAdminPost } from '@/hooks/use-admin-posts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Newspaper } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u3131-\uD79D]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export default function AdminPostsPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: posts = [], isLoading } = useAdminPosts({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('posts.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('posts.new')}
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('posts.new')}</DialogTitle>
            </DialogHeader>
            <CreatePostForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(!v || v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('posts.filter.status-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('posts.filter.all')}</SelectItem>
            <SelectItem value="DRAFT">{t('posts.status.DRAFT')}</SelectItem>
            <SelectItem value="PUBLISHED">{t('posts.status.PUBLISHED')}</SelectItem>
            <SelectItem value="ARCHIVED">{t('posts.status.ARCHIVED')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(!v || v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('posts.filter.category-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('posts.filter.all')}</SelectItem>
            <SelectItem value="NOTICE">{t('posts.category.NOTICE')}</SelectItem>
            <SelectItem value="EVENT">{t('posts.category.EVENT')}</SelectItem>
            <SelectItem value="RESULT">{t('posts.category.RESULT')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('posts.loading')}</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t('posts.empty')}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">{t('posts.table.id')}</TableHead>
                <TableHead>{t('posts.table.title')}</TableHead>
                <TableHead className="w-[120px]">{t('posts.table.category')}</TableHead>
                <TableHead className="w-[120px]">{t('posts.table.status')}</TableHead>
                <TableHead className="w-[160px]">{t('posts.table.published-at')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{p.id}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/posts/${p.id}`}
                      className="font-medium text-[#0E1E3A] hover:text-[#C9A656] hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">/{p.slug}</div>
                  </TableCell>
                  <TableCell>{t(`posts.category.${p.category}`, { defaultValue: p.category })}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'}>
                      {t(`posts.status.${p.status}`, { defaultValue: p.status })}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ──────── Create Post Form ──────── */
function CreatePostForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createPost = useCreateAdminPost();
  const [form, setForm] = useState({
    title: '',
    slug: '',
    category: 'NOTICE',
    bodyMd: '',
    coverImageUrl: '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setForm((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugify(title),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createPost.mutateAsync({
        title: form.title,
        slug: form.slug,
        bodyMd: form.bodyMd,
        category: form.category,
        coverImageUrl: form.coverImageUrl || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('posts.form.error-generic'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">{t('posts.form.title')}</Label>
        <Input id="title" value={form.title} onChange={handleTitleChange} required />
      </div>

      <div>
        <Label htmlFor="slug">{t('posts.form.slug')}</Label>
        <Input
          id="slug"
          value={form.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setForm({ ...form, slug: e.target.value });
          }}
          placeholder="2026-admission-results"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">{t('posts.form.slug-hint')}</p>
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
          placeholder="https://..."
        />
      </div>

      <div>
        <Label htmlFor="bodyMd">{t('posts.form.body')}</Label>
        <Textarea
          id="bodyMd"
          value={form.bodyMd}
          onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
          rows={10}
          required
          placeholder={t('posts.form.body-placeholder')}
        />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createPost.isPending}>
          {createPost.isPending ? t('posts.form.submitting') : t('posts.form.submit')}
        </Button>
      </div>
    </form>
  );
}
