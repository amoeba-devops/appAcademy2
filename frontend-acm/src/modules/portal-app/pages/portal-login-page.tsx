import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { portalApi } from '../api/portal-api';

export function PortalLoginPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setPortalAuth = useAuthStore((s) => s.setPortalAuth);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = params.get('returnTo');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await portalApi.login(loginId.trim(), password);
      setPortalAuth(res.accessToken, res.user);
      if (res.mustChangePassword) {
        navigate('/portal/change-password', { replace: true });
      } else {
        navigate(returnTo ?? '/portal', { replace: true });
      }
    } catch {
      setError(t('portalApp.login.invalid'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-[var(--border-subtle)] bg-surface p-8 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-primary">
          {t('portalApp.login.title')}
        </h1>
        <p className="mt-1 text-sm text-secondary">{t('portalApp.login.subtitle')}</p>

        <label className="mt-5 block text-sm">
          <span className="text-secondary">{t('portalApp.login.loginId')}</span>
          <input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 font-mono"
          />
        </label>
        <label className="mt-3 block text-sm">
          <span className="text-secondary">{t('portalApp.login.password')}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2"
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('portalApp.login.submit')}
        </Button>

        <p className="mt-4 text-xs text-secondary">{t('portalApp.login.firstHint')}</p>
      </form>
    </main>
  );
}
