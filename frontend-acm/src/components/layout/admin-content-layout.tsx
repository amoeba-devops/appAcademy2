import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';

type SupportBanner = { src: string; alt: string; href?: string };
export function AdminSupportPanel({ banner }: { banner?: SupportBanner }) {
  const { pathname } = useLocation();
  const { t } = useTranslation('common');
  const module = pathname.split('/')[2];
  const tip = module === 'std' ? 'students'
    : module === 'cal-stats' ? 'stats'
    : module === 'cal' ? 'calendar'
    : module === 'config' ? 'settings'
    : module === 'chat' ? 'chat'
    : module === 'posts' ? 'posts' : 'general';
  const bannerImage = banner && <img src={banner.src} alt={banner.alt} className="h-auto w-full rounded-lg" />;
  return <aside className="admin-support-panel space-y-4" aria-label={t('adminLayout.support')}>
    <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <Lightbulb size={16} aria-hidden="true" />{t('adminLayout.tips')}
      </h2>
      <p className="text-sm leading-6 text-secondary break-words">{t(`adminLayout.${tip}`)}</p>
    </section>
    {banner && <section className="rounded-lg border border-[var(--border-subtle)] bg-surface p-3">
      {banner.href ? <a href={banner.href}>{bannerImage}</a> : bannerImage}
    </section>}
  </aside>;
}

export function AdminContentLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  const isDashboard = ['/admin', '/admin/', '/admin/dashboard', '/admin/dashboard/'].includes(pathname);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Container containment would change fixed-position custom dialogs' viewport.
    // Measure the frame without introducing a containing block for those dialogs.
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width));
    observer.observe(container);
    return () => observer.disconnect();
  }, [isDashboard]);
  if (isDashboard) return <>{children}</>;
  return <div ref={containerRef} className={`admin-content-container ${availableWidth >= 1176 ? 'admin-content-wide' : ''} ${availableWidth < 640 ? 'admin-content-narrow' : ''}`}>
    <div className="admin-content-grid">
      <div className="admin-page-content">{children}</div>
      <AdminSupportPanel />
    </div>
  </div>;
}
