import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Video, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useBodaConfig,
  useUpdateBodaConfig,
} from '@/modules/cfg/hooks/use-boda-config';

/**
 * REQ-260526 FR-BODA-CFG-1..5 — 운영자가 테넌트별 BODA 자격증명을 입력한다.
 *
 * 비밀 (authKey, eventSecret) 은 한 번 저장되면 화면에 다시 표시되지 않으며,
 * `*IsSet` 플래그로 저장 여부만 노출된다. 빈 입력은 "변경 없음" 으로 처리.
 *
 * 본 컴포넌트는 `/admin/config` (AmaConfigPage) 의 second card 로 마운트된다.
 */
export function BodaConfigSection() {
  const { t } = useTranslation('common');
  const toast = useToast();

  const { data, isLoading, isError } = useBodaConfig();
  const update = useUpdateBodaConfig();

  // Public fields
  const [bodaWebUrl, setBodaWebUrl] = useState('');
  const [svrUrl, setSvrUrl] = useState('');
  const [webrtcUrl, setWebrtcUrl] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [defaultRoomCode, setDefaultRoomCode] = useState('');
  // Secrets — write-only
  const [authKey, setAuthKey] = useState('');
  const [eventSecret, setEventSecret] = useState('');
  // Ops
  const [webhookAllowCidrs, setWebhookAllowCidrs] = useState('');
  const [graceBeforeMin, setGraceBeforeMin] = useState<number>(10);
  const [graceAfterMin, setGraceAfterMin] = useState<number>(15);
  const [reconcileDelayMin, setReconcileDelayMin] = useState<number>(10);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (data) {
      setBodaWebUrl(data.bodaWebUrl ?? '');
      setSvrUrl(data.svrUrl ?? '');
      setWebrtcUrl(data.webrtcUrl ?? '');
      setCompanyCode(data.companyCode ?? '');
      setCompanyId(data.companyId ?? '');
      setDefaultRoomCode(data.defaultRoomCode ?? '');
      setAuthKey(''); // never prefilled
      setEventSecret(''); // never prefilled
      setWebhookAllowCidrs(data.webhookAllowCidrs ?? '');
      setGraceBeforeMin(data.graceBeforeMin ?? 10);
      setGraceAfterMin(data.graceAfterMin ?? 15);
      setReconcileDelayMin(data.reconcileDelayMin ?? 10);
      setIsActive(data.isActive ?? true);
    }
  }, [data]);

  const reset = () => {
    setBodaWebUrl(data?.bodaWebUrl ?? '');
    setSvrUrl(data?.svrUrl ?? '');
    setWebrtcUrl(data?.webrtcUrl ?? '');
    setCompanyCode(data?.companyCode ?? '');
    setCompanyId(data?.companyId ?? '');
    setDefaultRoomCode(data?.defaultRoomCode ?? '');
    setAuthKey('');
    setEventSecret('');
    setWebhookAllowCidrs(data?.webhookAllowCidrs ?? '');
    setGraceBeforeMin(data?.graceBeforeMin ?? 10);
    setGraceAfterMin(data?.graceAfterMin ?? 15);
    setReconcileDelayMin(data?.reconcileDelayMin ?? 10);
    setIsActive(data?.isActive ?? true);
  };

  const onSave = async () => {
    try {
      await update.mutateAsync({
        bodaWebUrl: bodaWebUrl.trim() || undefined,
        svrUrl: svrUrl.trim() || undefined,
        webrtcUrl: webrtcUrl.trim() || undefined,
        companyCode: companyCode.trim() || undefined,
        companyId: companyId.trim() || undefined,
        defaultRoomCode: defaultRoomCode.trim() || undefined,
        ...(authKey.trim() ? { authKey: authKey.trim() } : {}),
        ...(eventSecret.trim() ? { eventSecret: eventSecret.trim() } : {}),
        webhookAllowCidrs: webhookAllowCidrs.trim() || undefined,
        graceBeforeMin,
        graceAfterMin,
        reconcileDelayMin,
        isActive,
      });
      setAuthKey('');
      setEventSecret('');
      toast.success(t('config.saved'));
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('config.errors.saveFailed'));
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
      <header className="mb-5 flex items-center gap-2">
        <Video size={18} className="text-accent-700" />
        <h2 className="text-base font-semibold text-primary">
          {t('config.boda.title')}
        </h2>
      </header>
      <p className="mb-5 text-xs text-secondary">{t('config.boda.description')}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t('config.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t('config.errors.loadFailed')}</p>
      ) : (
        <div className="space-y-5">
          {/* Public URLs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bodaWebUrl">{t('config.boda.fields.bodaWebUrl')}</Label>
              <Input
                id="bodaWebUrl"
                value={bodaWebUrl}
                onChange={(e) => setBodaWebUrl(e.target.value)}
                placeholder="https://bodaedu.kr"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svrUrl">{t('config.boda.fields.svrUrl')}</Label>
              <Input
                id="svrUrl"
                value={svrUrl}
                onChange={(e) => setSvrUrl(e.target.value)}
                placeholder="https://svr.bodaedu.kr"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="webrtcUrl">{t('config.boda.fields.webrtcUrl')}</Label>
              <Input
                id="webrtcUrl"
                value={webrtcUrl}
                onChange={(e) => setWebrtcUrl(e.target.value)}
                placeholder="https://bodaedu.kr/webrtc"
                autoComplete="off"
              />
            </div>
            <div />
          </div>

          {/* Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="companyCode">{t('config.boda.fields.companyCode')}</Label>
              <Input
                id="companyCode"
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value)}
                placeholder="245"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="companyId">{t('config.boda.fields.companyId')}</Label>
              <Input
                id="companyId"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="tpi"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultRoomCode">{t('config.boda.fields.defaultRoomCode')}</Label>
              <Input
                id="defaultRoomCode"
                value={defaultRoomCode}
                onChange={(e) => setDefaultRoomCode(e.target.value)}
                placeholder="699"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Secrets — write-only with isSet flag */}
          <div className="border-t border-[var(--border-subtle)] pt-5 space-y-4">
            <p className="text-xs font-semibold text-primary uppercase">
              {t('config.boda.secretsTitle')}
            </p>
            <SecretField
              id="authKey"
              label={t('config.boda.fields.authKey')}
              value={authKey}
              onChange={setAuthKey}
              isSet={data?.authKeyIsSet ?? false}
              t={t}
            />
            <SecretField
              id="eventSecret"
              label={t('config.boda.fields.eventSecret')}
              value={eventSecret}
              onChange={setEventSecret}
              isSet={data?.eventSecretIsSet ?? false}
              t={t}
            />
          </div>

          {/* Webhook allowlist + grace/reconcile */}
          <div className="border-t border-[var(--border-subtle)] pt-5 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="webhookAllowCidrs">
                {t('config.boda.fields.webhookAllowCidrs')}
              </Label>
              <Input
                id="webhookAllowCidrs"
                value={webhookAllowCidrs}
                onChange={(e) => setWebhookAllowCidrs(e.target.value)}
                placeholder="1.2.3.4, 10.0.0.0/24"
                autoComplete="off"
              />
              <p className="text-xs text-secondary">
                {t('config.boda.fields.webhookAllowCidrsHint')}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="graceBeforeMin">
                  {t('config.boda.fields.graceBeforeMin')}
                </Label>
                <Input
                  id="graceBeforeMin"
                  type="number"
                  min={0}
                  max={60}
                  value={graceBeforeMin}
                  onChange={(e) => setGraceBeforeMin(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="graceAfterMin">
                  {t('config.boda.fields.graceAfterMin')}
                </Label>
                <Input
                  id="graceAfterMin"
                  type="number"
                  min={0}
                  max={120}
                  value={graceAfterMin}
                  onChange={(e) => setGraceAfterMin(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reconcileDelayMin">
                  {t('config.boda.fields.reconcileDelayMin')}
                </Label>
                <Input
                  id="reconcileDelayMin"
                  type="number"
                  min={0}
                  max={60}
                  value={reconcileDelayMin}
                  onChange={(e) => setReconcileDelayMin(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Active flag */}
          <label className="flex items-center gap-2 text-sm text-primary">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)]"
            />
            {t('config.boda.fields.isActive')}
          </label>

          {data?.updatedAt && (
            <p className="text-xs text-secondary">
              {t('config.lastUpdated', {
                at: new Date(data.updatedAt).toLocaleString(),
              })}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={reset} disabled={update.isPending}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SecretField({
  id,
  label,
  value,
  onChange,
  isSet,
  t,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  isSet: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {isSet ? (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-green-700">
            <CheckCircle2 size={12} /> {t('config.boda.isSetTrue')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-secondary">
            <XCircle size={12} /> {t('config.boda.isSetFalse')}
          </span>
        )}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          isSet
            ? t('config.boda.placeholderSet')
            : t('config.boda.placeholderUnset')
        }
        autoComplete="new-password"
      />
      <p className="text-[11px] text-secondary">
        {t('config.boda.secretHint')}
      </p>
    </div>
  );
}
