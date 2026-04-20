'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudent, useUpdateStudent } from '@/hooks/use-students';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Pencil, X, Check } from 'lucide-react';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data: student, isLoading } = useStudent(id);
  const updateStudent = useUpdateStudent();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', school: '', grade: '', birthDate: '', gender: '', status: '', lifecycleStatus: '' });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('students.detail.loading')}</div>;
  if (!student) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('students.detail.not-found')}</div>;

  const startEdit = () => {
    setForm({
      name: student.name,
      school: student.school ?? '',
      grade: student.grade ?? '',
      birthDate: student.birthDate ?? '',
      gender: student.gender ?? '',
      status: student.status,
      lifecycleStatus: student.lifecycleStatus,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await updateStudent.mutateAsync({
      id: student.id,
      data: {
        name: form.name,
        school: form.school || undefined,
        grade: form.grade || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        status: form.status,
        lifecycleStatus: form.lifecycleStatus,
      },
    });
    setEditing(false);
  };

  const genderDisplay = student.gender === 'M'
    ? t('students.form.gender-male')
    : student.gender === 'F'
      ? t('students.form.gender-female')
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/students')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{student.name}</h1>
        <Badge variant="outline">{t(`students.lifecycle.${student.lifecycleStatus}`, { defaultValue: student.lifecycleStatus })}</Badge>
        <div className="ml-auto">
          {!editing ? (
            <Button variant="outline" onClick={startEdit}>
              <Pencil className="mr-2 h-4 w-4" />{t('students.detail.edit')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}><X className="mr-2 h-4 w-4" />{t('students.detail.cancel')}</Button>
              <Button onClick={handleSave} disabled={updateStudent.isPending}><Check className="mr-2 h-4 w-4" />{t('students.detail.save')}</Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('students.detail.basic-info')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!editing ? (
              <>
                <InfoRow label={t('students.detail.label-name')} value={student.name} />
                <InfoRow label={t('students.detail.label-school')} value={student.school ?? '—'} />
                <InfoRow label={t('students.detail.label-grade')} value={student.grade ?? '—'} />
                <InfoRow label={t('students.detail.label-birth')} value={student.birthDate ?? '—'} />
                <InfoRow label={t('students.detail.label-gender')} value={genderDisplay} />
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-name')}</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-school')}</label>
                  <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-grade')}</label>
                  <Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-birth')}</label>
                  <Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-gender')}</label>
                  <Select value={form.gender} onValueChange={(v) => v && setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue placeholder={t('students.detail.gender-placeholder')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">{t('students.form.gender-male')}</SelectItem>
                      <SelectItem value="F">{t('students.form.gender-female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t('students.detail.mgmt-info')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow label={t('students.detail.label-parent')} value={student.parentName ?? '—'} />
            <InfoRow label={t('students.detail.label-created-at')} value={new Date(student.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')} />
            {!editing ? (
              <>
                <InfoRow label={t('students.detail.label-status')} value={t(`students.status.${student.status}`, { defaultValue: student.status })} />
                <InfoRow label={t('students.detail.label-lifecycle')} value={t(`students.lifecycle.${student.lifecycleStatus}`, { defaultValue: student.lifecycleStatus })} />
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-status')}</label>
                  <Select value={form.status} onValueChange={(v) => v && setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('students.status.ACTIVE')}</SelectItem>
                      <SelectItem value="INACTIVE">{t('students.status.INACTIVE')}</SelectItem>
                      <SelectItem value="WITHDRAWN">{t('students.status.WITHDRAWN')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">{t('students.detail.label-lifecycle')}</label>
                  <Select value={form.lifecycleStatus} onValueChange={(v) => v && setForm({ ...form, lifecycleStatus: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONSULTING">{t('students.lifecycle.CONSULTING')}</SelectItem>
                      <SelectItem value="ENROLLED">{t('students.lifecycle.ENROLLED')}</SelectItem>
                      <SelectItem value="COMPLETED">{t('students.lifecycle.COMPLETED')}</SelectItem>
                      <SelectItem value="TERMINATED">{t('students.lifecycle.TERMINATED')}</SelectItem>
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
