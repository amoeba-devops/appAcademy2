'use client';

import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Bell, Search, LogOut, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/common/language-switcher';

export function AdminHeader() {
  const { data: session } = useSession();
  const { t } = useTranslation(['common', 'admin']);
  const userName = session?.user?.name ?? t('common:auth.admin-user');
  const initials = userName.slice(0, 1);

  return (
    // Amoeba Web Style Guide v2.0 §1.3 — Header height 64px, fixed
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Search — Amoeba §7.2 input spec */}
      <div className="relative w-72">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder={t('common:search.global-placeholder')}
          aria-label={t('common:buttons.search')}
          className="pl-9 h-10 bg-gray-50 border-gray-200 text-sm"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Notification bell (§12.2 Bell icon badge) */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common:actions.open-notifications')}
          className="relative"
        >
          <Bell className="h-4 w-4 text-gray-500" aria-hidden="true" />
          {/* Unread dot indicator — status conveyed by position + aria, not color alone */}
          <span
            className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-amb-error ring-2 ring-white"
            aria-label={t('admin:notifications.unread-badge')}
          />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('common:actions.open-user-menu')}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 transition-colors"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-navy text-cream text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-700 hidden sm:inline">
              {userName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common:auth.my-info')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/admin/login' })}
              className="text-amb-error"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('common:buttons.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
