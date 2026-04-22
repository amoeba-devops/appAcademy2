'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useConsultations,
  useCreateConsultation,
  useUpdateConsultationStatus,
} from '@/hooks/use-consultations';
import { useParents } from '@/hooks/use-students';
import type { Consultation } from '@/types/consultation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus, Search, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const COLUMN_KEYS = [
  { key: 'OPEN', color: 'bg-blue-500' },
  { key: 'FOLLOW_UP', color: 'bg-yellow-500' },
  { key: 'CONVERTED', color: 'bg-green-500' },
  { key: 'LOST', color: 'bg-gray-400' },
] as const;

const NEXT_STATUS: Record<string, string[]> = {
  OPEN: ['FOLLOW_UP', 'CONVERTED', 'LOST'],
  FOLLOW_UP: ['CONVERTED', 'LOST'],
  LOST: ['OPEN'],
  CONVERTED: [],
};

export default function ConsultationsPage() {
  const { t } = useTranslation('admin');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: consultations = [], isLoading } = useConsultations({
    search: search || undefined,
  });

  const grouped = COLUMN_KEYS.map((col) => ({
    ...col,
    label: t(`consultations.columns.${col.key}`),
    items: consultations.filter((c) => c.status === col.key),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0E1E3A]">{t('consultations.title')}</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('consultations.search-placeholder')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
              className="w-[200px]"
            />
            <Button variant="outline" size="icon" onClick={() => setSearch(searchInput)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t('consultations.new')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('consultations.new')}</DialogTitle>
              </DialogHeader>
              <CreateConsultationForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">{t('consultations.loading')}</div>
      ) : (
        <div className="grid grid-cols-4 gap-4 min-h-[60vh]">
          {grouped.map((col) => (
            <div key={col.key} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                <span className="font-semibold text-sm">{col.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {col.items.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {col.items.map((item) => (
                  <ConsultationCard key={item.id} consultation={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConsultationCard({ consultation: c }: { consultation: Consultation }) {
  const { t, i18n } = useTranslation('admin');
  const updateStatus = useUpdateConsultationStatus();
  const nextStatuses = NEXT_STATUS[c.status] ?? [];

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">{c.parentName ?? t('consultations.unassigned')}</p>
            <p className="text-xs text-muted-foreground">
              {t(`consultations.channel.${c.channel}`, { defaultValue: c.channel })}
            </p>
          </div>
          <Link href={`/admin/consultations/${c.id}`}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        {c.note && (
          <p className="text-xs text-muted-foreground line-clamp-2">{c.note}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t('consultations.visit-count', { count: c.visitCount })}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(c.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}
          </span>
        </div>
        {nextStatuses.length > 0 && (
          <div className="flex gap-1 pt-1">
            {nextStatuses.map((ns) => (
              <Button
                key={ns}
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: c.id, status: ns })}
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                {t(`consultations.columns.${ns}`, { defaultValue: ns })}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateConsultationForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation('admin');
  const { data: parents = [] } = useParents();
  const createConsultation = useCreateConsultation();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [parentId, setParentId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [channel, setChannel] = useState('PHONE');
  const [note, setNote] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createConsultation.mutateAsync({
      ...(mode === 'existing' ? { parentId: Number(parentId) } : { parentName, parentPhone: parentPhone || undefined }),
      channel,
      note: note || undefined,
    });
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'existing' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('existing')}
        >
          {t('consultations.form.existing-parent')}
        </Button>
        <Button
          type="button"
          variant={mode === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('new')}
        >
          {t('consultations.form.new-parent')}
        </Button>
      </div>

      {mode === 'existing' ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('consultations.form.parent-select')}</label>
          <Select value={parentId} onValueChange={(v) => v && setParentId(v)}>
            <SelectTrigger><SelectValue placeholder={t('consultations.form.parent-select-placeholder')} /></SelectTrigger>
            <SelectContent>
              {parents.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('consultations.form.parent-name')}</label>
            <Input value={parentName} onChange={(e) => setParentName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('consultations.form.parent-phone')}</label>
            <Input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="010-0000-0000" />
          </div>
        </>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.form.channel-label')}</label>
        <Select value={channel} onValueChange={(v) => v && setChannel(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PHONE">{t('consultations.channel.PHONE')}</SelectItem>
            <SelectItem value="WALK_IN">{t('consultations.channel.WALK_IN')}</SelectItem>
            <SelectItem value="WEBSITE">{t('consultations.channel.WEBSITE')}</SelectItem>
            <SelectItem value="REFERRAL">{t('consultations.channel.REFERRAL')}</SelectItem>
            <SelectItem value="OTHER">{t('consultations.channel.OTHER')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">{t('consultations.form.note-label')}</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('consultations.form.note-placeholder')} />
      </div>

      <Button type="submit" className="w-full" disabled={createConsultation.isPending}>
        {createConsultation.isPending ? t('consultations.form.submitting') : t('consultations.form.submit')}
      </Button>
    </form>
  );
}
