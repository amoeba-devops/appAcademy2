import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { portalApi } from '../api/portal-api';

export function PortalChangePasswordPage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const clearMustChange = useAuthStore((s) => s.clearPortalMustChange);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t('portalApp.changePw.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await portalApi.changePassword(currentPassword, newPassword);
      clearMustChange();
      navigate('/portal', { replace: true });
    } catch (e) {
      const code = (e as { response?: { data?: { code?: string; message?: string } } })
        .response?.data?.code;
      if (code === 'CURRENT_PASSWORD_INVALID') {
        setError(t('portalApp.changePw.currentInvalid', '현재 비밀번호가 올바르지 않습니다.'));
      } else if (code === 'PASSWORD_LENGTH' || code === 'PASSWORD_COMPLEXITY') {
        setError(t('portalApp.changePw.weak', '비밀번호는 영문+숫자 포함 8자 이상이어야 합니다.'));
      } else {
        setError(t('portalApp.changePw.failed'));
      }
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
          {t('portalApp.changePw.title')}
        </h1>
        <p className="mt-1 text-sm text-secondary">{t('portalApp.changePw.subtitle')}</p>

        {(
          [
            ['current', currentPassword, setCurrent],
            ['new', newPassword, setNew],
            ['confirm', confirm, setConfirm],
          ] as const
        ).map(([key, val, setter]) => (
          <label key={key} className="mt-3 block text-sm">
            <span className="text-secondary">{t(`portalApp.changePw.${key}`)}</span>
            <input
              type="password"
              value={val}
              onChange={(e) => setter(e.target.value)}
              autoComplete={key === 'current' ? 'current-password' : 'new-password'}
              className="mt-1 w-full rounded-md border border-[var(--border-subtle)] px-3 py-2"
            />
          </label>
        ))}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={busy} className="mt-5 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('portalApp.changePw.submit')}
        </Button>
      </form>
    </main>
  );
}
