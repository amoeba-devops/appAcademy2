import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BodaConfigSection } from '@/modules/cfg/components/boda-config-section';

/**
 * /admin/config/boda — BODA(보다에듀) 화상강의 연동 설정 (REQ-260621).
 * Split out of the former combined /admin/config page.
 */
export function BodaConfigPage() {
  const { t } = useTranslation('common');

  return (
    <div className="max-w-2xl">
      <Link
        to="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t('config.backToList')}
      </Link>
      <BodaConfigSection />
    </div>
  );
}
