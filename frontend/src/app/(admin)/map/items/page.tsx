'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileQuestion, Search } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateItem, useItems, usePassages, useUpdateItem } from '@/hooks/use-map';
import type { CreateItemRequest, MapItem, MapPassage } from '@/types/map';

export default function MapItemsPage() {
  const { t } = useTranslation('admin');
  const { data: passages = [] } = usePassages({ status: 'PUBLISHED' });
  const [selectedPassageId, setSelectedPassageId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('PART_A');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MapItem | null>(null);

  useEffect(() => {
    if (!selectedPassageId && passages.length > 0) {
      setSelectedPassageId(passages[0].id);
    }
  }, [passages, selectedPassageId]);

  const selectedPassage = passages.find((passage) => passage.id === selectedPassageId) ?? null;

  const itemFilters = useMemo(
    () => ({
      passageId: selectedPassageId,
      itemType: activeTab,
      search: search || undefined,
    }),
    [activeTab, search, selectedPassageId],
  );

  const { data: items = [], isLoading } = useItems(itemFilters);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('items.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('items.lead')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={() => setEditingItem(null)}
          >
            <FileQuestion className="h-4 w-4" />
            {t('items.add')}
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? t('items.dialog-edit-title') : t('items.dialog-add-title')}</DialogTitle>
            </DialogHeader>
            <ItemForm
              initialValue={editingItem}
              selectedPassage={selectedPassage}
              activeTab={activeTab}
              onSuccess={() => {
                setDialogOpen(false);
                setEditingItem(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit border-[#C9A656]/15">
          <CardHeader>
            <CardTitle className="text-[#0E1E3A]">{t('items.passage-card-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="passage">{t('items.passage-select')}</Label>
              <Select
                value={selectedPassageId ? String(selectedPassageId) : undefined}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedPassageId(Number(value));
                  }
                }}
              >
                <SelectTrigger id="passage">
                  <SelectValue placeholder={t('items.passage-select-placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {passages.map((passage) => (
                    <SelectItem key={passage.id} value={String(passage.id)}>
                      {passage.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPassage ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedPassage.domain}</Badge>
                  <Badge variant="outline">{selectedPassage.gradeLevel}</Badge>
                  <Badge variant="secondary">{t('items.passage-item-count', { count: selectedPassage.itemCount })}</Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="font-medium text-[#0E1E3A]">{selectedPassage.title}</div>
                  <p className="max-h-[380px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {selectedPassage.body}
                  </p>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {t('items.no-passages')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#C9A656]/15">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-[#0E1E3A]">{t('items.list-title')}</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  className="w-[220px]"
                  placeholder={t('items.search-placeholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                />
                <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="PART_A">Part A</TabsTrigger>
                <TabsTrigger value="PART_B">Part B</TabsTrigger>
              </TabsList>
              <TabsContent value="PART_A" className="mt-4">
                <ItemList
                  items={items}
                  isLoading={isLoading}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setDialogOpen(true);
                  }}
                />
              </TabsContent>
              <TabsContent value="PART_B" className="mt-4">
                <ItemList
                  items={items}
                  isLoading={isLoading}
                  onEdit={(item) => {
                    setEditingItem(item);
                    setDialogOpen(true);
                  }}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ItemList({
  items,
  isLoading,
  onEdit,
}: {
  items: MapItem[];
  isLoading: boolean;
  onEdit: (item: MapItem) => void;
}) {
  const { t } = useTranslation('admin');
  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
        {t('items.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{item.gradeLevel}</Badge>
                <Badge variant="outline">{item.difficulty}</Badge>
                <Badge variant="secondary">{t('items.points-suffix', { points: item.points })}</Badge>
              </div>
              <p className="text-sm text-[#0E1E3A]">{item.stem}</p>
              <p className="text-xs text-muted-foreground">
                {t('items.answer-label')}: {item.answerKeys.join(', ')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
              {t('students.detail.edit')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ItemForm({
  initialValue,
  selectedPassage,
  activeTab,
  onSuccess,
}: {
  initialValue: MapItem | null;
  selectedPassage: MapPassage | null;
  activeTab: string;
  onSuccess: () => void;
}) {
  const { t } = useTranslation('admin');
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [form, setForm] = useState({
    gradeLevel: initialValue?.gradeLevel ?? selectedPassage?.gradeLevel ?? 'G6',
    domain: initialValue?.domain ?? selectedPassage?.domain ?? 'RC',
    difficulty: initialValue?.difficulty ?? 'MEDIUM',
    itemType: initialValue?.itemType ?? activeTab,
    stem: initialValue?.stem ?? '',
    options: initialValue?.options.join('\n') ?? '',
    answerKeys: initialValue?.answerKeys.join(', ') ?? '',
    explanation: initialValue?.explanation ?? '',
    points: String(initialValue?.points ?? 1),
    status: initialValue?.status ?? 'DRAFT',
    tags: initialValue?.tags.join(', ') ?? '',
  });

  useEffect(() => {
    setForm({
      gradeLevel: initialValue?.gradeLevel ?? selectedPassage?.gradeLevel ?? 'G6',
      domain: initialValue?.domain ?? selectedPassage?.domain ?? 'RC',
      difficulty: initialValue?.difficulty ?? 'MEDIUM',
      itemType: initialValue?.itemType ?? activeTab,
      stem: initialValue?.stem ?? '',
      options: initialValue?.options.join('\n') ?? '',
      answerKeys: initialValue?.answerKeys.join(', ') ?? '',
      explanation: initialValue?.explanation ?? '',
      points: String(initialValue?.points ?? 1),
      status: initialValue?.status ?? 'DRAFT',
      tags: initialValue?.tags.join(', ') ?? '',
    });
  }, [activeTab, initialValue, selectedPassage]);

  useEffect(() => {
    if (!initialValue) {
      setForm((prev) => ({
        ...prev,
        itemType: activeTab,
        gradeLevel: selectedPassage?.gradeLevel ?? prev.gradeLevel,
        domain: selectedPassage?.domain ?? prev.domain,
      }));
    }
  }, [activeTab, initialValue, selectedPassage]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload: CreateItemRequest = {
      passageId: selectedPassage?.id,
      domain: form.domain,
      gradeLevel: form.gradeLevel,
      difficulty: form.difficulty,
      itemType: form.itemType,
      stem: form.stem,
      options: splitMultiline(form.options),
      answerKeys: splitComma(form.answerKeys),
      explanation: form.explanation || undefined,
      points: Number(form.points),
      status: form.status,
      tags: splitComma(form.tags),
    };

    if (initialValue) {
      await updateItem.mutateAsync({ id: initialValue.id, data: payload });
    } else {
      await createItem.mutateAsync(payload);
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {t('items.linked-passage', { title: selectedPassage?.title ?? t('items.no-passage') })}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <Label htmlFor="gradeLevel">{t('items.form.grade')}</Label>
          <Input
            id="gradeLevel"
            value={form.gradeLevel}
            onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="domain">{t('items.form.domain')}</Label>
          <Input
            id="domain"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="difficulty">{t('items.form.difficulty')}</Label>
          <Select
            value={form.difficulty}
            onValueChange={(value) => value && setForm({ ...form, difficulty: value })}
          >
            <SelectTrigger id="difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="status">{t('items.form.status')}</Label>
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
      </div>

      <div>
        <Label htmlFor="stem">{t('items.form.stem')}</Label>
        <Textarea
          id="stem"
          className="min-h-[120px]"
          value={form.stem}
          onChange={(e) => setForm({ ...form, stem: e.target.value })}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="options">{t('items.form.options')}</Label>
          <Textarea
            id="options"
            className="min-h-[140px]"
            value={form.options}
            onChange={(e) => setForm({ ...form, options: e.target.value })}
            placeholder={t('items.form.options-placeholder')}
            required
          />
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="answerKeys">{t('items.form.answer-keys')}</Label>
            <Input
              id="answerKeys"
              value={form.answerKeys}
              onChange={(e) => setForm({ ...form, answerKeys: e.target.value })}
              placeholder={t('items.form.answer-keys-placeholder')}
              required
            />
          </div>
          <div>
            <Label htmlFor="points">{t('items.form.points')}</Label>
            <Input
              id="points"
              type="number"
              min={1}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="tags">{t('items.form.tags')}</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder={t('items.form.tags-placeholder')}
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="explanation">{t('items.form.explanation')}</Label>
        <Textarea
          id="explanation"
          className="min-h-[120px]"
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createItem.isPending || updateItem.isPending || !selectedPassage}>
          {initialValue ? t('items.form.submit-edit') : t('items.form.submit-create')}
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

function splitComma(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
