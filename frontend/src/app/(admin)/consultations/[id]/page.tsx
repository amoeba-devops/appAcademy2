'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useConsultationDetail,
  useUpdateConsultation,
  useUpdateConsultationStatus,
  useCreateVisitRecord,
} from '@/hooks/use-consultations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Calendar, CheckCircle } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-500',
  FOLLOW_UP: 'bg-yellow-500',
  CONVERTED: 'bg-green-500',
  LOST: 'bg-gray-400',
};

export default function ConsultationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { t, i18n } = useTranslation('admin');
  const { data, isLoading } = useConsultationDetail(id);
  const updateConsultation = useUpdateConsultation();
  const updateStatus = useUpdateConsultationStatus();
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('consultations.detail.loading')}</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">{t('consultations.detail.not-found')}</div>;

  const { consultation: c, visits } = data;
  const statusLabel = t(`consultations.columns.${c.status}`, { defaultValue: c.status });
  const statusColor = STATUS_COLORS[c.status] ?? 'bg-gray-500';

  const handleSaveNote = async () => {
    await updateConsultation.mutateAsync({ id: c.id, data: { note: noteValue } });
    setEditingNote(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/consultations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-[#0E1E3A]">
          {t('consultations.detail.title', {
            id: c.id,
            name: c.parentName ?? t('consultations.detail.parent-unassigned'),
          })}
        </h1>
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusColor}`} />
        <Badge variant="outline">{statusLabel}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info */}
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('consultations.detail.info-title')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label={t('consultations.detail.info-parent')} value={c.parentName ?? '—'} />
            <InfoRow label={t('consultations.detail.info-channel')} value={t(`consultations.channel.${c.channel}`, { defaultValue: c.channel })} />
            <InfoRow label={t('consultations.detail.info-status')} value={statusLabel} />
            <InfoRow label={t('consultations.detail.info-visit-count')} value={t('consultations.detail.info-visit-count-value', { count: c.visitCount })} />
            <InfoRow label={t('consultations.detail.info-created-at')} value={new Date(c.createdAt).toLocaleString(i18n.resolvedLanguage ?? 'ko')} />

            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">{t('consultations.detail.memo-label')}</span>
                {!editingNote && (
                  <Button variant="ghost" size="sm" onClick={() => { setNoteValue(c.note ?? ''); setEditingNote(true); }}>
                    {t('consultations.detail.memo-edit')}
                  </Button>
                )}
              </div>
              {editingNote ? (
                <div className="space-y-2">
                  <Input value={noteValue} onChange={(e) => setNoteValue(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNote} disabled={updateConsultation.isPending}>{t('consultations.detail.memo-save')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingNote(false)}>{t('consultations.detail.memo-cancel')}</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm">{c.note || '—'}</p>
              )}
            </div>

            {/* Status actions */}
            {c.status !== 'CONVERTED' && (
              <div className="pt-3 flex gap-2 flex-wrap">
                {c.status === 'OPEN' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'FOLLOW_UP' })}>{t('consultations.detail.action-to-follow-up')}</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'CONVERTED' })}>{t('consultations.detail.action-to-converted')}</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'LOST' })}>{t('consultations.detail.action-to-lost')}</Button>
                  </>
                )}
                {c.status === 'FOLLOW_UP' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'CONVERTED' })}>{t('consultations.detail.action-to-converted')}</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'LOST' })}>{t('consultations.detail.action-to-lost')}</Button>
                  </>
                )}
                {c.status === 'LOST' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: 'OPEN' })}>{t('consultations.detail.action-reopen')}</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visit Records */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{t('consultations.detail.visits-title')}</CardTitle>
              <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
                <DialogTrigger
                  className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Plus className="h-3 w-3" />
                  {t('consultations.detail.visit-add')}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t('consultations.detail.visit-add-title')}</DialogTitle></DialogHeader>
                  <CreateVisitForm consultationId={c.id} onSuccess={() => setVisitDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('consultations.detail.visits-empty')}</p>
            ) : (
              <div className="space-y-3">
                {visits.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="mt-0.5">
                      {v.visitedAt ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">
                          {v.visitedAt
                            ? t('consultations.detail.visit-visited', { when: new Date(v.visitedAt).toLocaleString(i18n.resolvedLanguage ?? 'ko') })
                            : v.scheduledAt
                              ? t('consultations.detail.visit-scheduled', { when: new Date(v.scheduledAt).toLocaleString(i18n.resolvedLanguage ?? 'ko') })
                              : t('consultations.detail.visit-planned')}
                        </span>
                        {v.outcome && (
                          <Badge variant="outline" className="text-xs">{v.outcome}</Badge>
                        )}
                      </div>
                      {v.memo && <p className="text-xs text-muted-foreground">{v.memo}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreateVisitForm({ consultationId, onSuccess }: { consultationId: number; onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const createVisit = useCreateVisitRecord();
  const [scheduledAt, setScheduledAt] = useState('');
  const [visitedAt, setVisitedAt] = useState('');
  const [outcome, setOutcome] = useState('');
  const [memo, setMemo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createVisit.mutateAsync({
      consultationId,
      data: {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        visitedAt: visitedAt ? new Date(visitedAt).toISOString() : undefined,
        outcome: outcome || undefined,
        memo: memo || undefined,
      },
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.detail.visit-form.scheduled-at')}</label>
        <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.detail.visit-form.visited-at')}</label>
        <Input type="datetime-local" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.detail.visit-form.outcome')}</label>
        <Select value={outcome} onValueChange={(v) => v && setOutcome(v)}>
          <SelectTrigger><SelectValue placeholder={t('consultations.detail.visit-form.outcome-placeholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="POSITIVE">{t('consultations.detail.visit-form.outcome-positive')}</SelectItem>
            <SelectItem value="NEUTRAL">{t('consultations.detail.visit-form.outcome-neutral')}</SelectItem>
            <SelectItem value="NEGATIVE">{t('consultations.detail.visit-form.outcome-negative')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.detail.visit-form.memo')}</label>
        <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={createVisit.isPending}>
        {createVisit.isPending ? t('consultations.detail.visit-form.submitting') : t('consultations.detail.visit-form.submit')}
      </Button>
    </form>
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
