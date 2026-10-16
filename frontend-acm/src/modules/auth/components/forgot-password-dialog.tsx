import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * REQ-261017 — 비밀번호 찾기: 관리자에게 재발급 요청.
 * 서버는 계정 존재 여부와 관계없이 같은 응답을 준다(화면도 같은 안내).
 */
export function ForgotPasswordDialog({
  initialEmail,
  close,
}: {
  initialEmail: string;
  close: () => void;
}) {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('forgot.invalidEmail'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/acm/auth/password-reset-requests', { email: email.trim() });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof AxiosError && err.response?.status === 429
          ? t('forgot.rateLimited')
          : t('forgot.failed'),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('forgot.title')}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="grid gap-4 text-sm">
            <p role="status" className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {t('forgot.done')}
            </p>
            <div className="flex justify-end">
              <Button onClick={close}>{t('forgot.close')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4 text-sm" noValidate>
            <p className="text-secondary">{t('forgot.desc')}</p>
            <div className="grid gap-1.5">
              <Label htmlFor="forgot-email">{t('login.email')}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={busy} onClick={close}>
                {t('forgot.cancel')}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t('forgot.sending') : t('forgot.submit')}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
