import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';
import { sendOtp, verifyOtp } from '../api/parent-auth-api';

const PHONE_REGEX = /^[0-9+\-() ]{7,20}$/;
const OTP_TTL_SECONDS = 180; // 3 minutes — matches backend OTP_TTL_MS
const RESEND_COOLDOWN_SECONDS = 30;

type Step = 'phone' | 'otp';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Map backend (Korean) error messages to i18n keys. Backend currently doesn't
 * return error codes, only `message: string`. Keep this list aligned with
 * `backend/src/presentation/auth/parent-auth.service.ts`.
 */
function mapBackendError(status: number | undefined, message: string | undefined): string {
  const msg = message ?? '';
  if (status === 400) {
    if (msg.includes('만료')) return 'errors.otpExpired';
    if (msg.includes('시도 횟수') || msg.includes('초과')) return 'errors.tooManyAttempts';
    if (msg.includes('먼저 요청')) return 'errors.otpNotRequested';
  }
  if (status === 401) {
    if (msg.includes('학부모') || msg.includes('등록')) return 'errors.parentNotFound';
    return 'errors.otpInvalid';
  }
  return 'errors.unknown';
}

export function ParentLoginPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setParentAuth = useAuthStore((s) => s.setParentAuth);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);

  const phoneRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
  }, [step]);

  // OTP TTL countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const id = window.setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [countdown]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  const handleSendOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setInfo(null);

    const trimmed = phone.trim();
    if (!trimmed) {
      setError(t('parent.errors.phoneRequired'));
      return;
    }
    if (!PHONE_REGEX.test(trimmed)) {
      setError(t('parent.errors.phoneInvalid'));
      return;
    }

    setSubmitting(true);
    try {
      await sendOtp(trimmed);
      setStep('otp');
      setOtp('');
      setCountdown(OTP_TTL_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo(t('parent.otpSentNotice'));
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const body = err.response?.data as { message?: string } | undefined;
        if (status && status >= 400 && status < 500) {
          setError(t(`parent.${mapBackendError(status, body?.message)}`));
        } else {
          setError(t('parent.errors.network'));
        }
      } else {
        setError(t('parent.errors.network'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setInfo(null);

    if (!otp.trim()) {
      setError(t('parent.errors.otpRequired'));
      return;
    }
    if (otp.trim().length !== 6) {
      setError(t('parent.errors.otpLength'));
      return;
    }
    if (countdown <= 0) {
      setError(t('parent.errors.otpExpired'));
      return;
    }

    setSubmitting(true);
    try {
      const { accessToken, parent } = await verifyOtp(phone.trim(), otp.trim());
      setParentAuth(accessToken, parent);
      const returnTo = params.get('returnTo');
      navigate(returnTo && returnTo.startsWith('/') ? returnTo : '/my', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const body = err.response?.data as { message?: string } | undefined;
        if (status && status >= 400 && status < 500) {
          setError(t(`parent.${mapBackendError(status, body?.message)}`));
        } else {
          setError(t('parent.errors.network'));
        }
      } else {
        setError(t('parent.errors.network'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePhone = () => {
    setStep('phone');
    setOtp('');
    setCountdown(0);
    setResendCooldown(0);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="h-header flex items-center justify-between px-6">
        <button
          type="button"
          onClick={() => navigate('/admin/login')}
          className="text-sm text-secondary hover:text-accent-700"
        >
          {t('parent.adminLogin')}
        </button>
        <LanguageSwitcher />
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-surface border border-[var(--border-subtle)] rounded-lg p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-accent-700 mb-1">
            {t('parent.title')}
          </h1>
          <p className="text-sm text-secondary mb-6">{t('parent.subtitle')}</p>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parent-phone">{t('parent.phoneLabel')}</Label>
                <Input
                  ref={phoneRef}
                  id="parent-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  placeholder={t('parent.phonePlaceholder')}
                  onChange={(e) => setPhone(e.target.value)}
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
                {submitting ? t('parent.sending') : t('parent.sendOtp')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label className="text-secondary text-xs">{t('parent.phoneLabel')}</Label>
                <div className="flex items-center justify-between text-sm">
                  <span>{phone}</span>
                  <button
                    type="button"
                    onClick={handleChangePhone}
                    className="text-xs text-accent-700 hover:underline"
                  >
                    {t('parent.changePhone')}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parent-otp">{t('parent.otpLabel')}</Label>
                <Input
                  ref={otpRef}
                  id="parent-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otp}
                  placeholder={t('parent.otpPlaceholder')}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="tracking-[0.4em] text-center font-mono"
                />
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      countdown > 0 && countdown <= 30
                        ? 'text-red-600 font-semibold'
                        : 'text-secondary'
                    }
                  >
                    {t('parent.remaining', { time: formatTime(countdown) })}
                  </span>
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || submitting}
                    onClick={() => handleSendOtp()}
                    className="text-accent-700 hover:underline disabled:text-secondary disabled:no-underline disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? `${t('parent.resend')} (${resendCooldown}s)`
                      : t('parent.resend')}
                  </button>
                </div>
              </div>

              {info && !error && (
                <div
                  role="status"
                  className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
                >
                  {info}
                </div>
              )}
              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
                >
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="mt-2 w-full">
                {submitting ? t('parent.verifying') : t('parent.verify')}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
