import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Globe, Mail, MessageCircle, Settings, Video, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * /admin/config — Configuration landing (REQ-260621).
 *
 * Card menu that links to the per-integration settings pages. The previous
 * single-page form was split into /admin/config/ama and /admin/config/boda.
 */
interface ConfigCard {
  to: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

const CARDS: ConfigCard[] = [
  { to: '/admin/config/ama', icon: Settings, titleKey: 'config.cards.ama.title', descKey: 'config.cards.ama.description' },
  { to: '/admin/config/boda', icon: Video, titleKey: 'config.cards.boda.title', descKey: 'config.cards.boda.description' },
  { to: '/admin/config/mail', icon: Mail, titleKey: 'config.cards.mail.title', descKey: 'config.cards.mail.description' },
  { to: '/admin/config/general', icon: Globe, titleKey: 'config.cards.general.title', descKey: 'config.cards.general.description' },
  { to: '/admin/config/kakao', icon: MessageCircle, titleKey: 'config.cards.kakao.title', descKey: 'config.cards.kakao.description' },
];

export function ConfigLandingPage() {
  const { t } = useTranslation('common');

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-center gap-2">
        <Settings size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('config.landing.title')}</h1>
      </header>
      <p className="mb-6 text-sm text-secondary">{t('config.landing.description')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ to, icon: Icon, titleKey, descKey }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col rounded-lg border border-[var(--border-subtle)] bg-surface p-5 transition-colors hover:border-accent-300 hover:bg-accent-50/40"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent-50 text-accent-700">
                <Icon size={20} />
              </span>
              <ChevronRight
                size={18}
                className="text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-accent-700"
              />
            </div>
            <h2 className="text-base font-semibold text-primary">{t(titleKey)}</h2>
            <p className="mt-1 text-sm text-secondary">{t(descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
