'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTeacher, useUpdateTeacher } from '@/hooks/use-teachers';
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
import { ArrowLeft, Pencil, X, Check } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  SUSPENDED: 'bg-yellow-500',
  TERMINATED: 'bg-red-500',
};

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data: teacher, isLoading } = useTeacher(id);
  const updateTeacher = useUpdateTeacher();
  const [editing, setEditing] = useState(false);
  const [editSubjects, setEditSubjects] = useState('');
  const [editEmployment, setEditEmployment] = useState('');
  const [editStatus, setEditStatus] = useState('');

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('teachers.detail.loading')}</div>;
  }

  if (!teacher) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('teachers.detail.not-found')}</div>;
  }

  const statusLabel = t(`teachers.status.${teacher.status}`, { defaultValue: teacher.status });
  const statusColor = STATUS_COLORS[teacher.status] ?? 'bg-gray-500';

  const startEdit = () => {
    setEditSubjects(teacher.teachingSubjects?.join(', ') ?? '');
    setEditEmployment(teacher.employmentType);
    setEditStatus(teacher.status);
    setEditing(true);
  };

  const handleSave = async () => {
    await updateTeacher.mutateAsync({
      id: teacher.id,
      data: {
        teachingSubjects: editSubjects.split(',').map((s) => s.trim()).filter(Boolean),
        employmentType: editEmployment,
        status: editStatus,
      },
    });
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/teachers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#0E1E3A]">
            {teacher.cachedName ?? teacher.amaClientId}
          </h1>
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm text-muted-foreground">{statusLabel}</span>
        </div>
        <div className="ml-auto">
          {!editing ? (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('teachers.detail.edit')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                {t('teachers.detail.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={updateTeacher.isPending}>
                <Check className="mr-2 h-4 w-4" />
                {t('teachers.detail.save')}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('teachers.detail.basic-info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label={t('teachers.detail.label-ama-id')} value={teacher.amaClientId} />
            <InfoRow label={t('teachers.detail.label-name')} value={teacher.cachedName ?? t('teachers.sync-needed')} />
            <InfoRow label={t('teachers.detail.label-phone')} value={teacher.cachedPhone ?? '—'} />
            <InfoRow
              label={t('teachers.detail.label-last-sync')}
              value={
                teacher.lastSyncedAt
                  ? new Date(teacher.lastSyncedAt).toLocaleString(i18n.resolvedLanguage ?? 'ko')
                  : '—'
              }
            />
            <InfoRow
              label={t('teachers.detail.label-created-at')}
              value={new Date(teacher.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('teachers.detail.class-info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editing ? (
              <>
                <div>
                  <span className="text-sm text-muted-foreground">{t('teachers.detail.label-subjects')}</span>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {teacher.teachingSubjects?.map((s) => (
                      <Badge key={s} variant="outline" className="border-[#C9A656] text-[#C9A656]">
                        {s}
                      </Badge>
                    )) ?? <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
                <InfoRow
                  label={t('teachers.detail.label-employment')}
                  value={t(`teachers.employment.${teacher.employmentType}`, { defaultValue: teacher.employmentType })}
                />
                <InfoRow label={t('teachers.detail.label-status')} value={statusLabel} />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('teachers.form.subjects-label')}</label>
                  <Input
                    value={editSubjects}
                    onChange={(e) => setEditSubjects(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('teachers.detail.label-employment')}</label>
                  <Select value={editEmployment} onValueChange={(v) => v && setEditEmployment(v)}>
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
                  <label className="text-sm font-medium">{t('teachers.detail.label-status')}</label>
                  <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('teachers.status.ACTIVE')}</SelectItem>
                      <SelectItem value="SUSPENDED">{t('teachers.status.SUSPENDED')}</SelectItem>
                      <SelectItem value="TERMINATED">{t('teachers.status.TERMINATED')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
