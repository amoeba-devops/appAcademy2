'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useProgram, useUpdateProgram } from '@/hooks/use-programs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  PUBLISHED: 'default',
  ARCHIVED: 'outline',
};

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data: program, isLoading } = useProgram(id);
  const updateProgram = useUpdateProgram();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">{t('programs.detail.loading')}</div>;
  }

  if (!program) {
    return <div className="text-center py-12 text-muted-foreground">{t('programs.detail.not-found')}</div>;
  }

  const startEditing = () => {
    setForm({
      name: program.name,
      category: program.category,
      description: program.description ?? '',
      durationWeeks: program.durationWeeks?.toString() ?? '',
      targetAgeMin: program.targetAgeMin?.toString() ?? '',
      targetAgeMax: program.targetAgeMax?.toString() ?? '',
      level: program.level ?? '',
      feeAmount: program.setting?.feeAmount ?? '',
      capacityMax: program.setting?.capacityMax?.toString() ?? '',
      sessionCount: program.setting?.sessionCount?.toString() ?? '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    await updateProgram.mutateAsync({
      id,
      data: {
        name: form.name,
        category: form.category,
        description: form.description || undefined,
        durationWeeks: form.durationWeeks ? parseInt(form.durationWeeks) : undefined,
        targetAgeMin: form.targetAgeMin ? parseInt(form.targetAgeMin) : undefined,
        targetAgeMax: form.targetAgeMax ? parseInt(form.targetAgeMax) : undefined,
        level: form.level || undefined,
        setting: {
          feeAmount: form.feeAmount || undefined,
          capacityMax: form.capacityMax ? parseInt(form.capacityMax) : undefined,
          sessionCount: form.sessionCount ? parseInt(form.sessionCount) : undefined,
        },
      },
    });
    setEditing(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateProgram.mutateAsync({
      id,
      data: { status: newStatus },
    });
  };

  const variant = STATUS_VARIANT[program.status] ?? ('secondary' as const);
  const statusLabel = t(`programs.status.${program.status}`, { defaultValue: program.status });
  const categoryLabel = t(`programs.category.${program.category}`, { defaultValue: program.category });
  const levelLabel = program.level ? t(`programs.level.${program.level}`, { defaultValue: program.level }) : '-';
  const lng = i18n.resolvedLanguage ?? 'ko';
  const unk = t('programs.detail.target-age-unknown');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/program-mgmt')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0E1E3A]">{program.name}</h1>
          <p className="text-sm text-muted-foreground">
            {categoryLabel}
            {program.level ? ` · ${levelLabel}` : ''}
          </p>
        </div>
        <Badge variant={variant} className="text-sm px-3 py-1">
          {statusLabel}
        </Badge>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Pencil className="h-4 w-4 mr-1" />
            {t('programs.detail.edit')}
          </Button>
        )}
      </div>

      {/* Status Actions */}
      <div className="flex gap-2">
        {program.status === 'DRAFT' && (
          <Button size="sm" onClick={() => handleStatusChange('ACTIVE')}>
            {t('programs.detail.action-activate')}
          </Button>
        )}
        {program.status === 'ACTIVE' && (
          <Button size="sm" onClick={() => handleStatusChange('PUBLISHED')}>
            {t('programs.detail.action-publish')}
          </Button>
        )}
        {(program.status === 'ACTIVE' || program.status === 'PUBLISHED') && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange('ARCHIVED')}>
            {t('programs.detail.action-archive')}
          </Button>
        )}
        {program.status === 'ARCHIVED' && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange('DRAFT')}>
            {t('programs.detail.action-to-draft')}
          </Button>
        )}
      </div>

      {/* Info Grid */}
      {editing ? (
        <div className="border rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>{t('programs.detail.label-name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.detail.label-category')}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => v && setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENGLISH">{t('programs.category.ENGLISH')}</SelectItem>
                  <SelectItem value="MATH">{t('programs.category.MATH')}</SelectItem>
                  <SelectItem value="SCIENCE">{t('programs.category.SCIENCE')}</SelectItem>
                  <SelectItem value="OTHER">{t('programs.category.OTHER')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('programs.detail.label-level')}</Label>
              <Select
                value={form.level}
                onValueChange={(v) => v && setForm({ ...form, level: v === 'NONE' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder={t('programs.form.level-placeholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">{t('programs.form.level-none')}</SelectItem>
                  <SelectItem value="BEGINNER">{t('programs.level.BEGINNER')}</SelectItem>
                  <SelectItem value="INTERMEDIATE">{t('programs.level.INTERMEDIATE')}</SelectItem>
                  <SelectItem value="ADVANCED">{t('programs.level.ADVANCED')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('programs.form.duration-weeks')}</Label>
              <Input
                type="number" min="1"
                value={form.durationWeeks}
                onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.form.fee')}</Label>
              <Input
                type="number" min="0"
                value={form.feeAmount}
                onChange={(e) => setForm({ ...form, feeAmount: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.form.age-min')}</Label>
              <Input
                type="number" min="1" max="99"
                value={form.targetAgeMin}
                onChange={(e) => setForm({ ...form, targetAgeMin: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.form.age-max')}</Label>
              <Input
                type="number" min="1" max="99"
                value={form.targetAgeMax}
                onChange={(e) => setForm({ ...form, targetAgeMax: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.form.capacity')}</Label>
              <Input
                type="number" min="1"
                value={form.capacityMax}
                onChange={(e) => setForm({ ...form, capacityMax: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('programs.form.session-count')}</Label>
              <Input
                type="number" min="1"
                value={form.sessionCount}
                onChange={(e) => setForm({ ...form, sessionCount: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>{t('programs.form.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 mr-1" /> {t('programs.detail.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateProgram.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {updateProgram.isPending ? t('programs.detail.saving') : t('programs.detail.save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Info */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('programs.detail.basic-info')}</h2>
            <InfoRow label={t('programs.detail.label-name')} value={program.name} />
            <InfoRow label={t('programs.detail.label-category')} value={categoryLabel} />
            <InfoRow label={t('programs.detail.label-level')} value={levelLabel} />
            <InfoRow label={t('programs.detail.label-duration')} value={program.durationWeeks ? t('programs.weeks-suffix', { weeks: program.durationWeeks }) : '-'} />
            <InfoRow
              label={t('programs.detail.label-target-age')}
              value={
                program.targetAgeMin || program.targetAgeMax
                  ? t('programs.detail.target-age-range', {
                      min: program.targetAgeMin ?? unk,
                      max: program.targetAgeMax ?? unk,
                    })
                  : '-'
              }
            />
            {program.description && (
              <div>
                <p className="text-sm text-muted-foreground">{t('programs.detail.label-description')}</p>
                <p className="text-sm whitespace-pre-wrap">{program.description}</p>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#0E1E3A]">{t('programs.detail.settings-info')}</h2>
            <InfoRow
              label={t('programs.detail.label-fee')}
              value={
                program.setting?.feeAmount
                  ? t('programs.fee-krw', { amount: Number(program.setting.feeAmount).toLocaleString() })
                  : '-'
              }
            />
            <InfoRow label={t('programs.detail.label-capacity')} value={program.setting?.capacityMax ? t('programs.detail.capacity-suffix', { count: program.setting.capacityMax }) : '-'} />
            <InfoRow label={t('programs.detail.label-session-count')} value={program.setting?.sessionCount ? t('programs.detail.sessions-suffix', { count: program.setting.sessionCount }) : '-'} />
            <InfoRow
              label={t('programs.detail.label-created-at')}
              value={new Date(program.createdAt).toLocaleDateString(lng)}
            />
            <InfoRow
              label={t('programs.detail.label-updated-at')}
              value={new Date(program.updatedAt).toLocaleDateString(lng)}
            />
          </div>
        </div>
      )}
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
