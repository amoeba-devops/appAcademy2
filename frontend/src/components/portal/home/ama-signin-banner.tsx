'use client';

import { LogIn, ExternalLink } from 'lucide-react';

const APPSTORE_URL =
  process.env.NEXT_PUBLIC_AMA_APPSTORE_URL ?? 'https://amoeba.site/apps/app-academy';

export function AmaSignInBanner() {
  return (
    <section
      aria-label="AMA로 시작"
      className="border-y border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 py-10"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            AMA App Store
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
            학원관리앱 — AMA 사용자라면 클릭 한 번에 시작
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            AMA 계정으로 로그인하면 학원이 즉시 생성됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href="/api/auth/ama/login"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            AMA로 로그인
          </a>
          <a
            href={APPSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            앱스토어에서 보기
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
