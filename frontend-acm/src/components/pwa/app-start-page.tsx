import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { useAuthStore } from '@/stores/auth.store';

/**
 * REQ-261018D — 설치한 앱의 시작 화면(/app). 로그인 상태로 첫 화면을 고른다.
 * 콘솔 → 대시보드(시스템 관리자는 /system), 포털 → /portal, 학부모 → /my, 로그인 전 → 선택.
 */
export function AppStartPage() {
  const { t } = useTranslation('common');
  const s = useAuthStore();
  const order = s.active === 'portal' ? ['portal', 'admin', 'parent'] : s.active === 'parent' ? ['parent', 'admin', 'portal'] : ['admin', 'portal', 'parent'];
  for (const k of order) {
    if (k === 'admin' && s.token && s.user)
      return <Navigate to={s.user.role === 'APP_ADMIN' ? '/system/admin' : '/admin/dashboard'} replace />;
    if (k === 'portal' && s.portal.token) return <Navigate to="/portal" replace />;
    if (k === 'parent' && s.parent.token) return <Navigate to="/my" replace />;
  }
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-header items-center justify-end px-6">
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-lg border bg-surface p-8 text-center shadow-sm">
          <img src="/acm-icon-192.png" alt="" className="mx-auto h-14 w-14 rounded-xl" />
          <h1 className="mt-4 text-lg font-semibold text-primary">{t('pwa.startTitle')}</h1>
          <div className="mt-6 grid gap-2">
            <Link to="/admin/login" className="rounded-md bg-accent-700 px-4 py-2.5 text-sm text-white hover:bg-accent-600">
              {t('pwa.startConsole')}
            </Link>
            <Link to="/portal/login" className="rounded-md border px-4 py-2.5 text-sm text-primary hover:bg-canvas">
              {t('pwa.startPortal')}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
