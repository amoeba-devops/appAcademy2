import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Check, Copy, KeyRound, MailCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth.store';

/** REQ-261017 — 서버 응답: 메일 발송 시 비밀번호는 오지 않는다(미발송 때만 1회). */
export interface TempPasswordResult {
  mailSent: boolean;
  expiresAt: string;
  tempPassword?: string;
}

export const canIssueTempPassword = (role?: string) => role === 'ADMIN' || role === 'APP_ADMIN';

export function errorCode(err: unknown): string | undefined {
  if (!(err instanceof AxiosError)) return undefined;
  const d = err.response?.data as { code?: string; error?: { code?: string } } | undefined;
  return d?.error?.code ?? d?.code;
}

/** 발급 결과: 메일 발송 안내 또는 임시 비밀번호 1회 표시 + 복사. */
export function TempPasswordResultDialog({
  result,
  email,
  close,
}: {
  result: TempPasswordResult;
  email?: string;
  close: () => void;
}) {
  const { t, i18n } = useTranslation('auth');
  const [copied, setCopied] = useState(false);
  const until = new Date(result.expiresAt).toLocaleString(i18n.language);
  const copy = async () => {
    if (!result.tempPassword) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('temp.resultTitle')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          {result.mailSent ? (
            <p role="status" className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {t('temp.mailSent', { email: email ?? '' })}
            </p>
          ) : (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                {t('temp.mailNotSent')}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-canvas px-3 py-2 font-mono text-base tracking-wider">
                  {result.tempPassword}
                </code>
                <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={t('temp.copy')}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </Button>
              </div>
              <p className="text-xs text-secondary">{t('temp.onceOnly')}</p>
            </>
          )}
          <p className="text-xs text-secondary">{t('temp.validUntil', { until })}</p>
          <div className="flex justify-end">
            <Button onClick={close}>{t('forgot.close')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 교사·직원·시스템 사용자 화면의 [임시 비밀번호 발급] 버튼.
 * 관리자(ADMIN/APP_ADMIN)에게만 보인다. 확인 → 발급 → 결과 대화상자.
 */
export function IssueTempPasswordButton({
  userId,
  email,
  onIssued,
}: {
  userId: string;
  email?: string;
  onIssued?: () => void;
}) {
  const { t } = useTranslation('auth');
  const role = useAuthStore((s) => s.user?.role);
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TempPasswordResult | null>(null);
  if (!canIssueTempPassword(role)) return null;
  const issue = async () => {
    const ok = await confirm({
      title: t('temp.confirmTitle'),
      description: t('temp.confirmDesc'),
      confirmLabel: t('temp.issue'),
    });
    if (!ok) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.post<TempPasswordResult>(
        `/acm/admin/users/${userId}/temp-password`,
      );
      setResult(data);
      onIssued?.();
    } catch (err) {
      setError(errorCode(err) === 'USER_INACTIVE' ? t('temp.inactive') : t('temp.failed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={issue} disabled={busy}>
        <KeyRound size={16} className="mr-1.5" />
        {busy ? t('temp.issuing') : t('temp.issue')}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      )}
      {result && <TempPasswordResultDialog result={result} email={email} close={() => setResult(null)} />}
    </>
  );
}
