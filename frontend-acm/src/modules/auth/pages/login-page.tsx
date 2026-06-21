import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { SUPPORTED_LANGS, type SupportedLang } from '@/i18n';
import { DebugContextPanel } from '@/components/common/debug-context-panel';
import { exchangeAmaToken, login } from '../api/auth-api';

// Capture entry-time referrer + query before React render or scrubUrl().
const _initialReferrer =
  typeof document !== 'undefined' ? document.referrer : '';
const _initialQueryParams =
  typeof window !== 'undefined' ? window.location.search : '';

type AmaState =
  | { kind: 'idle' }
  | { kind: 'exchanging' }
  | { kind: 'error'; code: string };

function isSupportedLang(v: string): v is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(v);
}

/** Strip `ama_token` and `locale` from the URL without a navigation. FR-AMA-52. */
function scrubUrl(): void {
  if (typeof window === 'undefined') return;
  const u = new URL(window.location.href);
  let dirty = false;
  for (const k of ['ama_token', 'locale']) {
    if (u.searchParams.has(k)) {
      u.searchParams.delete(k);
      dirty = true;
    }
  }
  if (dirty) {
    window.history.replaceState({}, '', u.pathname + (u.search ? u.search : '') + u.hash);
  }
}

export function LoginPage() {
  const { t, i18n } = useTranslation('auth');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AMA SSO auto-exchange — runs once on mount when ?ama_token=... is present.
  const [ama, setAma] = useState<AmaState>(() =>
    params.get('ama_token') ? { kind: 'exchanging' } : { kind: 'idle' },
  );
  const exchangedRef = useRef(false);

  useEffect(() => {
    const amaToken = params.get('ama_token');
    const locale = params.get('locale');

    // Apply locale before any UI text renders (FR-AMA-03).
    if (locale && isSupportedLang(locale) && i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }

    if (!amaToken || exchangedRef.current) return;
    exchangedRef.current = true;

    (async () => {
      try {
        const { accessToken, user } = await exchangeAmaToken(amaToken);
        setAuth(accessToken, {
          id: user.id,
          entId: user.entId,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        });
        scrubUrl();
        if (user.mustChangePassword) {
          navigate('/admin/change-password', { replace: true });
          return;
        }
        const returnTo = params.get('returnTo');
        navigate(
          returnTo && returnTo.startsWith('/') ? returnTo : '/admin/dashboard',
          { replace: true },
        );
      } catch (err) {
        scrubUrl();
        let code = 'NETWORK';
        if (err instanceof AxiosError) {
          const body = err.response?.data as
            | {
                error?: { code?: string; message?: string };
                code?: string;
                message?: string;
              }
            | undefined;
          code =
            body?.error?.code ??
            body?.code ??
            `HTTP_${err.response?.status ?? 'X'}`;
        }
        setAma({ kind: 'error', code });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
      if (user.mustChangePassword) {
        navigate('/admin/change-password', { replace: true });
        return;
      }
      const returnTo = params.get('returnTo');
      navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/admin/dashboard', {
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

  // ── AMA SSO splash (exchanging) ────────────────────────────────────────────
  if (ama.kind === 'exchanging') {
    return (
      <>
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-secondary">
            <div
              className="h-8 w-8 rounded-full border-2 border-accent-700 border-t-transparent animate-spin"
              aria-hidden
            />
            <p className="text-sm">{t('ama.loading')}</p>
          </div>
        </div>
        <DebugContextPanel
          initialReferrer={_initialReferrer}
          initialQueryParams={_initialQueryParams}
        />
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="h-header flex items-center justify-end px-6">
        <LanguageSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-surface border border-[var(--border-subtle)] rounded-lg p-8 shadow-sm">
          {ama.kind === 'error' && (
            <div
              role="alert"
              className="mb-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
            >
              <p className="font-semibold">{t('ama.errorTitle')}</p>
              <p className="mt-1">
                {t(`ama.errors.${ama.code}`, {
                  defaultValue: t('ama.errors.NETWORK'),
                })}
              </p>
            </div>
          )}

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
    <DebugContextPanel
      initialReferrer={_initialReferrer}
      initialQueryParams={_initialQueryParams}
    />
    </>
  );
}
