import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Smartphone } from 'lucide-react';
import { installApp, isIos, usePwa } from '@/lib/pwa';

/** 설치할 수 있는지(설치 제안 이벤트가 있거나 iOS Safari 에서 아직 설치 안 함). */
function useInstallable() {
  const { installEvent, installed } = usePwa();
  const ios = isIos();
  return { show: !installed && (!!installEvent || ios), ios: ios && !installEvent };
}

/** REQ-261018D — 로그인 화면 아래 설치 안내 카드. */
export function InstallAppCard() {
  const { t } = useTranslation('common');
  const { show, ios } = useInstallable();
  if (!show) return null;
  return (
    <div className="mt-6 flex items-start gap-3 rounded-lg border bg-surface p-4 text-sm">
      <Smartphone size={20} className="mt-0.5 shrink-0 text-accent-700" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-primary">{t('pwa.installTitle')}</p>
        {ios ? (
          <p className="mt-1 text-secondary">
            {t('pwa.iosGuideBefore')} <Share size={14} className="inline align-text-bottom" aria-label={t('pwa.share')} />{' '}
            {t('pwa.iosGuideAfter')}
            <span className="mt-1 block text-xs">{t('pwa.iosPushNote')}</span>
          </p>
        ) : (
          <p className="mt-1 text-secondary">{t('pwa.installDesc')}</p>
        )}
      </div>
      {!ios && (
        <button
          type="button"
          onClick={() => void installApp()}
          className="shrink-0 rounded-md bg-accent-700 px-3 py-1.5 text-white hover:bg-accent-600"
        >
          {t('pwa.install')}
        </button>
      )}
    </div>
  );
}

/** REQ-261018D — 사이드바 하단 "앱 설치". iOS 는 누르면 안내를 펼친다. */
export function InstallAppNavButton({ iconOnly }: { iconOnly?: boolean }) {
  const { t } = useTranslation('common');
  const { show, ios } = useInstallable();
  const [guide, setGuide] = useState(false);
  if (!show) return null;
  return (
    <div>
      <button
        type="button"
        title={t('pwa.install')}
        onClick={() => (ios ? setGuide((v) => !v) : void installApp())}
        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-secondary hover:bg-canvas hover:text-primary ${iconOnly ? 'justify-center' : ''}`}
      >
        <Smartphone size={18} />
        {!iconOnly && <span>{t('pwa.install')}</span>}
      </button>
      {guide && !iconOnly && (
        <p className="px-3 pb-2 text-xs text-secondary">
          {t('pwa.iosGuideBefore')} <Share size={12} className="inline align-text-bottom" /> {t('pwa.iosGuideAfter')}
        </p>
      )}
    </div>
  );
}
