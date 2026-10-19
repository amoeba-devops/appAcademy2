import { Outlet } from 'react-router-dom';
import { PortalHeader } from './portal-header';
import { PortalFooter } from './portal-footer';
import { FloatingCta } from './floating-cta';

/**
 * Public portal shell — used by `/`, `/about`, `/programs`, `/news`, etc.
 * No auth required; auth state (admin/parent) drives header nav variants.
 */
export function PortalLayout() {
  return (
    // TST-261019 M5 — 휴대폰 하단 고정 버튼 바(FloatingCta) 높이만큼 본문 아래 여백 확보.
    <div className="min-h-screen flex flex-col bg-white pb-[calc(4rem+env(safe-area-inset-bottom))] text-slate-900 md:pb-0">
      <PortalHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PortalFooter />
      <FloatingCta />
    </div>
  );
}
