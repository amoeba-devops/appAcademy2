import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
}

interface FormInput {
  date: string;
  channel: 'PHONE' | 'EMAIL' | 'CHAT' | 'IN_PERSON' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  subject?: string;
  description?: string;
  linkedQnaId?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ComplaintDialog({ open, onOpenChange, yearMonth }: Props) {
  const { t } = useTranslation('dsh');
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm<FormInput>({
    defaultValues: { date: todayIso(), channel: 'PHONE', severity: 'MEDIUM' },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormInput) => {
      const body: Record<string, unknown> = { date: data.date, channel: data.channel };
      if (data.severity) body.severity = data.severity;
      if (data.subject) body.subject = data.subject;
      if (data.description) body.description = data.description;
      if (data.linkedQnaId) body.linkedQnaId = data.linkedQnaId;
      return apiClient.post(`/acm/dsh/complaints`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dsh', 'grid', yearMonth] });
      qc.invalidateQueries({ queryKey: ['dsh', 'complaints'] });
      reset({ date: todayIso(), channel: 'PHONE', severity: 'MEDIUM' });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset({ date: todayIso(), channel: 'PHONE', severity: 'MEDIUM' });
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('complaint.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div>
            <Label>{t('complaint.date')}</Label>
            <Input type="date" {...register('date', { required: true })} />
          </div>
          <div>
            <Label>{t('complaint.channel')}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              {...register('channel')}
            >
              {(['PHONE', 'EMAIL', 'CHAT', 'IN_PERSON', 'OTHER'] as const).map((c) => (
                <option key={c} value={c}>
                  {t(`complaint.channels.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t('complaint.severity')}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              {...register('severity')}
            >
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`complaint.severities.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t('complaint.subject')}</Label>
            <Input {...register('subject')} />
          </div>
          <div>
            <Label>{t('complaint.description')}</Label>
            <Input {...register('description')} />
          </div>
          <div>
            <Label>{t('complaint.linkedQnaId')}</Label>
            <Input {...register('linkedQnaId')} placeholder="UUID (optional)" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
