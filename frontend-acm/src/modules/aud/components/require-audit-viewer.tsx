import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfigAccess, useConfigScope } from '@/modules/cfg/hooks/use-config-access';
import { Button } from '@/components/ui/button';

/** REQ-261021B — /admin/audit 는 테넌트 마스터·감사 조회 권한자 전용. 서버도 403 으로 거부한다. */
export function RequireAuditViewer() {
  const access = useConfigAccess();
  const scope = useConfigScope();
  const { t } = useTranslation('common');
  if (access.isLoading) return <p role="status">{t('configAccess.loading')}</p>;
  if (!access.auditAllowed)
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-xl font-semibold">{t('tenantConfig.denied')}</h1>
        <p>{t(access.isError ? 'configAccess.loadError' : 'tenantConfig.required')}</p>
        <Button variant="outline" onClick={() => access.refetch()}>
          {t('configAccess.retry')}
        </Button>
      </div>
    );
  return (
    <div key={scope.join(':')}>
      <Outlet />
    </div>
  );
}
