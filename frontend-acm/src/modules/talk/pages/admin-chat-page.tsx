import { useTranslation } from 'react-i18next';
import { MessagesSquare } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { TalkChat } from '../components/talk-chat';

/** REQ-260728C — 로비채팅 (콘솔 운영자). 개설·DM·멤버관리 포함. */
export function AdminChatPage() {
  const { t } = useTranslation('common');
  return (
    <div>
      <PageHeader
        icon={MessagesSquare}
        title={t('nav.chat')}
        description={t('pageHeader.chat.desc')}
      />
      <TalkChat mode="admin" />
    </div>
  );
}
