'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, CheckCheck, ClipboardCheck, Search } from 'lucide-react';
import { useGradeAssignment, useGradingDetail, useGradingQueue } from '@/hooks/use-map';
import type { MapGradingQueueItem } from '@/types/map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ASSIGNED: 'outline',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'default',
  OVERDUE: 'destructive',
  CANCELED: 'destructive',
};

export default function MapGradingPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    [search, statusFilter],
  );

  const { data: queue = [], isLoading } = useGradingQueue(filters);
  const { data: detail, isFetching: isDetailLoading } = useGradingDetail(selectedAssignmentId ?? undefined);
  const gradeAssignment = useGradeAssignment();

  useEffect(() => {
    if (queue.length === 0) {
      setSelectedAssignmentId(null);
      return;
    }

    if (!selectedAssignmentId || !queue.some((item) => item.assignmentId === selectedAssignmentId)) {
      setSelectedAssignmentId(queue[0].assignmentId);
    }
  }, [queue, selectedAssignmentId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('map.grading.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('map.grading.lead')}</p>
        </div>
        <Button
          disabled={!selectedAssignmentId || gradeAssignment.isPending}
          onClick={() => selectedAssignmentId && gradeAssignment.mutate(selectedAssignmentId)}
        >
          {gradeAssignment.isPending ? t('map.grading.grading-now') : t('map.grading.auto-grade')}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card className="border-[#C9A656]/15 xl:sticky xl:top-6 xl:h-fit">
          <CardHeader>
            <CardTitle className="text-[#0E1E3A]">{t('map.grading.queue-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              <Select value={statusFilter || 'ALL'} onValueChange={(value) => setStatusFilter(!value || value === 'ALL' ? '' : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('map.grading.filter-status-all')}</SelectItem>
                  <SelectItem value="ASSIGNED">{t('map.grading.status.ASSIGNED')}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{t('map.grading.status.IN_PROGRESS')}</SelectItem>
                  <SelectItem value="COMPLETED">{t('map.grading.status.COMPLETED')}</SelectItem>
                  <SelectItem value="OVERDUE">{t('map.grading.status.OVERDUE')}</SelectItem>
                  <SelectItem value="CANCELED">{t('map.grading.status.CANCELED')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t('map.grading.queue-search-placeholder')} value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">{t('map.grading.queue-loading')}</div>
              ) : queue.length === 0 ? (
                <div className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
                  {t('map.grading.queue-empty')}
                </div>
              ) : (
                queue.map((item) => <QueueCard key={item.assignmentId} item={item} selectedAssignmentId={selectedAssignmentId} onSelect={setSelectedAssignmentId} />)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#C9A656]/15">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-[#0E1E3A]">{t('map.grading.results-title')}</CardTitle>
              {detail ? (
                <Badge variant="outline">{t('map.grading.total-points-badge', { points: detail.totalPoints })}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <div className="py-14 text-center text-sm text-muted-foreground">{t('map.grading.select-prompt')}</div>
            ) : isDetailLoading ? (
              <div className="py-14 text-center text-sm text-muted-foreground">{t('map.grading.detail-loading')}</div>
            ) : detail.studentResults.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">{t('map.grading.no-students')}</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('map.grading.table.student')}</TableHead>
                      <TableHead>{t('map.grading.table.responses')}</TableHead>
                      <TableHead>{t('map.grading.table.correct')}</TableHead>
                      <TableHead>{t('map.grading.table.score')}</TableHead>
                      <TableHead>{t('map.grading.table.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.studentResults.map((result) => (
                      <StudentResultRow key={result.studentId} result={result} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#C9A656]/15 xl:sticky xl:top-6 xl:h-fit">
          <CardHeader>
            <CardTitle className="text-[#0E1E3A]">{t('map.grading.insights-title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!detail ? (
              <div className="text-sm text-muted-foreground">{t('map.grading.insights-prompt')}</div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <InsightStat title={t('map.grading.stat-submitted')} value={`${detail.assignment.submittedTargets}/${detail.assignment.totalTargets}`} icon={ClipboardCheck} />
                  <InsightStat title={t('map.grading.stat-avg-score')} value={detail.averageReadingScore !== null ? String(detail.averageReadingScore) : '-'} icon={BarChart3} />
                  <InsightStat title="Part A" value={`${detail.partACorrectRate}%`} icon={CheckCheck} />
                  <InsightStat title="Part B" value={`${detail.partBCorrectRate}%`} icon={CheckCheck} />
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-[#0E1E3A]">{t('map.grading.item-insights-title')}</div>
                  {detail.itemInsights.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t('map.grading.no-responses')}</div>
                  ) : (
                    detail.itemInsights.map((insight) => (
                      <div key={insight.itemId} className="rounded-lg bg-[#FAF7EE] p-3">
                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{insight.itemType}</span>
                          <span>{t('map.grading.correct-rate', { rate: insight.correctRate })}</span>
                        </div>
                        <div className="mt-1 text-sm text-[#0E1E3A] line-clamp-2">{insight.stem}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {t('map.grading.correct-incorrect', { correct: insight.correctCount, incorrect: insight.incorrectCount })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StudentResultRow({ result }: { result: { studentId: number; studentName: string; submittedAt: string | null; totalResponses: number; correctResponses: number; earnedPoints: number; totalPoints: number; scoreRate: number; gradingStatus: string } }) {
  const { t, i18n } = useTranslation('admin');
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-[#0E1E3A]">{result.studentName}</div>
        <div className="text-xs text-muted-foreground">
          {result.submittedAt ? new Date(result.submittedAt).toLocaleString(i18n.resolvedLanguage ?? 'ko') : t('map.grading.not-submitted')}
        </div>
      </TableCell>
      <TableCell>{result.totalResponses}</TableCell>
      <TableCell>{result.correctResponses}</TableCell>
      <TableCell>
        <div className="font-medium">{result.earnedPoints}/{result.totalPoints}</div>
        <div className="text-xs text-muted-foreground">{result.scoreRate}%</div>
      </TableCell>
      <TableCell>
        <StatusBadge status={result.gradingStatus} />
      </TableCell>
    </TableRow>
  );
}

function QueueCard({ item, selectedAssignmentId, onSelect }: { item: MapGradingQueueItem; selectedAssignmentId: number | null; onSelect: (assignmentId: number) => void }) {
  const { t } = useTranslation('admin');
  const selected = item.assignmentId === selectedAssignmentId;
  const variant = STATUS_VARIANT[item.status] ?? ('secondary' as const);
  const statusLabel = t(`map.grading.status.${item.status}`, { defaultValue: item.status });

  return (
    <button
      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${selected ? 'border-[#C9A656] bg-[#FAF7EE]' : 'border-border hover:border-[#C9A656]/40'}`}
      onClick={() => onSelect(item.assignmentId)}
    >
      <div className="font-medium text-[#0E1E3A]">{item.testSetName ?? t('map.grading.assignment-fallback', { id: item.assignmentId })}</div>
      <div className="mt-1 text-xs text-muted-foreground">{item.targetName ?? t('map.grading.target-fallback', { id: item.targetId })}</div>
      <div className="mt-2 flex items-center gap-2">
        <Badge variant={variant}>{statusLabel}</Badge>
        <span className="text-xs text-muted-foreground">{t('map.grading.queue-submitted', { submitted: item.submittedTargets, total: item.totalTargets })}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        {t('map.grading.queue-avg', { score: item.averageReadingScore !== null ? item.averageReadingScore : '-' })}
      </div>
    </button>
  );
}

function InsightStat({ title, value, icon: Icon }: { title: string; value: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-lg bg-[#FAF7EE] p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="mt-2 text-lg font-semibold text-[#0E1E3A]">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('admin');
  if (status === 'GRADED') {
    return <Badge>{t('map.grading.grading-status.GRADED')}</Badge>;
  }
  if (status === 'SUBMITTED') {
    return <Badge variant="secondary">{t('map.grading.grading-status.SUBMITTED')}</Badge>;
  }
  return <Badge variant="outline">{t('map.grading.grading-status.PENDING')}</Badge>;
}
