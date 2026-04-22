'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClasses } from '@/hooks/use-classes';
import { useEnrollments, useCreateEnrollment, useUpdateEnrollmentStatus } from '@/hooks/use-enrollments';
import { useStudents } from '@/hooks/use-students';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CONFIRMED: 'default',
  WAITLIST: 'secondary',
  CANCELED: 'destructive',
  PENDING: 'outline',
};

export default function EnrollmentsPage() {
  const { t } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: enrollments = [], isLoading } = useEnrollments({
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('enrollments.title')}</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            {t('enrollments.new')}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('enrollments.new')}</DialogTitle>
            </DialogHeader>
            <CreateEnrollmentForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(!v || v === 'ALL' ? '' : v)}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder={t('enrollments.filter.status-placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('enrollments.filter.all')}</SelectItem>
            <SelectItem value="CONFIRMED">{t('enrollments.status.CONFIRMED')}</SelectItem>
            <SelectItem value="WAITLIST">{t('enrollments.status.WAITLIST')}</SelectItem>
            <SelectItem value="CANCELED">{t('enrollments.status.CANCELED')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('enrollments.table.student')}</TableHead>
              <TableHead>{t('enrollments.table.parent')}</TableHead>
              <TableHead>{t('enrollments.table.class')}</TableHead>
              <TableHead>{t('enrollments.table.status')}</TableHead>
              <TableHead>{t('enrollments.table.applied-at')}</TableHead>
              <TableHead className="w-[180px]">{t('enrollments.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t('enrollments.loading')}</TableCell>
              </TableRow>
            ) : enrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{t('enrollments.empty')}</TableCell>
              </TableRow>
            ) : (
              enrollments.map((enrollment) => (
                <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EnrollmentRow({ enrollment }: { enrollment: { id: number; status: string; studentName: string | null; parentName: string | null; programName: string | null; className: string | null; appliedAt: string } }) {
  const { t, i18n } = useTranslation('admin');
  const updateStatus = useUpdateEnrollmentStatus();
  const variant = STATUS_VARIANT[enrollment.status] ?? ('secondary' as const);
  const statusLabel = t(`enrollments.status.${enrollment.status}`, { defaultValue: enrollment.status });

  return (
    <TableRow>
      <TableCell className="font-medium">{enrollment.studentName ?? '-'}</TableCell>
      <TableCell>{enrollment.parentName ?? '-'}</TableCell>
      <TableCell>{enrollment.programName ?? enrollment.className ?? '-'}</TableCell>
      <TableCell>
        <Badge variant={variant}>{statusLabel}</Badge>
      </TableCell>
      <TableCell>{new Date(enrollment.appliedAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {enrollment.status !== 'CONFIRMED' && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => updateStatus.mutate({ id: enrollment.id, data: { status: 'CONFIRMED' } })}
            >
              {t('enrollments.actions.confirm')}
            </Button>
          )}
          {enrollment.status !== 'WAITLIST' && enrollment.status !== 'CANCELED' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => updateStatus.mutate({ id: enrollment.id, data: { status: 'WAITLIST' } })}
            >
              {t('enrollments.actions.waitlist')}
            </Button>
          )}
          {enrollment.status !== 'CANCELED' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-destructive"
              onClick={() => updateStatus.mutate({ id: enrollment.id, data: { status: 'CANCELED' } })}
            >
              {t('enrollments.actions.cancel')}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function CreateEnrollmentForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createEnrollment = useCreateEnrollment();
  const { data: classes = [] } = useClasses({ status: 'ACTIVE' });
  const { data: students = [] } = useStudents({ status: 'ACTIVE' });
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await createEnrollment.mutateAsync({
      classId: parseInt(classId, 10),
      studentId: parseInt(studentId, 10),
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Select value={classId} onValueChange={(value) => value && setClassId(value)}>
          <SelectTrigger><SelectValue placeholder={t('enrollments.form.class-placeholder')} /></SelectTrigger>
          <SelectContent>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={String(cls.id)}>
                {(cls.programName ?? t('enrollments.form.class-fallback', { id: cls.id })) + ` (${cls.enrolledCount}/${cls.capacity})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Select value={studentId} onValueChange={(value) => value && setStudentId(value)}>
          <SelectTrigger><SelectValue placeholder={t('enrollments.form.student-placeholder')} /></SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.id} value={String(student.id)}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={createEnrollment.isPending || !classId || !studentId}>
          {createEnrollment.isPending ? t('enrollments.form.submitting') : t('enrollments.form.submit')}
        </Button>
      </div>
    </form>
  );
}
