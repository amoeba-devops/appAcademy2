'use client';

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/common/language-switcher';
import { TPI_LOGO, TPI_SITE } from "@/lib/portal/tpi-content";

const NAV_ITEMS = [
  { labelKey: 'home.header.menu-map-test' as const, href: '/map-test' },
  { labelKey: 'home.header.menu-isee' as const, href: '/programs' },
  { labelKey: 'home.header.menu-consult' as const, href: '/contact' },
  { labelKey: 'home.header.menu-test' as const, href: '/map-test' },
];

export function PortalHeader() {
  const { data: session, status } = useSession();
  const { t } = useTranslation(['portal', 'common']);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isParent = session?.user && (session.user as any).role === 'PARENT';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-900 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label={`${TPI_SITE.name} home`}
        >
          <Image
            src={TPI_LOGO}
            alt={TPI_SITE.name}
            width={140}
            height={40}
            className="h-9 w-auto object-contain"
            priority
            unoptimized
          />
        </Link>

        <div className="hidden items-center gap-7 text-sm font-medium md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.labelKey}
              href={item.href}
              className="text-slate-700 transition-colors hover:text-blue-700"
            >
              {t(`portal:${item.labelKey}`)}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/map-test"
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {t('portal:home.header.btn-test')}
          </Link>
          <Link
            href="/contact"
            className="rounded-full border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50"
          >
            {t('portal:home.header.btn-consult')}
          </Link>
          {status === 'authenticated' && isParent ? (
            <>
              <Link href="/my" className="ml-2 text-sm text-slate-700 hover:text-blue-700">
                {t('portal:nav.my')}
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-slate-500 transition-colors hover:text-slate-700"
              >
                {t('common:buttons.logout')}
              </button>
            </>
          ) : status !== 'loading' ? (
            <Link
              href="/login/parent"
              className="ml-2 text-sm text-slate-600 hover:text-blue-700"
            >
              {t('portal:login.title')}
            </Link>
          ) : null}
          <LanguageSwitcher className="text-slate-700 hover:bg-slate-100" />
        </div>

        <button
          type="button"
          aria-label={t('portal:home.header.menu-toggle')}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {mobileOpen ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.labelKey}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {t(`portal:${item.labelKey}`)}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-200 pt-3">
              <Link
                href="/map-test"
                onClick={() => setMobileOpen(false)}
                className="rounded-full bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
              >
                {t('portal:home.header.btn-test')}
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="rounded-full border border-blue-600 px-4 py-2 text-center text-sm font-semibold text-blue-600"
              >
                {t('portal:home.header.btn-consult')}
              </Link>
              <div className="pt-1">
                <LanguageSwitcher className="text-slate-700 hover:bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
