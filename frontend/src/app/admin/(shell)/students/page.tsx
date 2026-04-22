'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useStudents, useCreateStudent, useParents, useCreateParent } from '@/hooks/use-students';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  ACTIVE: 'default',
  INACTIVE: 'secondary',
  WITHDRAWN: 'destructive',
};

export default function StudentsPage() {
  const { t, i18n } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const [lcFilter, setLcFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('student');

  const { data: students = [], isLoading } = useStudents({
    status: statusFilter || undefined,
    lifecycleStatus: lcFilter || undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('students.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('students.new-reg')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('students.new-reg')}</DialogTitle>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="student" className="flex-1">{t('students.tabs.student')}</TabsTrigger>
                <TabsTrigger value="parent" className="flex-1">{t('students.tabs.parent')}</TabsTrigger>
              </TabsList>
              <TabsContent value="student">
                <CreateStudentForm onSuccess={() => setDialogOpen(false)} />
              </TabsContent>
              <TabsContent value="parent">
                <CreateParentForm onSuccess={() => setDialogOpen(false)} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(!v || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder={t('students.filter.status-placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('students.filter.all')}</SelectItem>
            <SelectItem value="ACTIVE">{t('students.status.ACTIVE')}</SelectItem>
            <SelectItem value="INACTIVE">{t('students.status.INACTIVE')}</SelectItem>
            <SelectItem value="WITHDRAWN">{t('students.status.WITHDRAWN')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lcFilter} onValueChange={(v) => setLcFilter(!v || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder={t('students.filter.lifecycle-placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('students.filter.all')}</SelectItem>
            <SelectItem value="CONSULTING">{t('students.lifecycle.CONSULTING')}</SelectItem>
            <SelectItem value="ENROLLED">{t('students.lifecycle.ENROLLED')}</SelectItem>
            <SelectItem value="COMPLETED">{t('students.lifecycle.COMPLETED')}</SelectItem>
            <SelectItem value="TERMINATED">{t('students.lifecycle.TERMINATED')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Input
            placeholder={t('students.search-placeholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            className="w-[200px]"
          />
          <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('students.table.name')}</TableHead>
              <TableHead>{t('students.table.school')}</TableHead>
              <TableHead>{t('students.table.grade')}</TableHead>
              <TableHead>{t('students.table.parent')}</TableHead>
              <TableHead>{t('students.table.status')}</TableHead>
              <TableHead>{t('students.table.lifecycle')}</TableHead>
              <TableHead>{t('students.table.created-at')}</TableHead>
              <TableHead className="w-[80px]">{t('students.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('students.loading')}</TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('students.empty')}</TableCell>
              </TableRow>
            ) : (
              students.map((s) => {
                const variant = STATUS_VARIANT[s.status] ?? ('secondary' as const);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.school ?? '—'}</TableCell>
                    <TableCell>{s.grade ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.parentName ?? '—'}</TableCell>
                    <TableCell><Badge variant={variant}>{t(`students.status.${s.status}`, { defaultValue: s.status })}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {t(`students.lifecycle.${s.lifecycleStatus}`, { defaultValue: s.lifecycleStatus })}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(s.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/students/${s.id}`}>
                        <Button variant="ghost" size="sm">{t('students.table.detail')}</Button>
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

function CreateStudentForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const { data: parents = [] } = useParents();
  const createStudent = useCreateStudent();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStudent.mutateAsync({
      primaryParentId: Number(parentId),
      name,
      school: school || undefined,
      grade: grade || undefined,
      birthDate: birthDate || undefined,
      gender: gender || undefined,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('students.form.student-name')}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('students.form.parent-label')}</label>
        <Select value={parentId} onValueChange={(v) => v && setParentId(v)}>
          <SelectTrigger><SelectValue placeholder={t('students.form.parent-select-placeholder')} /></SelectTrigger>
          <SelectContent>
            {parents.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('students.form.school')}</label>
          <Input value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('students.form.grade')}</label>
          <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t('students.form.grade-placeholder')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('students.form.birth-date')}</label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('students.form.gender')}</label>
          <Select value={gender} onValueChange={(v) => v && setGender(v)}>
            <SelectTrigger><SelectValue placeholder={t('students.form.gender-placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="M">{t('students.form.gender-male')}</SelectItem>
              <SelectItem value="F">{t('students.form.gender-female')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={createStudent.isPending || !parentId}>
        {createStudent.isPending ? t('students.form.submitting-student') : t('students.form.submit-student')}
      </Button>
    </form>
  );
}

function CreateParentForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createParent = useCreateParent();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createParent.mutateAsync({
      name,
      phone: phone || undefined,
      email: email || undefined,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('students.form.parent-name')}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('students.form.parent-phone')}</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('students.form.parent-email')}</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={createParent.isPending}>
        {createParent.isPending ? t('students.form.submitting-parent') : t('students.form.submit-parent')}
      </Button>
    </form>
  );
}
