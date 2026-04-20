'use client';

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from 'react-i18next';
import { SITE } from "@/lib/portal/site-content";
import { LanguageSwitcher } from '@/components/common/language-switcher';

export function PortalHeader() {
  const { data: session, status } = useSession();
  const { t } = useTranslation(['portal', 'common']);
  const isParent = session?.user && (session.user as any).role === 'PARENT';

  return (
    <header className="sticky top-0 z-40 border-b border-gold/20 bg-navy/95 text-cream backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-[0.08em] sm:text-xl"
          aria-label={`${SITE.name} ${t('portal:nav.home')}`}
        >
          TRINITY <span className="text-gold">ACADEMY</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/about" className="transition-colors hover:text-gold">
            {t('portal:nav.about')}
          </Link>
          <Link href="/programs" className="transition-colors hover:text-gold">
            {t('portal:nav.programs')}
          </Link>
          <Link href="/news" className="transition-colors hover:text-gold">
            {t('portal:nav.news')}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-gold/40 px-4 py-1.5 font-medium text-gold transition-colors hover:bg-gold hover:text-navy"
          >
            {t('portal:home.cta-consult')}
          </Link>
          {status === 'authenticated' && isParent ? (
            <>
              <Link href="/my" className="transition-colors hover:text-gold">
                {t('portal:nav.my')}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-cream/60 transition-colors hover:text-cream"
              >
                {t('common:buttons.logout')}
              </button>
            </>
          ) : status !== 'loading' ? (
            <Link
              href="/login/parent"
              className="transition-colors hover:text-gold"
            >
              {t('portal:login.title')}
            </Link>
          ) : null}
          <LanguageSwitcher className="text-cream hover:bg-cream/10" />
        </div>
      </nav>
    </header>
  );
}
