import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { applyUpdate, usePwa } from '@/lib/pwa';

/** REQ-261018D — 배포 후 새 버전 안내(화면 하단). */
export function PwaUpdateToast() {
  const { t } = useTranslation('common');
  const { waiting } = usePwa();
  if (!waiting) return null;
  return (
    <div
      role="status"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      className="fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg"
    >
      <span>{t('pwa.updateAvailable')}</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="inline-flex items-center gap-1.5 rounded-md bg-accent-700 px-3 py-1.5 text-white hover:bg-accent-600"
      >
        <RefreshCw size={14} />
        {t('pwa.reload')}
      </button>
    </div>
  );
}
