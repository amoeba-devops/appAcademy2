'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useClasses, useCreateClass, useClassrooms } from '@/hooks/use-classes';
import { usePrograms } from '@/hooks/use-programs';
import { useTeachers } from '@/hooks/use-teachers';
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
import { Plus, Search, Users } from 'lucide-react';
import type { SchedulePattern } from '@/types/class';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  CANCELED: 'destructive',
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export default function ClassesPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: classes = [], isLoading } = useClasses({
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const formatSchedule = (patterns: SchedulePattern[]): string => {
    if (!patterns || patterns.length === 0) return '-';
    return patterns
      .map((p) => `${t(`classes.days-short.${DAY_KEYS[p.dayOfWeek]}`)} ${p.startTime}~${p.endTime}`)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('classes.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('classes.new')}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('classes.new')}</DialogTitle>
            </DialogHeader>
            <CreateClassForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v === 'ALL' ? '' : v)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('classes.filter.status-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('classes.filter.all')}</SelectItem>
            <SelectItem value="DRAFT">{t('classes.status.DRAFT')}</SelectItem>
            <SelectItem value="ACTIVE">{t('classes.status.ACTIVE')}</SelectItem>
            <SelectItem value="COMPLETED">{t('classes.status.COMPLETED')}</SelectItem>
            <SelectItem value="CANCELED">{t('classes.status.CANCELED')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder={t('classes.search-placeholder')}
            value={searchInput}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && setSearch(searchInput)}
            className="w-[200px]"
          />
          <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('classes.loading')}</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{t('classes.empty')}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">{t('classes.table.id')}</TableHead>
                <TableHead>{t('classes.table.program')}</TableHead>
                <TableHead>{t('classes.table.teacher')}</TableHead>
                <TableHead>{t('classes.table.classroom')}</TableHead>
                <TableHead>{t('classes.table.schedule')}</TableHead>
                <TableHead className="w-[100px]">{t('classes.table.capacity')}</TableHead>
                <TableHead className="w-[80px]">{t('classes.table.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => {
                const variant = STATUS_VARIANT[cls.status] ?? ('secondary' as const);
                return (
                  <TableRow key={cls.id}>
                    <TableCell className="text-muted-foreground">{cls.id}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/classes/${cls.id}`}
                        className="font-medium text-[#0E1E3A] hover:text-[#C9A656] hover:underline"
                      >
                        {cls.programName ?? t('classes.program-fallback', { id: cls.programId })}
                      </Link>
                    </TableCell>
                    <TableCell>{cls.teacherName ?? '-'}</TableCell>
                    <TableCell>{cls.classroomName ?? '-'}</TableCell>
                    <TableCell className="text-sm">{formatSchedule(cls.schedulePattern)}</TableCell>
                    <TableCell>{t('classes.capacity-format', { enrolled: cls.enrolledCount, capacity: cls.capacity })}</TableCell>
                    <TableCell>
                      <Badge variant={variant}>{t(`classes.status.${cls.status}`, { defaultValue: cls.status })}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ──────── Create Class Form ──────── */
function CreateClassForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createClass = useCreateClass();
  const { data: programs = [] } = usePrograms({ status: 'ACTIVE' });
  const { data: teachers = [] } = useTeachers({ status: 'ACTIVE' });
  const { data: classrooms = [] } = useClassrooms();

  const [form, setForm] = useState({
    programId: '',
    teacherId: '',
    classroomId: '',
    startDate: '',
    endDate: '',
    capacity: '15',
  });
  const [schedulePatterns, setSchedulePatterns] = useState<SchedulePattern[]>([
    { dayOfWeek: 1, startTime: '14:00', endTime: '15:30' },
  ]);

  const addPattern = () => {
    setSchedulePatterns([...schedulePatterns, { dayOfWeek: 3, startTime: '14:00', endTime: '15:30' }]);
  };

  const removePattern = (index: number) => {
    setSchedulePatterns(schedulePatterns.filter((_, i) => i !== index));
  };

  const updatePattern = (index: number, field: keyof SchedulePattern, value: string | number) => {
    const updated = [...schedulePatterns];
    updated[index] = { ...updated[index], [field]: value };
    setSchedulePatterns(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createClass.mutateAsync({
      programId: parseInt(form.programId),
      teacherId: parseInt(form.teacherId),
      classroomId: form.classroomId ? parseInt(form.classroomId) : undefined,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      capacity: parseInt(form.capacity),
      schedulePattern: schedulePatterns,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>{t('classes.form.program')}</Label>
          <Select value={form.programId} onValueChange={(v) => v && setForm({ ...form, programId: v })}>
            <SelectTrigger><SelectValue placeholder={t('classes.form.select-placeholder')} /></SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('classes.form.teacher')}</Label>
          <Select value={form.teacherId} onValueChange={(v) => v && setForm({ ...form, teacherId: v })}>
            <SelectTrigger><SelectValue placeholder={t('classes.form.select-placeholder')} /></SelectTrigger>
            <SelectContent>
              {teachers.map((tc) => (
                <SelectItem key={tc.id} value={String(tc.id)}>
                  {tc.cachedName ?? tc.amaClientId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('classes.form.classroom')}</Label>
          <Select value={form.classroomId} onValueChange={(v) => v && setForm({ ...form, classroomId: v === 'NONE' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder={t('classes.form.select-placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">{t('classes.form.classroom-none')}</SelectItem>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t('classes.form.start-date')}</Label>
          <Input
            type="date"
            value={form.startDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, startDate: e.target.value })}
            required
          />
        </div>

        <div>
          <Label>{t('classes.form.end-date')}</Label>
          <Input
            type="date"
            value={form.endDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>

        <div>
          <Label>{t('classes.form.capacity')}</Label>
          <Input
            type="number"
            min="1"
            value={form.capacity}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, capacity: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Schedule Patterns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('classes.form.schedule-label')}</Label>
          <Button type="button" variant="outline" size="sm" onClick={addPattern}>
            {t('classes.form.add-pattern')}
          </Button>
        </div>
        {schedulePatterns.map((pattern, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={String(pattern.dayOfWeek)}
              onValueChange={(v) => v && updatePattern(i, 'dayOfWeek', parseInt(v))}
            >
              <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_KEYS.map((dk, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{t(`classes.days-short.${dk}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              value={pattern.startTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePattern(i, 'startTime', e.target.value)}
              className="w-[120px]"
            />
            <span className="text-muted-foreground">~</span>
            <Input
              type="time"
              value={pattern.endTime}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePattern(i, 'endTime', e.target.value)}
              className="w-[120px]"
            />
            {schedulePatterns.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removePattern(i)}>
                ✕
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={createClass.isPending}>
          {createClass.isPending ? t('classes.form.submitting') : t('classes.form.submit')}
        </Button>
      </div>
    </form>
  );
}
