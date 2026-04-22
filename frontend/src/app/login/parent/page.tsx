'use client';

import { useState, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function ParentLoginPage() {
  const router = useRouter();
  const { t } = useTranslation('portal');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleSendOtp = useCallback(async () => {
    if (!phone.trim()) {
      setError(t('login.phone-required'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/parent/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message ?? t('login.otp-send-failed'));
        setLoading(false);
        return;
      }

      setStep('otp');
      setCountdown(180); // 3 minutes
      setOtp('');
    } catch {
      setError(t('login.server-error'));
    } finally {
      setLoading(false);
    }
  }, [phone, t]);

  const handleVerifyOtp = useCallback(async () => {
    if (otp.length !== 6) {
      setError(t('login.otp-length-required'));
      return;
    }

    setError('');
    setLoading(true);

    const result = await signIn('parent-credentials', {
      phone: phone.trim(),
      otp,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t('login.otp-mismatch'));
      return;
    }

    router.push('/my');
    router.refresh();
  }, [phone, otp, router, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-heraldic-gold/40 mb-4">
            <span className="text-3xl">⛨</span>
          </div>
          <h1 className="font-display text-2xl text-cream tracking-wide">
            Trinity Academy
          </h1>
          <p className="text-cream/50 text-xs tracking-[0.3em] mt-1">
            OMNIBUS OMNIA
          </p>
        </div>

        <h2 className="text-cream text-center text-lg font-medium mb-6">
          {t('login.title')}
        </h2>

        {/* Step 1: Phone */}
        <div className="space-y-4">
          <div>
            <label htmlFor="phone" className="sr-only">{t('login.phone-label')}</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('login.phone-placeholder')}
              required
              disabled={step === 'otp'}
              autoComplete="tel"
              className="w-full px-4 py-3 rounded-md bg-cream/10 border border-cream/20 text-cream placeholder-cream/40 focus:outline-none focus:border-heraldic-gold focus:ring-1 focus:ring-heraldic-gold transition-colors text-sm disabled:opacity-50"
            />
          </div>

          {step === 'phone' && (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full py-3 rounded-md bg-cream/20 text-cream font-medium text-sm hover:bg-cream/30 focus:outline-none focus:ring-2 focus:ring-heraldic-gold/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t('login.sending-otp') : t('login.send-otp')}
            </button>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <div className="relative">
                <label htmlFor="otp" className="sr-only">{t('login.otp-label')}</label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('login.otp-placeholder')}
                  autoFocus
                  className="w-full px-4 py-3 rounded-md bg-cream/10 border border-cream/20 text-cream placeholder-cream/40 focus:outline-none focus:border-heraldic-gold focus:ring-1 focus:ring-heraldic-gold transition-colors text-sm tracking-[0.5em] text-center text-lg"
                />
                {countdown > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-heraldic-gold text-xs">
                    {formatTime(countdown)}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full py-3 rounded-md bg-heraldic-gold text-navy font-semibold text-sm hover:bg-heraldic-gold/90 focus:outline-none focus:ring-2 focus:ring-heraldic-gold/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('login.verifying') : t('login.submit')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setCountdown(0);
                  setError('');
                }}
                className="w-full py-2 text-cream/50 text-xs hover:text-cream transition-colors"
              >
                {t('login.try-another-phone')}
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}

        {/* Link to admin login */}
        <div className="mt-8 text-center">
          <Link href="/admin/login" className="text-cream/40 text-xs hover:text-cream/60 transition-colors">
            {t('login.admin-login-link')}
          </Link>
        </div>
      </div>
    </div>
  );
}
