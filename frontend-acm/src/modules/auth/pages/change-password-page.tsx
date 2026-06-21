import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { changePassword } from '../api/auth-api';

/**
 * REQ-260621 — forced/self-service password change. Reached automatically after
 * login when `mustChangePassword` is set (seeded or admin-reset accounts). On
 * success the must-change flag is cleared and the user proceeds.
 */
export function ChangePasswordPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const mustChange = useAuthStore((s) => s.user?.mustChangePassword);
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const destination = role === 'APP_ADMIN' ? '/system/admin' : '/admin/dashboard';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError(t('changePassword.policy'));
      return;
    }
    if (newPassword !== confirm) {
      setError(t('changePassword.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      clearMustChangePassword();
      navigate(destination, { replace: true });
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        setError(t('changePassword.currentInvalid'));
      } else if (err instanceof AxiosError && err.response?.status === 400) {
        setError(t('changePassword.policy'));
      } else {
        setError(t('changePassword.failed'));
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
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm bg-surface border border-[var(--border-subtle)] rounded-lg p-8 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-2">
            <KeyRound size={20} className="text-accent-700" />
            <h1 className="text-lg font-semibold text-primary">{t('changePassword.title')}</h1>
          </div>
          {mustChange && (
            <p className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              {t('changePassword.forced')}
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">{t('changePassword.current')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">{t('changePassword.new')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-secondary">{t('changePassword.policy')}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t('changePassword.confirm')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button type="submit" className="mt-6 w-full" disabled={submitting}>
            {submitting ? t('changePassword.submitting') : t('changePassword.submit')}
          </Button>
        </form>
      </main>
    </div>
  );
}
