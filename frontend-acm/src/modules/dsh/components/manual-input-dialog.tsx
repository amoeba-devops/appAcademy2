import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  marketingVisitor?: number;
  marketingCost?: number;
  marketingEffect?: number;
  csComplain?: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE';
  visitorSource?: string;
  costSource?: string;
  note?: string;
}

interface ManualInputRow {
  id: string;
  date: string;
  marketingVisitor: number | null;
  marketingCost: string | null;
  marketingEffect: number | null;
  csComplain: number | null;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETE';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualInputDialog({ open, onOpenChange, yearMonth }: Props) {
  const { t } = useTranslation('dsh');
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset, setValue } = useForm<FormInput>({
    defaultValues: { date: todayIso(), status: 'PARTIAL' },
  });

  const date = watch('date');
  const existingQ = useQuery({
    enabled: open && !!date,
    queryKey: ['dsh', 'manual-input', date],
    queryFn: async () =>
      (await apiClient.get<ManualInputRow | null>(`/acm/dsh/manual-inputs/${date}`)).data,
  });

  useEffect(() => {
    if (existingQ.data) {
      setValue('marketingVisitor', existingQ.data.marketingVisitor ?? undefined);
      setValue(
        'marketingCost',
        existingQ.data.marketingCost ? Number(existingQ.data.marketingCost) : undefined,
      );
      setValue('marketingEffect', existingQ.data.marketingEffect ?? undefined);
      setValue('csComplain', existingQ.data.csComplain ?? undefined);
      setValue('status', existingQ.data.status);
    }
  }, [existingQ.data, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: FormInput) => {
      const { date: d, ...payload } = data;
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined && v !== '' && !Number.isNaN(v)) body[k] = v;
      }
      return apiClient.put(`/acm/dsh/manual-inputs/${d}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dsh', 'grid', yearMonth] });
      qc.invalidateQueries({ queryKey: ['dsh', 'manual-input'] });
      reset({ date: todayIso(), status: 'PARTIAL' });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset({ date: todayIso(), status: 'PARTIAL' });
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('manualInput.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <div>
            <Label>{t('manualInput.date')}</Label>
            <Input type="date" {...register('date', { required: true })} />
          </div>
          <fieldset className="border border-[var(--border-subtle)] rounded p-3 space-y-2">
            <legend className="px-1 text-sm font-medium">{t('category.MARKETING')}</legend>
            <div>
              <Label>{t('manualInput.visitor')}</Label>
              <Input type="number" min={0} {...register('marketingVisitor', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>{t('manualInput.cost')}</Label>
              <Input type="number" min={0} {...register('marketingCost', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>{t('manualInput.effect')}</Label>
              <Input type="number" min={0} {...register('marketingEffect', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>{t('manualInput.visitorSource')}</Label>
              <Input {...register('visitorSource')} placeholder="Naver Analytics" />
            </div>
            <div>
              <Label>{t('manualInput.costSource')}</Label>
              <Input {...register('costSource')} placeholder="Naver Ads" />
            </div>
          </fieldset>
          <fieldset className="border border-[var(--border-subtle)] rounded p-3 space-y-2">
            <legend className="px-1 text-sm font-medium">{t('category.CS')}</legend>
            <div>
              <Label>{t('manualInput.complain')}</Label>
              <Input type="number" min={0} {...register('csComplain', { valueAsNumber: true })} />
            </div>
          </fieldset>
          <div>
            <Label>{t('manualInput.status')}</Label>
            <select
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 text-sm"
              {...register('status')}
            >
              <option value="PENDING">{t('manualInput.statuses.PENDING')}</option>
              <option value="PARTIAL">{t('manualInput.statuses.PARTIAL')}</option>
              <option value="COMPLETE">{t('manualInput.statuses.COMPLETE')}</option>
            </select>
          </div>
          <div>
            <Label>{t('manualInput.note')}</Label>
            <Input {...register('note')} />
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
