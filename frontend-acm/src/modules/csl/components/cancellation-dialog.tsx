import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const REASON_CODES = [
  'ACADEMY_CANCELLED',
  'STUDENT_ILLNESS',
  'STUDENT_SCHEDULE_CHANGE',
  'PAYMENT_DECLINED',
  'LOST_TO_COMPETITOR',
  'OTHER',
] as const;

export function CancellationDialog({
  open,
  onOpenChange,
  inqId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inqId: string;
}) {
  const { t } = useTranslation(['csl', 'common']);
  const qc = useQueryClient();
  const [reasonCode, setReasonCode] =
    useState<(typeof REASON_CODES)[number]>('LOST_TO_COMPETITOR');
  const [reasonOther, setReasonOther] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setError(null);
      const res = await apiClient.post(`/acm/csl/inquiries/${inqId}/cancellations`, {
        reasonCode,
        reasonOther: reasonOther || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['csl'] });
      setReasonOther('');
      onOpenChange(false);
    },
    onError: (e: { response?: { data?: { message?: string } }; message?: string }) =>
      setError(e.response?.data?.message ?? e.message ?? 'Drop failed'),
  });

  const requiresOther = reasonCode === 'OTHER';
  const canSubmit = !requiresOther || reasonOther.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('detail.cancel.title')}</DialogTitle>
          <DialogDescription>{t('detail.cancel.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">{t('detail.cancel.reasonCode')}</Label>
            <select
              value={reasonCode}
              onChange={(e) =>
                setReasonCode(e.target.value as (typeof REASON_CODES)[number])
              }
              className="h-9 w-full rounded-md border border-[var(--border-subtle)] bg-transparent px-3 text-sm"
            >
              {REASON_CODES.map((c) => (
                <option key={c} value={c}>
                  {t(`detail.cancel.reason.${c}`)}
                </option>
              ))}
            </select>
          </div>
          {requiresOther && (
            <div className="grid gap-1">
              <Label className="text-xs">{t('detail.cancel.reasonOther')}</Label>
              <Input
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder={t('detail.cancel.reasonOtherPlaceholder')}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? t('common:actions.saving') : t('detail.drop')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
