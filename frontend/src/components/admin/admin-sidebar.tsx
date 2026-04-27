'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  MessageSquare,
  GraduationCap,
  Users,
  BookOpen,
  Layers,
  Calendar,
  ClipboardList,
  FlaskConical,
  CreditCard,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const sidebarItems = [
  { key: 'dashboard', href: '/admin/dashboard', icon: BarChart3 },
  { key: 'consultations', href: '/admin/consultations', icon: MessageSquare },
  { key: 'students', href: '/admin/students', icon: GraduationCap },
  { key: 'teachers', href: '/admin/teachers', icon: Users },
  { key: 'programs', href: '/admin/program-mgmt', icon: BookOpen },
  { key: 'classes', href: '/admin/classes', icon: Layers },
  { key: 'timetable', href: '/admin/timetable', icon: Calendar },
  { key: 'enrollments', href: '/admin/enrollments', icon: ClipboardList },
  { key: 'map', href: '/admin/map', icon: FlaskConical },
  { key: 'payments', href: '/admin/payments', icon: CreditCard },
  { key: 'notifications', href: '/admin/notifications', icon: Bell },
  { key: 'settings', href: '/admin/settings', icon: Settings },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation(['admin', 'common']);

  return (
    <aside
      aria-label={t('admin:nav.dashboard') + ''}
      className={cn(
        // Tenant brand shell retained; Amoeba-spec dimensions (§1.3: 240/64px)
        'bg-navy text-cream flex flex-col shrink-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand — tenant identity anchor */}
      <div className="h-16 flex items-center px-4 border-b border-cream/10">
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2 overflow-hidden rounded-md"
          aria-label={t('common:app.admin-name')}
        >
          <span className="text-heraldic-gold text-xl shrink-0" aria-hidden="true">⛨</span>
          {!collapsed && (
            <span className="font-display text-sm tracking-wide whitespace-nowrap">
              {t('common:app.admin-name')}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation — Amoeba active-state accent via left rail + gold keyline */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto" aria-label={t('common:actions.open-menu')}>
        {sidebarItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          const label = t(`admin:nav.${item.key}`);

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-cream/15 text-heraldic-gold font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-heraldic-gold'
                  : 'text-cream/70 hover:bg-cream/10 hover:text-cream',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" className="font-body">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Collapse toggle — aria-label required for icon-only button (§13.5) */}
      <div className="p-2 border-t border-cream/10">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? t('common:actions.sidebar-expand') : t('common:actions.sidebar-collapse')}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-center py-2 rounded-md text-cream/50 hover:text-cream hover:bg-cream/10 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {!collapsed && (
          <div className="text-center text-xs text-cream/40 mt-1">v1.3</div>
        )}
      </div>
    </aside>
  );
}
