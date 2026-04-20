'use client';

import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  className,
  variant = 'ghost',
}: {
  className?: string;
  variant?: 'ghost' | 'outline';
}) {
  const { t, i18n } = useTranslation('common');
  const current = (i18n.resolvedLanguage ?? i18n.language) as SupportedLocale;

  const handleChange = (lng: SupportedLocale) => {
    if (lng === current) return;
    i18n.changeLanguage(lng);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lng;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('actions.switch-language')}
        render={
          <Button
            variant={variant}
            size="sm"
            className={cn('gap-1.5', className)}
          />
        }
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t(`locale.${current}`)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LOCALES.map((lng) => {
          const isActive = lng === current;
          return (
            <DropdownMenuItem
              key={lng}
              onClick={() => handleChange(lng)}
              aria-current={isActive ? 'true' : undefined}
              className="flex items-center justify-between"
            >
              <span>{t(`locale.${lng}`)}</span>
              {isActive ? (
                <Check
                  className="h-4 w-4 text-amb-primary-600"
                  aria-hidden="true"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
