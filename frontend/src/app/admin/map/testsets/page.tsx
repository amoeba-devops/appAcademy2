'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  GripVertical,
  PenSquare,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useCreateTestSet, useItems, useTestSetPreview, useTestSets, useUpdateTestSet } from '@/hooks/use-map';
import type { CreateTestSetRequest, MapItem, MapTestSetItem } from '@/types/map';

type BuilderItem = {
  itemId: number;
  ordinal: number;
  source: MapItem;
};

export default function MapTestSetsPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('PUBLISHED');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [testSetSearch, setTestSetSearch] = useState('');
  const [selectedTestSetId, setSelectedTestSetId] = useState<number | null>(null);
  const [builderName, setBuilderName] = useState('2026 Spring Formative #3');
  const [compositionMode, setCompositionMode] = useState('FIXED');
  const [builderItems, setBuilderItems] = useState<BuilderItem[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);

  const itemFilters = useMemo(
    () => ({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      gradeLevel: gradeFilter === 'ALL' ? undefined : gradeFilter,
      search: search || undefined,
    }),
    [gradeFilter, search, statusFilter],
  );

  const { data: bankItems = [], isLoading: isItemsLoading } = useItems(itemFilters);
  const { data: testSets = [] } = useTestSets({ search: testSetSearch || undefined });
  const { data: preview } = useTestSetPreview(selectedTestSetId ?? undefined);
  const createTestSet = useCreateTestSet();
  const updateTestSet = useUpdateTestSet();

  const selectedTestSet = testSets.find((testSet) => testSet.id === selectedTestSetId) ?? null;

  useEffect(() => {
    if (!selectedTestSet && testSets.length > 0 && selectedTestSetId === null) {
      setSelectedTestSetId(testSets[0].id);
    }
  }, [selectedTestSet, selectedTestSetId, testSets]);

  useEffect(() => {
    if (!selectedTestSet) {
      return;
    }

    setBuilderName(selectedTestSet.name);
    setCompositionMode(selectedTestSet.compositionMode);
    setBuilderItems(
      selectedTestSet.items
        .map((item) => {
          const source = snapshotToItem(item);
          return {
            itemId: item.itemId,
            ordinal: item.ordinal,
            source,
          };
        })
        .sort((left, right) => left.ordinal - right.ordinal),
    );
  }, [selectedTestSet]);

  const availableItems = bankItems.filter(
    (item) => !builderItems.some((selectedItem) => selectedItem.itemId === item.id),
  );

  const totalPoints = builderItems.reduce((sum, item) => sum + item.source.points, 0);
  const partACount = builderItems.filter((item) => item.source.itemType === 'PART_A').length;
  const partBCount = builderItems.filter((item) => item.source.itemType === 'PART_B').length;
  const passageCount = new Set(
    builderItems.map((item) => item.source.passageId).filter((value): value is number => typeof value === 'number'),
  ).size;

  const difficultyBreakdown = builderItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.source.difficulty] = (acc[item.source.difficulty] ?? 0) + 1;
    return acc;
  }, {});

  const saveDisabled = builderItems.length === 0 || builderName.trim().length === 0;

  const saveTestSet = async (status: string) => {
    const payload: CreateTestSetRequest = {
      name: builderName.trim(),
      compositionMode,
      status,
      filterCriteria: {
        status: statusFilter,
        gradeLevel: gradeFilter,
        search,
      },
      items: builderItems.map((item, index) => ({
        itemId: item.itemId,
        ordinal: index + 1,
      })),
    };

    if (selectedTestSetId) {
      await updateTestSet.mutateAsync({ id: selectedTestSetId, data: payload });
      return;
    }

    const response = await createTestSet.mutateAsync(payload);
    if (response.data?.id) {
      setSelectedTestSetId(response.data.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('map.testsets.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('map.testsets.lead')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedTestSetId(null);
              setBuilderName(t('map.testsets.untitled'));
              setCompositionMode('FIXED');
              setBuilderItems([]);
            }}
          >
            {t('map.testsets.new-testset')}
          </Button>
          <Button variant="outline" disabled={saveDisabled} onClick={() => saveTestSet('DRAFT')}>
            {t('map.testsets.save-draft')}
          </Button>
          <Button disabled={saveDisabled} onClick={() => saveTestSet('PUBLISHED')}>
            {t('map.testsets.save-publish')}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <Card className="border-[#C9A656]/15 xl:sticky xl:top-6 xl:h-fit">
          <CardHeader>
            <CardTitle className="text-[#0E1E3A]">{t('map.testsets.saved-list-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder={t('map.testsets.saved-list-search')}
              value={testSetSearch}
              onChange={(event) => setTestSetSearch(event.target.value)}
            />
            <div className="space-y-2">
              {testSets.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                  {t('map.testsets.saved-list-empty')}
                </div>
              ) : (
                testSets.map((testSet) => (
                  <button
                    key={testSet.id}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      testSet.id === selectedTestSetId
                        ? 'border-[#C9A656] bg-[#FAF7EE]'
                        : 'border-border hover:border-[#C9A656]/50'
                    }`}
                    onClick={() => setSelectedTestSetId(testSet.id)}
                  >
                    <div className="font-medium text-[#0E1E3A]">{testSet.name}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{testSet.status}</Badge>
                      <span>{t('map.testsets.testset-item-count', { count: testSet.itemCount })}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-[#C9A656]/15">
            <CardHeader>
              <CardTitle className="text-[#0E1E3A]">{t('map.testsets.builder-settings')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <Label htmlFor="builder-name">{t('map.testsets.builder-name-label')}</Label>
                <Input
                  id="builder-name"
                  value={builderName}
                  onChange={(event) => setBuilderName(event.target.value)}
                  placeholder="2026 Spring Formative #3"
                />
              </div>
              <div>
                <Label htmlFor="composition-mode">{t('map.testsets.composition-mode')}</Label>
                <Select value={compositionMode} onValueChange={(value) => value && setCompositionMode(value)}>
                  <SelectTrigger id="composition-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="SHUFFLED">Shuffled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="border-[#C9A656]/15">
              <CardHeader>
                <CardTitle className="text-[#0E1E3A]">{t('map.testsets.bank-title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('map.common.filter-status-all')}</SelectItem>
                      <SelectItem value="PUBLISHED">{t('map.testsets.filter-status-published')}</SelectItem>
                      <SelectItem value="DRAFT">{t('map.testsets.filter-status-draft')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={gradeFilter} onValueChange={(value) => value && setGradeFilter(value)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t('map.common.filter-grade-all')}</SelectItem>
                      <SelectItem value="G4">G4</SelectItem>
                      <SelectItem value="G5">G5</SelectItem>
                      <SelectItem value="G6">G6</SelectItem>
                      <SelectItem value="G7">G7</SelectItem>
                      <SelectItem value="G8">G8</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex gap-2">
                    <Input
                      className="w-[220px]"
                      placeholder={t('map.testsets.bank-search')}
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && setSearch(searchInput)}
                    />
                    <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {isItemsLoading ? (
                    <div className="py-8 text-center text-muted-foreground">{t('map.common.loading')}</div>
                  ) : availableItems.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                      {t('map.testsets.bank-empty')}
                    </div>
                  ) : (
                    availableItems.map((item) => (
                      <div key={item.id} className="rounded-lg border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="outline">{item.itemType}</Badge>
                              <Badge variant="outline">{item.gradeLevel}</Badge>
                              <Badge variant="outline">{item.difficulty}</Badge>
                              <Badge variant="secondary">{t('map.testsets.points-suffix', { points: item.points })}</Badge>
                            </div>
                            <div className="text-sm text-[#0E1E3A]">{item.stem}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BookOpenText className="h-3.5 w-3.5" />
                              <span>{item.passageTitle ?? t('map.testsets.independent-item')}</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addBuilderItem(item, setBuilderItems)}
                          >
                            {t('map.testsets.bank-add')}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#C9A656]/15">
              <CardHeader>
                <CardTitle className="text-[#0E1E3A]">{t('map.testsets.board-title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {builderItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
                    {t('map.testsets.board-empty')}
                  </div>
                ) : (
                  builderItems.map((item, index) => (
                    <div
                      key={item.itemId}
                      draggable
                      onDragStart={() => setDraggedItemId(item.itemId)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        if (draggedItemId) {
                          reorderItems(draggedItemId, item.itemId, builderItems, setBuilderItems);
                          setDraggedItemId(null);
                        }
                      }}
                      className="rounded-lg border bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline">#{index + 1}</Badge>
                            <Badge variant="outline">{item.source.itemType}</Badge>
                            <Badge variant="secondary">{t('map.testsets.points-suffix', { points: item.source.points })}</Badge>
                            <span className="text-muted-foreground">{item.source.passageTitle ?? t('map.testsets.independent-item')}</span>
                          </div>
                          <div className="text-sm text-[#0E1E3A]">{item.source.stem}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" onClick={() => moveItem(index, -1, setBuilderItems)}>
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveItem(index, 1, setBuilderItems)}>
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(item.itemId, setBuilderItems)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {builderItems.length > 1 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => shuffleItems(builderItems, setBuilderItems)}
                  >
                    <Shuffle className="mr-2 h-4 w-4" />
                    {t('map.testsets.shuffle')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-[#C9A656]/15 xl:sticky xl:top-6 xl:h-fit">
          <CardHeader>
            <CardTitle className="text-[#0E1E3A]">{t('map.testsets.summary-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <SummaryStat label={t('map.testsets.summary-total-items')} value={String(builderItems.length)} />
              <SummaryStat label={t('map.testsets.summary-total-points')} value={`${totalPoints}`} />
              <SummaryStat label={t('map.testsets.summary-part-a')} value={String(partACount)} />
              <SummaryStat label={t('map.testsets.summary-part-b')} value={String(partBCount)} />
            </div>

            <Separator />

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>{t('map.testsets.passage-count')}</span>
                <span className="font-medium text-[#0E1E3A]">{passageCount}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('map.testsets.estimated-time')}</span>
                <span className="font-medium text-[#0E1E3A]">{t('map.testsets.estimated-minutes', { min: Math.max(10, builderItems.length * 2) })}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('map.testsets.composition-mode')}</span>
                <span className="font-medium text-[#0E1E3A]">{compositionMode}</span>
              </div>
            </div>

            <Separator />

            <div>
              <div className="mb-2 text-sm font-medium text-[#0E1E3A]">{t('map.testsets.difficulty-title')}</div>
              <div className="space-y-2">
                {Object.keys(difficultyBreakdown).length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t('map.testsets.difficulty-empty')}</div>
                ) : (
                  Object.entries(difficultyBreakdown).map(([difficulty, count]) => (
                    <div key={difficulty} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span>{difficulty}</span>
                      <span className="font-medium text-[#0E1E3A]">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {preview && selectedTestSetId ? (
              <>
                <Separator />
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#0E1E3A]">
                    <PenSquare className="h-4 w-4" />
                    {t('map.testsets.preview-title')}
                  </div>
                  <div className="space-y-2 rounded-lg bg-[#FAF7EE] p-4 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t('map.testsets.summary-total-items')}</span>
                      <span className="font-medium text-[#0E1E3A]">{preview.totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('map.testsets.summary-total-points')}</span>
                      <span className="font-medium text-[#0E1E3A]">{preview.totalPoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('map.testsets.passage-count')}</span>
                      <span className="font-medium text-[#0E1E3A]">{preview.passageCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('map.testsets.estimated-time')}</span>
                      <span className="font-medium text-[#0E1E3A]">{t('map.testsets.estimated-minutes', { min: preview.estimatedMinutes })}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#FAF7EE] p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[#0E1E3A]">{value}</div>
    </div>
  );
}

function addBuilderItem(item: MapItem, setBuilderItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>) {
  setBuilderItems((prev) => [
    ...prev,
    {
      itemId: item.id,
      ordinal: prev.length + 1,
      source: item,
    },
  ]);
}

function removeItem(itemId: number, setBuilderItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>) {
  setBuilderItems((prev) =>
    prev
      .filter((item) => item.itemId !== itemId)
      .map((item, index) => ({ ...item, ordinal: index + 1 })),
  );
}

function moveItem(
  index: number,
  direction: number,
  setBuilderItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>,
) {
  setBuilderItems((prev) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= prev.length) {
      return prev;
    }

    const items = [...prev];
    const [moved] = items.splice(index, 1);
    items.splice(nextIndex, 0, moved);
    return items.map((item, itemIndex) => ({ ...item, ordinal: itemIndex + 1 }));
  });
}

function reorderItems(
  draggedItemId: number,
  targetItemId: number,
  builderItems: BuilderItem[],
  setBuilderItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>,
) {
  const draggedIndex = builderItems.findIndex((item) => item.itemId === draggedItemId);
  const targetIndex = builderItems.findIndex((item) => item.itemId === targetItemId);

  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
    return;
  }

  setBuilderItems((prev) => {
    const next = [...prev];
    const [moved] = next.splice(draggedIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next.map((item, index) => ({ ...item, ordinal: index + 1 }));
  });
}

function shuffleItems(
  builderItems: BuilderItem[],
  setBuilderItems: React.Dispatch<React.SetStateAction<BuilderItem[]>>,
) {
  const next = [...builderItems];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
  }

  setBuilderItems(next.map((item, index) => ({ ...item, ordinal: index + 1 })));
}

function snapshotToItem(item: MapTestSetItem): MapItem {
  return {
    id: item.itemId,
    academyId: null,
    passageId: item.itemVersionSnapshot.passageId ?? null,
    parentItemId: null,
    domain: item.itemVersionSnapshot.domain,
    gradeLevel: item.itemVersionSnapshot.gradeLevel,
    difficulty: item.itemVersionSnapshot.difficulty,
    itemType: item.itemVersionSnapshot.itemType,
    stem: item.itemVersionSnapshot.stem,
    options: item.itemVersionSnapshot.options,
    answerKeys: item.itemVersionSnapshot.answerKeys,
    explanation: item.itemVersionSnapshot.explanation ?? null,
    points: item.itemVersionSnapshot.points,
    version: item.itemVersionSnapshot.version,
    status: item.itemVersionSnapshot.status,
    tags: item.itemVersionSnapshot.tags,
    passageTitle: item.itemVersionSnapshot.passageTitle ?? null,
    createdAt: '',
    updatedAt: '',
  };
}