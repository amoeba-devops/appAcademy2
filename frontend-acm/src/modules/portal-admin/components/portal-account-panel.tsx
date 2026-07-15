import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, KeyRound, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  usePortalAccount,
  useIssuePortalAccount,
  useResetPortalAccount,
  useResetPortalLoginId,
  type PortalCredential,
  type PortalKind,
} from '../hooks/use-portal-account';

/**
 * PLN-260706 §4.6 — admin panel to issue / reset a portal login account for a
 * student / parent / teacher. The temp password is shown ONCE after issue/reset
 * for hand-over (never re-displayable).
 */
export function PortalAccountPanel({
  kind,
  refId,
  issueDisabled = false,
  issueDisabledNote,
}: {
  kind: PortalKind;
  refId: string;
  /** PLN-260714 — STUDENT 계정은 이메일이 있어야 발급 가능. */
  issueDisabled?: boolean;
  issueDisabledNote?: string;
}) {
  const { t } = useTranslation('common');
  const { data: account, isLoading } = usePortalAccount(kind, refId);
  const issue = useIssuePortalAccount();
  const reset = useResetPortalAccount(kind, refId);
  const resetLoginId = useResetPortalLoginId(kind, refId);
  const [cred, setCred] = useState<PortalCredential | null>(null);
  const [error, setError] = useState<string | null>(null);
  // PLN-260716 — 관리자가 비밀번호를 직접 지정(비우면 자동 생성).
  const [pw, setPw] = useState('');

  const busy = issue.isPending || reset.isPending || resetLoginId.isPending;

  const onIssue = async () => {
    setError(null);
    try {
      const c = await issue.mutateAsync({ kind, refId, password: pw || undefined });
      setCred(c);
      setPw('');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? '발급에 실패했습니다.');
    }
  };
  const onReset = async () => {
    if (!account) return;
    setError(null);
    try {
      const c = await reset.mutateAsync({ id: account.id, password: pw || undefined });
      setCred(c);
      setPw('');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? '재설정에 실패했습니다.');
    }
  };
  const onResetLoginId = async () => {
    if (!account) return;
    setError(null);
    try {
      await resetLoginId.mutateAsync(account.id);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message ?? err.message ?? '로그인ID 변경에 실패했습니다.');
    }
  };

  const pwInput = (
    <input
      type="text"
      value={pw}
      onChange={(e) => setPw(e.target.value)}
      placeholder={t('portalAccount.passwordPlaceholder', '비밀번호 (비우면 자동생성)')}
      className="h-8 w-56 rounded-md border border-[var(--border-subtle)] bg-canvas px-2 text-sm"
    />
  );

  return (
    <div className="space-y-3">
      {isLoading ? (
        <p className="text-sm text-secondary">
          <Loader2 className="inline h-4 w-4 animate-spin" />
        </p>
      ) : account ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <Field label={t('portalAccount.loginId')} value={account.loginId} mono />
          <Field
            label={t('portalAccount.status')}
            value={
              account.lockedAt
                ? t('portalAccount.statusLocked')
                : account.status === 'ACTIVE'
                  ? t('portalAccount.statusActive')
                  : account.status
            }
          />
          <Field
            label={t('portalAccount.lastLogin')}
            value={
              account.lastLoginAt
                ? new Date(account.lastLoginAt).toLocaleString()
                : t('portalAccount.never')
            }
          />
          <div className="col-span-full flex flex-wrap items-center gap-2">
            {pwInput}
            <Button size="sm" variant="outline" onClick={onReset} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="mr-1 h-3.5 w-3.5" />
              )}
              {t('portalAccount.resetBtn')}
            </Button>
            <Button size="sm" variant="outline" onClick={onResetLoginId} disabled={busy}>
              <Mail className="mr-1 h-3.5 w-3.5" />
              {t('portalAccount.resetLoginIdBtn', '로그인ID를 이메일로')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-secondary">{t('portalAccount.notIssued')}</p>
            <div className="flex flex-wrap items-center gap-2">
              {pwInput}
              <Button size="sm" onClick={onIssue} disabled={busy || issueDisabled}>
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                )}
                {t('portalAccount.issueBtn')}
              </Button>
            </div>
          </div>
          {issueDisabled && issueDisabledNote && (
            <p className="text-xs text-amber-600">{issueDisabledNote}</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {cred && <CredentialCard cred={cred} onClose={() => setCred(null)} />}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="py-0.5">
      <div className="text-xs text-secondary">{label}</div>
      <div className={mono ? 'font-mono' : undefined}>{value}</div>
    </div>
  );
}

function CredentialCard({
  cred,
  onClose,
}: {
  cred: PortalCredential;
  onClose: () => void;
}) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(
      `${t('portalAccount.loginId')}: ${cred.loginId}\n${t('portalAccount.tempPassword')}: ${cred.tempPassword}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <div className="mb-2 font-semibold text-amber-900">
        {t('portalAccount.credTitle')}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono">
        <span>
          <span className="text-amber-700">{t('portalAccount.loginId')}:</span>{' '}
          {cred.loginId}
        </span>
        <span>
          <span className="text-amber-700">{t('portalAccount.tempPassword')}:</span>{' '}
          {cred.tempPassword}
        </span>
      </div>
      <p className="mt-2 text-xs text-amber-700">{t('portalAccount.credHint')}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? (
            <Check className="mr-1 h-3.5 w-3.5" />
          ) : (
            <Copy className="mr-1 h-3.5 w-3.5" />
          )}
          {copied ? t('portalAccount.copied') : t('portalAccount.copy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t('portalAccount.close')}
        </Button>
      </div>
    </div>
  );
}
