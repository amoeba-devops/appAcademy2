import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { TalkChat } from '../components/talk-chat';

/** REQ-260728C — 로비채팅 (강사 포털). 참여 전용 — 개설/멤버관리 없음. */
export function PortalChatPage() {
  const { t } = useTranslation('common');
  const kind = useAuthStore((s) => s.portal.user?.kind);
  if (kind !== 'TEACHER') {
    return (
      <p className="py-6 text-sm text-secondary">
        {t('talk.teacherOnly', '강사만 이용할 수 있습니다.')}
      </p>
    );
  }
  return (
    <div>
      <h1 className="mb-3 text-lg font-semibold text-primary">
        {t('portalApp.nav.chat', '로비채팅')}
      </h1>
      <TalkChat mode="portal" />
    </div>
  );
}
