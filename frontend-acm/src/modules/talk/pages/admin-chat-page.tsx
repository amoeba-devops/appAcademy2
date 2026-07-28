import { useTranslation } from 'react-i18next';
import { TalkChat } from '../components/talk-chat';

/** REQ-260728C — 로비채팅 (콘솔 운영자). 개설·DM·멤버관리 포함. */
export function AdminChatPage() {
  const { t } = useTranslation('common');
  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">
        {t('nav.chat', '로비채팅')}
      </h1>
      <TalkChat mode="admin" />
    </div>
  );
}
