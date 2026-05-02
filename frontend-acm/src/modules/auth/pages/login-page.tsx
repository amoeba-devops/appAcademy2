import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { login } from '../api/auth-api';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken, user } = await login(email.trim(), password);
      setAuth(accessToken, {
        id: user.id,
        entId: user.entId,
        email: user.email,
      });
      const returnTo = params.get('returnTo');
      navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard', {
        replace: true,
      });
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 429) setError(t('login.rateLimited'));
        else if (err.response?.status === 401 || err.response?.status === 400)
          setError(t('login.error'));
        else setError(t('login.network'));
      } else {
        setError(t('login.network'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="h-header flex items-center justify-end px-6">
        <LanguageSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-surface border border-[var(--border-subtle)] rounded-lg p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-accent-700 mb-1">
            {t('login.title')}
          </h1>
          <p className="text-sm text-secondary mb-6">{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">{t('login.email')}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                placeholder={t('login.emailPlaceholder')}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t('login.password')}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                placeholder={t('login.passwordPlaceholder')}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="mt-2 w-full">
              {submitting ? t('login.submitting') : t('login.submit')}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
