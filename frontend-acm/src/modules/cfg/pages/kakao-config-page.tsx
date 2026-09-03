import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useKakaoConfig,
  useTestKakao,
  useUpdateKakaoConfig,
} from '@/modules/cfg/hooks/use-kakao-config';

/**
 * /admin/config/kakao — 카카오 알림톡(Solapi) 설정 (REQ-260903E).
 * API Secret 은 write-only (isSet placeholder), 미입력 저장 시 유지.
 */
export function KakaoConfigPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const { data, isLoading, isError } = useKakaoConfig();
  const update = useUpdateKakaoConfig();
  const testMut = useTestKakao();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState(''); // write-only
  const [pfId, setPfId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [smsFallback, setSmsFallback] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  useEffect(() => {
    if (data) {
      setApiKey(data.apiKey ?? '');
      setApiSecret('');
      setPfId(data.pfId ?? '');
      setTemplateId(data.templateId ?? '');
      setSenderPhone(data.senderPhone ?? '');
      setSmsFallback(data.smsFallback);
      setIsActive(data.isActive);
    }
  }, [data]);

  const reset = () => {
    setApiKey(data?.apiKey ?? '');
    setApiSecret('');
    setPfId(data?.pfId ?? '');
    setTemplateId(data?.templateId ?? '');
    setSenderPhone(data?.senderPhone ?? '');
    setSmsFallback(data?.smsFallback ?? false);
    setIsActive(data?.isActive ?? true);
  };

  const onSave = async () => {
    try {
      await update.mutateAsync({
        apiKey: apiKey.trim(),
        pfId: pfId.trim(),
        templateId: templateId.trim(),
        senderPhone: senderPhone.trim(),
        smsFallback,
        isActive,
        ...(apiSecret.trim() ? { apiSecret: apiSecret.trim() } : {}),
      });
      setApiSecret('');
      setTestResult(null);
      toast.success(t('config.saved'));
    } catch {
      toast.error(t('config.errors.saveFailed'));
    }
  };

  const onTest = async () => {
    setTestResult(null);
    try {
      await testMut.mutateAsync(testTo.trim());
      setTestResult({ ok: true, message: t('config.kakao.test.ok') });
    } catch (e: unknown) {
      const body = (e as { response?: { data?: { error?: { message?: string } } } })
        .response?.data;
      const raw = body?.error?.message ?? '';
      setTestResult({
        ok: false,
        message:
          raw === 'KAKAO_CONFIG_NOT_SET'
            ? t('config.kakao.test.notSet')
            : `${t('config.kakao.test.failed')} ${raw}`,
      });
    }
  };

  return (
    <div className="max-w-2xl">
      <Link
        to="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t('config.backToList')}
      </Link>
      <header className="mb-6 flex items-center gap-2">
        <MessageCircle size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">
          {t('config.kakao.title')}
        </h1>
      </header>

      <p className="mb-6 text-sm text-secondary">{t('config.kakao.description')}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t('config.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t('config.errors.loadFailed')}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="kkApiKey">{t('config.kakao.fields.apiKey.label')}</Label>
              <Input
                id="kkApiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kkApiSecret">
                {t('config.kakao.fields.apiSecret.label')}
              </Label>
              <Input
                id="kkApiSecret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder={
                  data?.apiSecretIsSet
                    ? t('config.fields.secret.placeholderSet')
                    : t('config.fields.secret.placeholderUnset')
                }
                autoComplete="new-password"
              />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kkPfId">{t('config.kakao.fields.pfId.label')}</Label>
                <Input
                  id="kkPfId"
                  value={pfId}
                  onChange={(e) => setPfId(e.target.value)}
                  placeholder="KA01PF..."
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kkTemplateId">
                  {t('config.kakao.fields.templateId.label')}
                </Label>
                <Input
                  id="kkTemplateId"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder="KA01TP..."
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-xs text-secondary">
              {t('config.kakao.templateHint')}
              <br />
              <code>{'#{학원명} #{학생명} #{수업명} #{일시}'}</code>
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kkSender">
                  {t('config.kakao.fields.senderPhone.label')}
                </Label>
                <Input
                  id="kkSender"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="0255512345"
                  autoComplete="off"
                />
                <p className="text-xs text-secondary">
                  {t('config.kakao.fields.senderPhone.hint')}
                </p>
              </div>
              <div className="space-y-3 pt-6">
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={smsFallback}
                    onChange={(e) => setSmsFallback(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-subtle)]"
                  />
                  {t('config.kakao.fields.smsFallback.label')}
                </label>
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-subtle)]"
                  />
                  {t('config.kakao.fields.isActive.label')}
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <h2 className="mb-1 text-sm font-semibold text-primary">
              {t('config.kakao.test.title')}
            </h2>
            <p className="mb-3 text-xs text-secondary">{t('config.kakao.test.hint')}</p>
            <div className="flex gap-2">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="01012345678"
                autoComplete="off"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                onClick={onTest}
                disabled={testMut.isPending || !testTo.trim()}
              >
                {testMut.isPending ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Send size={14} className="mr-1" />
                )}
                {t('config.kakao.test.send')}
              </Button>
            </div>
            {testResult && (
              <p
                className={`mt-2 text-xs ${
                  testResult.ok ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {testResult.ok ? '✅ ' : '❌ '}
                {testResult.message}
              </p>
            )}
          </div>

          {data?.updatedAt && (
            <p className="mt-5 text-xs text-secondary">
              {t('config.lastUpdated', {
                at: new Date(data.updatedAt).toLocaleString(),
              })}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={reset} disabled={update.isPending}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={onSave} disabled={update.isPending}>
              {update.isPending ? t('actions.saving') : t('actions.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
