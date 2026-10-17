import { useTranslation } from 'react-i18next';
import { BarChart3, FolderOpen, Mail, Settings, UserPlus } from 'lucide-react';
import { ConfigCardGrid, type ConfigCard } from '../components/integration-cards';

/**
 * /admin/config — 서비스 설정(서비스 운영자).
 * REQ-261018 — AI·AMA·화상강의·카카오·GA4 는 테넌트 설정 › 연동 설정으로 옮겼다(링크만 숨김).
 */
const CARDS: ConfigCard[] = [
  { to: '/admin/config/invites', icon: UserPlus, titleKey: 'invite.title', descKey: 'invite.cardDescription' },
  { to: '/admin/config/ad-platforms', icon: BarChart3, titleKey: 'ads.title', descKey: 'ads.schedule' },
  { to: '/admin/config/mail', icon: Mail, titleKey: 'config.cards.mail.title', descKey: 'config.cards.mail.description' },
  { to: '/admin/config/drive', icon: FolderOpen, titleKey: 'config.cards.drive.title', descKey: 'config.cards.drive.description' },
];

export function ConfigLandingPage() {
  const { t } = useTranslation('common');
  return (
    <div className="w-full min-w-0">
      <header className="mb-6 flex items-center gap-2">
        <Settings size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('config.landing.title')}</h1>
      </header>
      <p className="mb-6 text-sm text-secondary">{t('config.landing.description')}</p>
      <ConfigCardGrid cards={CARDS} />
    </div>
  );
}
