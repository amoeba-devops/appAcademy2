import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { portalApi } from '../api/portal-api';

// PLN-260718 — "학원코드/아이디 저장" (remember-me). 비밀번호는 저장하지 않는다.
const REMEMBER_KEY = 'acm-portal-remember';
function loadRemember(): { tenantCode: string; loginId: string } | null {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    return raw ? (JSON.parse(raw) as { tenantCode: string; loginId: string }) : null;
  } catch {
    return null;
  }
}

export function PortalLoginPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setPortalAuth = useAuthStore((s) => s.setPortalAuth);
  // PLN-260708 — tenant code from `?t=` (login link) pre-fills + locks the field.
  const tenantFromUrl = (params.get('t') ?? '').trim();
  const remembered = loadRemember();
  const [tenantCode, setTenantCode] = useState(tenantFromUrl || remembered?.tenantCode || '');
  const [loginId, setLoginId] = useState(remembered?.loginId ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(!!remembered);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnTo = params.get('returnTo');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await portalApi.login(tenantCode.trim(), loginId.trim(), password);
      // 학원코드/아이디 저장 — 체크 시 유지, 해제 시 삭제.
      try {
        if (remember) {
          localStorage.setItem(
            REMEMBER_KEY,
            JSON.stringify({ tenantCode: tenantCode.trim(), loginId: loginId.trim() }),
          );
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore storage errors */
      }
      setPortalAuth(res.accessToken, res.user);
      // PLN-260716 — 강제 비번변경 폐지: 항상 원래 목적지로 이동.
      navigate(returnTo ?? '/portal', { replace: true });
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
          <span className="text-secondary">{t('portalApp.login.tenantCode')}</span>
          <input
            value={tenantCode}
            onChange={(e) => setTenantCode(e.target.value)}
            readOnly={!!tenantFromUrl}
            autoComplete="organization"
            placeholder={t('portalApp.login.tenantCodePlaceholder')}
            className={`mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 font-mono ${
              tenantFromUrl ? 'bg-[var(--gray-50)] text-secondary' : ''
            }`}
          />
        </label>
        <label className="mt-3 block text-sm">
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
          <div className="relative mt-1">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-md border border-[var(--border-subtle)] px-3 py-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={
                showPw
                  ? t('portalApp.login.hidePw', '비밀번호 숨기기')
                  : t('portalApp.login.showPw', '비밀번호 보기')
              }
              className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary hover:text-primary"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          {t('portalApp.login.remember', '학원코드·아이디 저장')}
        </label>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('portalApp.login.submit')}
        </Button>
      </form>
    </main>
  );
}
