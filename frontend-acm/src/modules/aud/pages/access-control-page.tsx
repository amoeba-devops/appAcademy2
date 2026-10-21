import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { auditApi, type AuditPolicyInput, type LockedAccount } from '../api/audit-api';
import { Section } from '@/components/ui/section';
import { Notice } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { useConfigAccess } from '@/modules/cfg/hooks/use-config-access';

const numCls = 'w-[84px] text-right tabular-nums';

/** REQ-261021B — 감사 > 접속 통제 (P1: 로그인 실패 잠금 · 잠긴 계정). 변경은 테넌트 마스터만. */
export function AccessControlPage() {
  const { t, i18n } = useTranslation('aud');
  const qc = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const canEdit = useConfigAccess().tenantAllowed;
  const policy = useQuery({ queryKey: ['aud', 'policy'], queryFn: auditApi.policy });
  const locked = useQuery({ queryKey: ['aud', 'locked'], queryFn: auditApi.lockedAccounts, refetchInterval: 30_000 });
  const [form, setForm] = useState<AuditPolicyInput | null>(null);
  const [timed, setTimed] = useState(true);
  const [lastTimedMinutes, setLastTimedMinutes] = useState(5);

  useEffect(() => {
    if (!policy.data) return;
    const { failMax, lockMinutes, ipFailMax, ipWindowMinutes, ipBlockMinutes } = policy.data;
    setForm({ failMax, lockMinutes, ipFailMax, ipWindowMinutes, ipBlockMinutes });
    setTimed(lockMinutes > 0);
    if (lockMinutes > 0) setLastTimedMinutes(lockMinutes);
  }, [policy.data]);

  const save = useMutation({
    mutationFn: (v: AuditPolicyInput) => auditApi.savePolicy(v),
    onSuccess: () => {
      toast.success(t('control.lockout.saved'));
      void qc.invalidateQueries({ queryKey: ['aud'] });
    },
    onError: () => toast.error(t('control.lockout.saveFailed')),
  });
  const unlock = useMutation({
    mutationFn: (a: LockedAccount) => auditApi.unlock(a),
    onSuccess: () => {
      toast.success(t('control.locked.unlocked'));
      void qc.invalidateQueries({ queryKey: ['aud'] });
    },
    onError: () => toast.error(t('control.locked.unlockFailed')),
  });

  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString(i18n.language, { timeZone: 'Asia/Seoul' }) : '—');
  const label = (a: LockedAccount) => a.name ?? a.loginId ?? '—';
  const num = (k: keyof AuditPolicyInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: Number(e.target.value) } : f));
  const onUnlock = async (a: LockedAccount) => {
    if (await confirm({ title: t('control.locked.unlockConfirm', { name: label(a) }), confirmLabel: t('control.locked.unlock') }))
      unlock.mutate(a);
  };

  return (
    <div className="grid min-w-0 gap-4">
      {!canEdit && <Notice tone="info">{t('control.lockout.readOnly')}</Notice>}

      <Section title={t('control.lockout.title')} description={t('control.lockout.desc')}>
        {form && (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ ...form, lockMinutes: timed ? form.lockMinutes : 0 });
            }}
          >
            <fieldset disabled={!canEdit} className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 text-secondary">{t('control.lockout.failMax')}</span>
                <Input type="number" min={3} max={20} required value={form.failMax} onChange={num('failMax')} className={numCls} />
                <span>{t('control.lockout.times')}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="w-28 text-secondary">{t('control.lockout.lockFor')}</span>
                <label className="inline-flex min-h-9 items-center gap-2">
                  <input
                    type="radio"
                    name="lock-mode"
                    checked={timed}
                    onChange={() => {
                      setTimed(true);
                      setForm((f) => (f ? { ...f, lockMinutes: lastTimedMinutes } : f));
                    }}
                  />
                  {t('control.lockout.timed')}
                </label>
                <span className="inline-flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    required={timed}
                    disabled={!timed}
                    value={timed ? form.lockMinutes : lastTimedMinutes}
                    onChange={(e) => {
                      setLastTimedMinutes(Number(e.target.value));
                      num('lockMinutes')(e);
                    }}
                    className={numCls}
                  />
                  {t('control.lockout.minutes')}
                </span>
                <label className="inline-flex min-h-9 items-center gap-2">
                  <input type="radio" name="lock-mode" checked={!timed} onChange={() => setTimed(false)} />
                  {t('control.lockout.untilAdmin')}
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 text-secondary">{t('control.lockout.ipTitle')}</span>
                <Input type="number" min={1} max={1440} required value={form.ipWindowMinutes} onChange={num('ipWindowMinutes')} className={numCls} />
                <span>{t('control.lockout.ipWindow')}</span>
                <Input type="number" min={5} max={200} required value={form.ipFailMax} onChange={num('ipFailMax')} className={numCls} />
                <span>{t('control.lockout.times')} →</span>
                <span className="text-secondary">{t('control.lockout.ipBlock')}</span>
                <Input type="number" min={1} max={1440} required value={form.ipBlockMinutes} onChange={num('ipBlockMinutes')} className={numCls} />
                <span>{t('control.lockout.minutes')}</span>
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
              <span className="text-xs text-secondary">
                {policy.data?.updatedAt
                  ? t('control.lockout.lastChanged', { date: fmt(policy.data.updatedAt), name: policy.data.updatedByName ?? '' })
                  : t('control.lockout.neverChanged')}
              </span>
              {canEdit && (
                <Button type="submit" disabled={save.isPending}>
                  {t('control.lockout.save')}
                </Button>
              )}
            </div>
          </form>
        )}
      </Section>

      <Section title={t('control.locked.title')} bodyClassName="p-0">
        {locked.data && locked.data.length === 0 && <p className="p-4 text-sm text-secondary sm:p-5">{t('control.locked.empty')}</p>}
        {locked.data && locked.data.length > 0 && (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {locked.data.map((a) => (
              <li key={`${a.kind}:${a.actorId ?? a.failureId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{label(a)}</span>
                  <span className="ml-1 text-xs text-secondary">
                    {[t(`kind.${a.kind}`), a.role ? t(`role.${a.role}`, { defaultValue: a.role }) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="text-xs text-secondary">
                  {t(`control.locked.${a.reason}`)} · {t('control.locked.lockedAt')} {fmt(a.lockedAt)} ·{' '}
                  {a.lockedUntil ? `${t('control.locked.until')} ${fmt(a.lockedUntil)}` : t('control.locked.noEnd')}
                </span>
                {canEdit && (
                  <Button size="sm" variant="outline" disabled={unlock.isPending} onClick={() => void onUnlock(a)}>
                    {t('control.locked.unlock')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('control.later.title')}>
        <p className="text-sm text-secondary">{t('control.later.body')}</p>
      </Section>
    </div>
  );
}
