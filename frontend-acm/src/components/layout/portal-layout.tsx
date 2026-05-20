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
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <PortalHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PortalFooter />
      <FloatingCta />
    </div>
  );
}
