import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { UnderlineTabs } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorCode } from '@/modules/auth/components/temp-password';
import { RegisteredUsers } from './registered-users';
import { inviteApi, type InviteRole, type InviteSendResult, type InviteStatus } from './invite-api';

const FILTERS: (InviteStatus | '')[] = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED', ''];
const BADGE: Record<InviteStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-700',
  REVOKED: 'bg-gray-100 text-gray-700',
};

type PageTab = 'users' | 'invites';

/** REQ-261018 / 261018B — /admin/config/invites 사용자 초대 + 등록 사용자(서비스 운영자). */
export function InvitesPage() {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: PageTab = params.get('tab') === 'invites' ? 'invites' : 'users';
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<InviteSendResult | null>(null);
  return (
    <div className="grid w-full min-w-0 gap-4">
      <PageHeader
        back={{ to: '/admin/config', label: t('nav.config') }}
        icon={UserPlus}
        title={t('invite.title')}
        description={t('invite.cardDescription')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus size={16} className="mr-1.5" />
            {t('invite.new')}
          </Button>
        }
        tabs={
          <UnderlineTabs
            items={(['users', 'invites'] as const).map((k) => ({ key: k, label: t(`invite.tabs.${k}`) }))}
            value={tab}
            onChange={(k) => setParams(k === 'users' ? {} : { tab: k })}
          />
        }
      />
      {tab === 'users' ? <RegisteredUsers /> : <InviteHistory />}
      {creating && (
        <CreateInviteDialog
          close={() => setCreating(false)}
          done={(r) => {
            setCreating(false);
            setResult(r);
            void qc.invalidateQueries({ queryKey: ['invites'] });
          }}
        />
      )}
      {result && <InviteResultDialog result={result} close={() => setResult(null)} />}
    </div>
  );
}

/** REQ-261018 — 초대 내역 탭. */
function InviteHistory() {
  const { t, i18n } = useTranslation('common');
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [status, setStatus] = useState<InviteStatus | ''>('PENDING');
  const [result, setResult] = useState<InviteSendResult | null>(null);
  const [error, setError] = useState('');
  const list = useQuery({
    queryKey: ['invites', status],
    queryFn: () => inviteApi.list(status || undefined),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['invites'] });
  const fail = (err: unknown) =>
    setError(errorCode(err) === 'INVITE_HANDLED' ? t('invite.errors.handled') : t('invite.errors.failed'));
  const resend = useMutation({
    mutationFn: inviteApi.resend,
    onSuccess: (r) => {
      setResult(r);
      void refresh();
    },
    onError: fail,
  });
  const revoke = useMutation({ mutationFn: inviteApi.revoke, onSuccess: () => void refresh(), onError: fail });
  const fmt = (v: string) => new Date(v).toLocaleString(i18n.language);
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm text-secondary">{t('invite.description')}</p>
      <div role="tablist" className="flex flex-wrap gap-1">
        {FILTERS.map((s) => (
          <button
            key={s || 'ALL'}
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`min-h-9 rounded-full border px-3 py-1 text-xs sm:min-h-0 ${
              status === s ? 'border-accent-700 bg-accent-700 text-white' : 'bg-surface text-secondary'
            }`}
          >
            {t(`invite.status.${s || 'ALL'}`)}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {list.isLoading && <p role="status">{t('invite.loading')}</p>}
      {list.isError && <p role="alert">{t('invite.errors.load')}</p>}
      {list.data?.length === 0 && (
        <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('invite.empty')}</p>
      )}
      {!!list.data?.length && (
        <ul className="grid gap-2">
          {list.data.map((r) => (
            <li key={r.inv_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-3 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.inv_name}</span>
                  <span className="truncate text-secondary">{r.inv_email}</span>
                  <span className="rounded bg-accent-50 px-1.5 py-0.5 text-xs text-accent-700">{t(`invite.roles.${r.inv_role}`)}</span>
                  {r.inv_grant_config_admin && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">{t('invite.configAdmin')}</span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-xs ${BADGE[r.inv_status]}`}>{t(`invite.status.${r.inv_status}`)}</span>
                </div>
                <p className="mt-1 text-xs text-secondary">
                  {t('invite.invitedBy', { by: r.invited_by_name ?? '—', at: fmt(r.created_at) })}
                  {' · '}
                  {r.inv_status === 'ACCEPTED' && r.accepted_at
                    ? t('invite.acceptedAt', { at: fmt(r.accepted_at) })
                    : t('invite.expiresAt', { at: fmt(r.inv_expires_at) })}
                </p>
              </div>
              {(r.inv_status === 'PENDING' || r.inv_status === 'EXPIRED') && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => { setError(''); resend.mutate(r.inv_id); }}>
                    {t('invite.resend')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={async () => {
                      setError('');
                      if (await confirm({ title: t('invite.revokeTitle'), description: t('invite.revokeDesc'), confirmLabel: t('invite.revoke'), variant: 'destructive' }))
                        revoke.mutate(r.inv_id);
                    }}
                  >
                    {t('invite.revoke')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {result && <InviteResultDialog result={result} close={() => setResult(null)} />}
    </div>
  );
}

function CreateInviteDialog({ close, done }: { close: () => void; done: (r: InviteSendResult) => void }) {
  const { t } = useTranslation('common');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<InviteRole>('STAFF');
  const [grant, setGrant] = useState(false);
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: inviteApi.create,
    onSuccess: done,
    onError: (err) =>
      setError(errorCode(err) === 'INVITE_USER_EXISTS' ? t('invite.errors.exists') : t('invite.errors.failed')),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('invite.errors.email'));
    if (!name.trim()) return setError(t('invite.errors.name'));
    setError('');
    create.mutate({ email: email.trim(), name: name.trim(), role, grantConfigAdmin: grant });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !create.isPending && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('invite.new')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 text-sm" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-email">{t('invite.fields.email')}</Label>
            <Input id="inv-email" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-name">{t('invite.fields.name')}</Label>
            <Input id="inv-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-medium">{t('invite.fields.role')}</legend>
            <div className="flex gap-4">
              {(['ADMIN', 'STAFF'] as const).map((r) => (
                <label key={r} className="inline-flex items-center gap-1.5">
                  <input type="radio" name="inv-role" checked={role === r} onChange={() => setRole(r)} />
                  {t(`invite.roles.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="inline-flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={grant} onChange={(e) => setGrant(e.target.checked)} />
            <span>
              {t('invite.fields.grantConfigAdmin')}
              <span className="block text-xs text-secondary">{t('invite.fields.grantConfigAdminHint')}</span>
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={create.isPending} onClick={close}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('invite.sending') : t('invite.send')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteResultDialog({ result, close }: { result: InviteSendResult; close: () => void }) {
  const { t, i18n } = useTranslation('common');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!result.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('invite.resultTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {result.mailSent ? (
            <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800">
              {t('invite.mailSent')}
            </p>
          ) : (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{t('invite.mailNotSent')}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-md border bg-canvas px-3 py-2 text-xs">{result.inviteUrl}</code>
                <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t('invite.copy')}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <p className="text-xs text-secondary">{t('invite.onceOnly')}</p>
            </>
          )}
          <p className="text-xs text-secondary">
            {t('invite.validUntil', { until: new Date(result.expiresAt).toLocaleString(i18n.language) })}
          </p>
          <div className="flex justify-end">
            <Button onClick={close}>{t('actions.close')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
