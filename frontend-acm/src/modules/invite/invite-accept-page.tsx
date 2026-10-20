import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { inviteApi } from './invite-api';

/** REQ-261018 — /invite?token=… 초대 수락(로그인 전). 비밀번호를 정하면 가입 후 바로 로그인. */
export function InviteAcceptPage() {
  const { t } = useTranslation('common');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const info = useQuery({
    enabled: token.length > 0,
    queryKey: ['invite-info', token],
    queryFn: () => inviteApi.describe(token),
    retry: false,
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return setError(t('invite.accept.policy'));
    if (pw !== confirm) return setError(t('invite.accept.mismatch'));
    setBusy(true);
    setError('');
    try {
      const { accessToken, user } = await inviteApi.accept(token, pw);
      setAuth(accessToken, {
        id: user.id,
        entId: user.entId,
        email: user.email,
        name: user.name,
        role: user.role,
        authSource: user.authSource,
        mustChangePassword: user.mustChangePassword,
      });
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const status = err instanceof AxiosError ? err.response?.status : undefined;
      setError(
        status === 410 ? t('invite.accept.invalid') : status === 400 ? t('invite.accept.policy') : status === 429 ? t('invite.accept.rateLimited') : t('invite.accept.failed'),
      );
    } finally {
      setBusy(false);
    }
  };
  const invalid = !token || info.isError;
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-header items-center justify-end px-6">
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border border-[var(--border-subtle)] bg-surface p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-accent-700" />
            <h1 className="text-lg font-semibold text-primary">{t('invite.accept.title')}</h1>
          </div>
          {info.isLoading && <p role="status">{t('invite.loading')}</p>}
          {invalid && (
            <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('invite.accept.invalid')}
            </p>
          )}
          {info.data && (
            <form onSubmit={submit} className="grid gap-4 text-sm" noValidate>
              <p className="text-secondary">
                {t('invite.accept.intro', {
                  tenant: info.data.tenantName ?? 'ACM',
                  name: info.data.name,
                  role: t(`invite.roles.${info.data.role}`),
                })}
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-acc-email">{t('invite.fields.email')}</Label>
                <Input id="inv-acc-email" value={info.data.email} readOnly autoComplete="username" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-acc-pw">{t('invite.accept.password')}</Label>
                <PasswordInput id="inv-acc-pw" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <p className="text-xs text-secondary">{t('invite.accept.policy')}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-acc-pw2">{t('invite.accept.confirm')}</Label>
                <PasswordInput id="inv-acc-pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? t('invite.accept.submitting') : t('invite.accept.submit')}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
