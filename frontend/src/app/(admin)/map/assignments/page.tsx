'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, SendHorizonal } from 'lucide-react';
import { useAssignments, useCreateAssignment, useTestSets, useUpdateAssignment } from '@/hooks/use-map';
import { useClasses } from '@/hooks/use-classes';
import { useStudents } from '@/hooks/use-students';
import type { MapAssignment } from '@/types/map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function MapAssignmentsPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filters = useMemo(
    () => ({
      status: statusFilter || undefined,
      targetType: targetTypeFilter || undefined,
      search: search || undefined,
    }),
    [search, statusFilter, targetTypeFilter],
  );

  const { data: assignments = [], isLoading } = useAssignments(filters);

  const totalAssignments = assignments.length;
  const overdueCount = assignments.filter((assignment) => assignment.status === 'OVERDUE').length;
  const completedCount = assignments.filter((assignment) => assignment.status === 'COMPLETED').length;
  const inProgressCount = assignments.filter((assignment) => assignment.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('map.assignments.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('map.assignments.lead')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            {t('map.assignments.new')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('map.assignments.dialog-title')}</DialogTitle>
            </DialogHeader>
            <CreateAssignmentForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title={t('map.assignments.summary.total')} value={String(totalAssignments)} />
        <SummaryCard title={t('map.assignments.summary.in-progress')} value={String(inProgressCount)} />
        <SummaryCard title={t('map.assignments.summary.completed')} value={String(completedCount)} />
        <SummaryCard title={t('map.assignments.summary.overdue')} value={String(overdueCount)} />
      </div>

      <Card className="border-[#C9A656]/15">
        <CardHeader>
          <CardTitle className="text-[#0E1E3A]">{t('map.assignments.list-title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter || 'ALL'} onValueChange={(value) => setStatusFilter(!value || value === 'ALL' ? '' : value)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('map.assignments.filter-status-all')}</SelectItem>
                <SelectItem value="ASSIGNED">{t('map.assignments.status.ASSIGNED')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t('map.assignments.status.IN_PROGRESS')}</SelectItem>
                <SelectItem value="COMPLETED">{t('map.assignments.status.COMPLETED')}</SelectItem>
                <SelectItem value="OVERDUE">{t('map.assignments.status.OVERDUE')}</SelectItem>
                <SelectItem value="CANCELED">{t('map.assignments.status.CANCELED')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={targetTypeFilter || 'ALL'} onValueChange={(value) => setTargetTypeFilter(!value || value === 'ALL' ? '' : value)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('map.assignments.filter-target-all')}</SelectItem>
                <SelectItem value="STUDENT">{t('map.assignments.target-type.STUDENT')}</SelectItem>
                <SelectItem value="CLASS">{t('map.assignments.target-type.CLASS')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="ml-auto max-w-[260px]"
              placeholder={t('map.assignments.search-placeholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('map.assignments.table.testset')}</TableHead>
                  <TableHead>{t('map.assignments.table.target')}</TableHead>
                  <TableHead>{t('map.assignments.table.progress')}</TableHead>
                  <TableHead>{t('map.assignments.table.due-at')}</TableHead>
                  <TableHead>{t('map.assignments.table.status')}</TableHead>
                  <TableHead className="w-[140px]">{t('map.assignments.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t('map.assignments.loading')}</TableCell>
                  </TableRow>
                ) : assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t('map.assignments.empty')}</TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <AssignmentRow key={assignment.id} assignment={assignment} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="border-[#C9A656]/15 bg-[#FAF7EE]">
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className="mt-2 text-2xl font-semibold text-[#0E1E3A]">{value}</div>
      </CardContent>
    </Card>
  );
}

function AssignmentRow({ assignment }: { assignment: MapAssignment }) {
  const { t, i18n } = useTranslation('admin');
  const updateAssignment = useUpdateAssignment();
  const variant = STATUS_VARIANT[assignment.status] ?? ('secondary' as const);
  const statusLabel = t(`map.assignments.status.${assignment.status}`, { defaultValue: assignment.status });

  const progressWidth = `${Math.min(Math.max(assignment.completionRate, 0), 100)}%`;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-[#0E1E3A]">{assignment.testSetName ?? t('map.assignments.testset-fallback', { id: assignment.testSetId })}</div>
        <div className="text-xs text-muted-foreground">{t('map.assignments.assign-ref', { id: assignment.id })}</div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{assignment.targetName ?? t('map.assignments.target-fallback', { id: assignment.targetId })}</div>
        <div className="text-xs text-muted-foreground">
          {assignment.targetType === 'CLASS'
            ? t('map.assignments.target-type.CLASS')
            : t('map.assignments.target-type.STUDENT')}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[#C9A656]" style={{ width: progressWidth }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {t('map.assignments.progress-summary', { completed: assignment.completedTargets, total: assignment.totalTargets })}
          </div>
        </div>
      </TableCell>
      <TableCell>{new Date(assignment.dueAt).toLocaleString(i18n.resolvedLanguage ?? 'ko')}</TableCell>
      <TableCell>
        <Badge variant={variant}>{statusLabel}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          {assignment.status !== 'CANCELED' && assignment.status !== 'COMPLETED' ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => updateAssignment.mutate({ id: assignment.id, data: { status: 'CANCELED' } })}
            >
              {t('map.assignments.action-cancel')}
            </Button>
          ) : null}
          {assignment.status === 'CANCELED' ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => updateAssignment.mutate({ id: assignment.id, data: { status: 'ASSIGNED' } })}
            >
              {t('map.assignments.action-restore')}
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreateAssignmentForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createAssignment = useCreateAssignment();
  const { data: testSets = [] } = useTestSets();
  const { data: students = [] } = useStudents({ status: 'ACTIVE' });
  const { data: classes = [] } = useClasses();
  const [testSetId, setTestSetId] = useState('');
  const [targetType, setTargetType] = useState<'STUDENT' | 'CLASS'>('CLASS');
  const [targetId, setTargetId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const targets = targetType === 'CLASS'
    ? classes.map((cls) => ({ id: cls.id, label: cls.programName ?? `Class #${cls.id}` }))
    : students.map((student) => ({ id: student.id, label: student.name }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createAssignment.mutateAsync({
      testSetId: Number(testSetId),
      targetType,
      targetId: Number(targetId),
      dueAt: new Date(dueAt).toISOString(),
      status: 'ASSIGNED',
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="test-set-id">{t('map.assignments.form.testset')}</Label>
        <Select value={testSetId} onValueChange={(value) => value && setTestSetId(value)}>
          <SelectTrigger id="test-set-id"><SelectValue placeholder={t('map.assignments.form.testset-placeholder')} /></SelectTrigger>
          <SelectContent>
            {testSets.map((testSet) => (
              <SelectItem key={testSet.id} value={String(testSet.id)}>
                {testSet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="target-type">{t('map.assignments.form.target-type')}</Label>
          <Select
            value={targetType}
            onValueChange={(value) => {
              if (!value) return;
              setTargetType(value as 'STUDENT' | 'CLASS');
              setTargetId('');
            }}
          >
            <SelectTrigger id="target-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CLASS">{t('map.assignments.target-type.CLASS')}</SelectItem>
              <SelectItem value="STUDENT">{t('map.assignments.target-type.STUDENT_FULL')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="target-id">{t('map.assignments.form.target-select')}</Label>
          <Select value={targetId} onValueChange={(value) => value && setTargetId(value)}>
            <SelectTrigger id="target-id"><SelectValue placeholder={t('map.assignments.form.target-select-placeholder')} /></SelectTrigger>
            <SelectContent>
              {targets.map((target) => (
                <SelectItem key={target.id} value={String(target.id)}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="due-at">{t('map.assignments.form.due-at')}</Label>
        <Input id="due-at" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
      </div>

      <div className="rounded-lg bg-[#FAF7EE] p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-[#0E1E3A]">
          <SendHorizonal className="h-4 w-4" />
          {t('map.assignments.form.memo-title')}
        </div>
        <p className="mt-2">{t('map.assignments.form.memo-body')}</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={createAssignment.isPending || !testSetId || !targetId || !dueAt}>
          {createAssignment.isPending ? t('map.assignments.form.submitting') : t('map.assignments.form.submit')}
        </Button>
      </div>
    </form>
  );
}
