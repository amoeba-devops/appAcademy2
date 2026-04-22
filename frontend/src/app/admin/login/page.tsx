'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('admin-credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(t('login.invalid-credentials'));
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Crest / Brand */}
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

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.email-placeholder')}
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-md bg-cream/10 border border-cream/20 text-cream placeholder-cream/40 focus:outline-none focus:border-heraldic-gold focus:ring-1 focus:ring-heraldic-gold transition-colors text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.password-placeholder')}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-md bg-cream/10 border border-cream/20 text-cream placeholder-cream/40 focus:outline-none focus:border-heraldic-gold focus:ring-1 focus:ring-heraldic-gold transition-colors text-sm"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-md bg-heraldic-gold text-navy font-semibold text-sm hover:bg-heraldic-gold/90 focus:outline-none focus:ring-2 focus:ring-heraldic-gold/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
