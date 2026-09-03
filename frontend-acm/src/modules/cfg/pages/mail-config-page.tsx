import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  useMailConfig,
  useTestMail,
  useUpdateMailConfig,
} from '@/modules/cfg/hooks/use-mail-config';

/**
 * /admin/config/mail — 테넌트 메일(SMTP) 설정 (REQ-260902B, Gmail 1차).
 * 앱 비밀번호는 write-only (isSet placeholder), 미입력 저장 시 기존값 유지.
 */
export function MailConfigPage() {
  const { t } = useTranslation('common');
  const toast = useToast();

  const { data, isLoading, isError } = useMailConfig();
  const update = useUpdateMailConfig();
  const testMut = useTestMail();

  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // write-only
  const [fromName, setFromName] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  useEffect(() => {
    if (data) {
      setHost(data.host);
      setPort(String(data.port));
      setSecure(data.secure);
      setUsername(data.username ?? '');
      setPassword(''); // never prefilled
      setFromName(data.fromName ?? '');
      setFromAddress(data.fromAddress ?? '');
      setIsActive(data.isActive);
    }
  }, [data]);

  const reset = () => {
    setHost(data?.host ?? 'smtp.gmail.com');
    setPort(String(data?.port ?? 587));
    setSecure(data?.secure ?? false);
    setUsername(data?.username ?? '');
    setPassword('');
    setFromName(data?.fromName ?? '');
    setFromAddress(data?.fromAddress ?? '');
    setIsActive(data?.isActive ?? true);
  };

  const onSave = async () => {
    const portNum = Number(port);
    if (!host.trim() || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      toast.error(t('config.mail.errors.invalid'));
      return;
    }
    try {
      await update.mutateAsync({
        host: host.trim(),
        port: portNum,
        secure,
        username: username.trim(),
        fromName: fromName.trim(),
        fromAddress: fromAddress.trim(),
        isActive,
        // 입력했을 때만 교체 (미입력 = 기존값 유지)
        ...(password.trim() ? { password: password.trim() } : {}),
      });
      setPassword('');
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
      setTestResult({ ok: true, message: t('config.mail.test.ok') });
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: { message?: string } } } })
        .response?.data;
      const raw = data?.error?.message ?? '';
      setTestResult({
        ok: false,
        message:
          raw === 'MAIL_CONFIG_NOT_SET'
            ? t('config.mail.test.notSet')
            : `${t('config.mail.test.failed')} ${raw}`,
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
        <Mail size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">
          {t('config.mail.title')}
        </h1>
      </header>

      <p className="mb-6 text-sm text-secondary">{t('config.mail.description')}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t('config.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t('config.errors.loadFailed')}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="mailHost">{t('config.mail.fields.host.label')}</Label>
                <Input
                  id="mailHost"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailPort">{t('config.mail.fields.port.label')}</Label>
                <Input
                  id="mailPort"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="587"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={secure}
                onChange={(e) => setSecure(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              {t('config.mail.fields.secure.label')}
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="mailUsername">
                {t('config.mail.fields.username.label')}
              </Label>
              <Input
                id="mailUsername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="academy@gmail.com"
                autoComplete="off"
              />
              <p className="text-xs text-secondary">
                {t('config.mail.fields.username.hint')}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mailPassword">
                {t('config.mail.fields.password.label')}
              </Label>
              <Input
                id="mailPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  data?.passwordIsSet
                    ? t('config.fields.secret.placeholderSet')
                    : t('config.fields.secret.placeholderUnset')
                }
                autoComplete="new-password"
              />
              <p className="text-xs text-secondary">
                {t('config.mail.fields.password.hint')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mailFromName">
                  {t('config.mail.fields.fromName.label')}
                </Label>
                <Input
                  id="mailFromName"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mailFromAddress">
                  {t('config.mail.fields.fromAddress.label')}
                </Label>
                <Input
                  id="mailFromAddress"
                  value={fromAddress}
                  onChange={(e) => setFromAddress(e.target.value)}
                  placeholder={t('config.mail.fields.fromAddress.placeholder')}
                  autoComplete="off"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-primary">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-subtle)]"
              />
              {t('config.mail.fields.isActive.label')}
            </label>
          </div>

          {/* 테스트 발송 — 저장된 설정 기준 */}
          <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
            <h2 className="mb-1 text-sm font-semibold text-primary">
              {t('config.mail.test.title')}
            </h2>
            <p className="mb-3 text-xs text-secondary">{t('config.mail.test.hint')}</p>
            <div className="flex gap-2">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="recipient@example.com"
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
                {t('config.mail.test.send')}
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
