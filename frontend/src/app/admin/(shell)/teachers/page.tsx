'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useTeachers, useCreateTeacher } from '@/hooks/use-teachers';
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
import { Plus, Search } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  SUSPENDED: 'secondary',
  TERMINATED: 'destructive',
};

export default function TeachersPage() {
  const { t, i18n } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: teachers = [], isLoading } = useTeachers({
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('teachers.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('teachers.new')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('teachers.new')}</DialogTitle>
            </DialogHeader>
            <CreateTeacherForm onSuccess={() => setDialogOpen(false)} />
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
            <SelectValue placeholder={t('teachers.filter.status-placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('teachers.filter.all')}</SelectItem>
            <SelectItem value="ACTIVE">{t('teachers.status.ACTIVE')}</SelectItem>
            <SelectItem value="SUSPENDED">{t('teachers.status.SUSPENDED')}</SelectItem>
            <SelectItem value="TERMINATED">{t('teachers.status.TERMINATED')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder={t('teachers.search-placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-[200px]"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('teachers.table.name')}</TableHead>
              <TableHead>{t('teachers.table.ama-id')}</TableHead>
              <TableHead>{t('teachers.table.subjects')}</TableHead>
              <TableHead>{t('teachers.table.employment')}</TableHead>
              <TableHead>{t('teachers.table.status')}</TableHead>
              <TableHead>{t('teachers.table.created-at')}</TableHead>
              <TableHead className="w-[100px]">{t('teachers.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('teachers.loading')}
                </TableCell>
              </TableRow>
            ) : teachers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('teachers.empty')}
                </TableCell>
              </TableRow>
            ) : (
              teachers.map((teacher) => {
                const variant = STATUS_VARIANT[teacher.status] ?? ('secondary' as const);
                return (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">
                      {teacher.cachedName ?? t('teachers.sync-needed')}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {teacher.amaClientId}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {teacher.teachingSubjects?.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs border-[#C9A656] text-[#C9A656]">
                            {s}
                          </Badge>
                        )) ?? '—'}
                      </div>
                    </TableCell>
                    <TableCell>{t(`teachers.employment.${teacher.employmentType}`, { defaultValue: teacher.employmentType })}</TableCell>
                    <TableCell>
                      <Badge variant={variant}>{t(`teachers.status.${teacher.status}`, { defaultValue: teacher.status })}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(teacher.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/teachers/${teacher.id}`}>
                        <Button variant="ghost" size="sm">
                          {t('teachers.table.detail')}
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateTeacherForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createTeacher = useCreateTeacher();
  const [amaClientId, setAmaClientId] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [subjects, setSubjects] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTeacher.mutateAsync({
      amaClientId,
      employmentType,
      teachingSubjects: subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('teachers.form.ama-id')}</label>
        <Input
          value={amaClientId}
          onChange={(e) => setAmaClientId(e.target.value)}
          placeholder="CL-001"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('teachers.form.employment-label')}</label>
        <Select value={employmentType} onValueChange={(v) => v && setEmploymentType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FULL_TIME">{t('teachers.employment.FULL_TIME')}</SelectItem>
            <SelectItem value="PART_TIME">{t('teachers.employment.PART_TIME')}</SelectItem>
            <SelectItem value="FREELANCE">{t('teachers.employment.FREELANCE')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('teachers.form.subjects-label')}</label>
        <Input
          value={subjects}
          onChange={(e) => setSubjects(e.target.value)}
          placeholder={t('teachers.form.subjects-placeholder')}
        />
      </div>
      <Button type="submit" className="w-full" disabled={createTeacher.isPending}>
        {createTeacher.isPending ? t('teachers.form.submitting') : t('teachers.form.submit')}
      </Button>
    </form>
  );
}
