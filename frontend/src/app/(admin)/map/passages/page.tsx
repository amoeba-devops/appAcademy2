'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookPlus, Image as ImageIcon, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePassage, usePassages, useUpdatePassage } from '@/hooks/use-map';
import type { CreatePassageRequest, MapPassage } from '@/types/map';

export default function MapPassagesPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [domainFilter, setDomainFilter] = useState('ALL');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editingPassage, setEditingPassage] = useState<MapPassage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      domain: domainFilter === 'ALL' ? undefined : domainFilter,
      gradeLevel: gradeFilter === 'ALL' ? undefined : gradeFilter,
      search: search || undefined,
    }),
    [domainFilter, gradeFilter, search, statusFilter],
  );

  const { data: passages = [], isLoading } = usePassages(filters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('passages.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('passages.lead')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={() => setEditingPassage(null)}
          >
            <BookPlus className="h-4 w-4" />
            {t('passages.add')}
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingPassage ? t('passages.dialog-edit-title') : t('passages.dialog-add-title')}</DialogTitle>
            </DialogHeader>
            <PassageForm
              initialValue={editingPassage}
              onSuccess={() => {
                setDialogOpen(false);
                setEditingPassage(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('passages.filter.status-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.filter-status-all')}</SelectItem>
            <SelectItem value="DRAFT">{t('common.status.DRAFT')}</SelectItem>
            <SelectItem value="REVIEW">{t('common.status.REVIEW')}</SelectItem>
            <SelectItem value="PUBLISHED">{t('common.status.PUBLISHED')}</SelectItem>
            <SelectItem value="ARCHIVED">{t('common.status.ARCHIVED')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={domainFilter} onValueChange={(value) => value && setDomainFilter(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('passages.filter.domain-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.filter-domain-all')}</SelectItem>
            <SelectItem value="RC">RC</SelectItem>
            <SelectItem value="MATH">Math</SelectItem>
            <SelectItem value="LANGUAGE">Language</SelectItem>
          </SelectContent>
        </Select>

        <Select value={gradeFilter} onValueChange={(value) => value && setGradeFilter(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('passages.filter.grade-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.filter-grade-all')}</SelectItem>
            <SelectItem value="G4">G4</SelectItem>
            <SelectItem value="G5">G5</SelectItem>
            <SelectItem value="G6">G6</SelectItem>
            <SelectItem value="G7">G7</SelectItem>
            <SelectItem value="G8">G8</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <Input
            className="w-[240px]"
            placeholder={t('passages.search-placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
          />
          <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">{t('common.loading')}</div>
      ) : passages.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('passages.empty')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {passages.map((passage) => (
            <Card key={passage.id} className="border-[#C9A656]/15">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-[#0E1E3A]">{passage.title}</CardTitle>
                  <Badge variant="outline">{t(`common.status.${passage.status}`, { defaultValue: passage.status })}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{passage.domain}</span>
                  <span>·</span>
                  <span>{passage.gradeLevel}</span>
                  <span>·</span>
                  <span>{t('passages.item-count', { count: passage.itemCount })}</span>
                </div>
                <p className="line-clamp-4 min-h-[84px] text-sm text-muted-foreground">
                  {passage.body}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{passage.source || t('passages.no-source')}</span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {passage.assetUrls.length}
                  </span>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setEditingPassage(passage);
                    setDialogOpen(true);
                  }}
                >
                  {t('passages.edit')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function PassageForm({
  initialValue,
  onSuccess,
}: {
  initialValue: MapPassage | null;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('admin');
  const createPassage = useCreatePassage();
  const updatePassage = useUpdatePassage();
  const [form, setForm] = useState({
    title: initialValue?.title ?? '',
    body: initialValue?.body ?? '',
    gradeLevel: initialValue?.gradeLevel ?? 'G6',
    domain: initialValue?.domain ?? 'RC',
    source: initialValue?.source ?? '',
    status: initialValue?.status ?? 'DRAFT',
    assetUrls: initialValue?.assetUrls.join('\n') ?? '',
  });

  useEffect(() => {
    setForm({
      title: initialValue?.title ?? '',
      body: initialValue?.body ?? '',
      gradeLevel: initialValue?.gradeLevel ?? 'G6',
      domain: initialValue?.domain ?? 'RC',
      source: initialValue?.source ?? '',
      status: initialValue?.status ?? 'DRAFT',
      assetUrls: initialValue?.assetUrls.join('\n') ?? '',
    });
  }, [initialValue]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload: CreatePassageRequest = {
      title: form.title,
      body: form.body,
      gradeLevel: form.gradeLevel,
      domain: form.domain,
      source: form.source || undefined,
      status: form.status,
      assetUrls: splitMultiline(form.assetUrls),
    };

    if (initialValue) {
      await updatePassage.mutateAsync({ id: initialValue.id, data: payload });
    } else {
      await createPassage.mutateAsync(payload);
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">{t('passages.form.title')}</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <Label htmlFor="gradeLevel">{t('passages.form.grade')}</Label>
          <Select
            value={form.gradeLevel}
            onValueChange={(value) => value && setForm({ ...form, gradeLevel: value })}
          >
            <SelectTrigger id="gradeLevel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="G4">G4</SelectItem>
              <SelectItem value="G5">G5</SelectItem>
              <SelectItem value="G6">G6</SelectItem>
              <SelectItem value="G7">G7</SelectItem>
              <SelectItem value="G8">G8</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="domain">{t('passages.form.domain')}</Label>
          <Select
            value={form.domain}
            onValueChange={(value) => value && setForm({ ...form, domain: value })}
          >
            <SelectTrigger id="domain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RC">RC</SelectItem>
              <SelectItem value="MATH">Math</SelectItem>
              <SelectItem value="LANGUAGE">Language</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">{t('passages.form.status')}</Label>
          <Select
            value={form.status}
            onValueChange={(value) => value && setForm({ ...form, status: value })}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">{t('common.status.DRAFT')}</SelectItem>
              <SelectItem value="REVIEW">{t('common.status.REVIEW')}</SelectItem>
              <SelectItem value="PUBLISHED">{t('common.status.PUBLISHED')}</SelectItem>
              <SelectItem value="ARCHIVED">{t('common.status.ARCHIVED')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="source">{t('passages.form.source')}</Label>
          <Input
            id="source"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder={t('passages.form.source-placeholder')}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="body">{t('passages.form.body')}</Label>
        <Textarea
          id="body"
          className="min-h-[220px]"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="assets">{t('passages.form.assets')}</Label>
        <Textarea
          id="assets"
          className="min-h-[100px]"
          value={form.assetUrls}
          onChange={(e) => setForm({ ...form, assetUrls: e.target.value })}
          placeholder={t('passages.form.assets-placeholder')}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createPassage.isPending || updatePassage.isPending}>
          {initialValue ? t('passages.form.submit-edit') : t('passages.form.submit-create')}
        </Button>
      </div>
    </form>
  );
}

function splitMultiline(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
