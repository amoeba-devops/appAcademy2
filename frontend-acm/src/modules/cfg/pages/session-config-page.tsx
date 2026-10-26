import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Notice } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** PLN-261027 — 서비스 설정 > 로그인 유지 시간. */
interface SessionPolicy {
  hours: number;
  isDefault: boolean;
  defaultHours: number;
  maxHours: number;
  mobileDays: number;
  updatedAt: string | null;
  updatedByName: string | null;
}

export function SessionConfigPage() {
  const { t, i18n } = useTranslation('common');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['config-session'], queryFn: async () => (await apiClient.get<SessionPolicy>('/acm/config/session')).data });
  const [hours, setHours] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (q.data) setHours(String(q.data.hours));
  }, [q.data]);
  const max = q.data?.maxHours ?? 48;
  const save = useMutation({
    mutationFn: async () => (await apiClient.put<SessionPolicy>('/acm/config/session', { hours: Number(hours) })).data,
    onSuccess: (d) => {
      qc.setQueryData(['config-session'], d);
      setMsg({ ok: true, text: t('sessionConfig.saved') });
    },
    onError: () => setMsg({ ok: false, text: t('sessionConfig.failed', { max }) }),
  });
  const valid = /^\d+$/.test(hours) && Number(hours) >= 1 && Number(hours) <= max;
  const d = q.data;
  return (
    <div className="w-full min-w-0">
      <PageHeader icon={Timer} title={t('sessionConfig.title')} description={t('sessionConfig.desc')} back={{ to: '/admin/config', label: t('nav.config') }} />
      {d && (
        <div className="grid max-w-2xl gap-4">
          <Section title={t('sessionConfig.pc')}>
            <form
              className="grid gap-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setMsg(null);
                save.mutate();
              }}
            >
              <label className="flex flex-wrap items-center gap-2">
                <span className="w-36 text-secondary">{t('sessionConfig.hours')}</span>
                <Input type="number" inputMode="numeric" min={1} max={max} step={1} value={hours} onChange={(e) => setHours(e.target.value)} className="w-24 text-right tabular-nums" />
                <span>{t('sessionConfig.unit')}</span>
                <span className="text-xs text-secondary">({t('sessionConfig.range', { max })})</span>
              </label>
              <p className="text-xs text-secondary">{t('sessionConfig.pcHint', { default: d.defaultHours })}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                <span className="text-xs text-secondary">
                  {d.isDefault
                    ? t('sessionConfig.default', { hours: d.defaultHours })
                    : t('sessionConfig.lastChanged', {
                        date: d.updatedAt ? new Date(d.updatedAt).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' }) : '—',
                        name: d.updatedByName ?? '',
                      })}
                </span>
                <Button type="submit" disabled={!valid || save.isPending}>
                  {t('sessionConfig.save')}
                </Button>
              </div>
            </form>
          </Section>
          <Section title={t('sessionConfig.mobile')}>
            <p className="text-sm">{t('sessionConfig.mobileHint', { days: d.mobileDays })}</p>
          </Section>
          <Notice tone="info">{t('sessionConfig.applies')}</Notice>
          {msg && <Notice tone={msg.ok ? 'success' : 'error'}>{msg.text}</Notice>}
        </div>
      )}
      {q.isError && <p role="alert" className="text-sm text-red-600">{t('sessionConfig.failed', { max })}</p>}
    </div>
  );
}
