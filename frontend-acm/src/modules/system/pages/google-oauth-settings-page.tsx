import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, ChevronRight, Copy, ExternalLink, KeyRound, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** REQ-261016B — /system/settings/google-oauth (APP_ADMIN). 전 테넌트 공용 Google OAuth 앱. */
interface GoogleAppView {
  source: 'SYSTEM' | 'ENV' | 'NONE';
  clientId: string;
  hasSecret: boolean;
  redirectUri: string;
  pickerKeyMasked: string;
  hasPickerKey: boolean;
  projectNumber: string;
  updatedAt: string | null;
  updatedBy: string | null;
}
const URL_BASE = '/acm/system/google-oauth';
const SCOPES = 'openid, email, https://www.googleapis.com/auth/drive.file';

function errText(e: unknown) {
  const x = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
  return x.response?.data?.error?.message ?? x.response?.data?.message ?? '';
}

export function GoogleOauthSettingsPage() {
  const { t } = useTranslation('system');
  const qc = useQueryClient();
  const origin = window.location.origin;
  const callback = `${origin}/api/acm/prj/drive/callback`;
  const q = useQuery({
    queryKey: ['system-google-oauth'],
    queryFn: async () => (await apiClient.get<GoogleAppView>(URL_BASE)).data,
  });
  const [form, setForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: callback,
    pickerKey: '',
    projectNumber: '',
  });
  const [guideOpen, setGuideOpen] = useState(true);
  useEffect(() => {
    if (!q.data) return;
    setForm((f) => ({
      ...f,
      clientId: q.data.clientId,
      redirectUri: q.data.redirectUri || callback,
      projectNumber: q.data.projectNumber,
    }));
    if (q.data.source === 'SYSTEM') setGuideOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);
  const save = useMutation({
    mutationFn: async () => (await apiClient.put<GoogleAppView>(URL_BASE, form)).data,
    onSuccess: (data) => {
      qc.setQueryData(['system-google-oauth'], data);
      setForm((f) => ({ ...f, clientSecret: '', pickerKey: '' }));
      test.reset();
    },
  });
  const clear = useMutation({
    mutationFn: async () => (await apiClient.delete<GoogleAppView>(URL_BASE)).data,
    onSuccess: (data) => {
      qc.setQueryData(['system-google-oauth'], data);
      test.reset();
    },
  });
  const test = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ ok: boolean; code: string }>(`${URL_BASE}/test`)).data,
  });
  const set = (k: keyof typeof form, v: string) => {
    save.reset();
    setForm((f) => ({ ...f, [k]: v }));
  };
  const v = q.data;
  const clientChanged = !!v?.clientId && form.clientId.trim() !== v.clientId;

  const steps: { key: string; link?: string; copies?: [string, string][] }[] = [
    { key: 'project', link: 'https://console.cloud.google.com/projectcreate' },
    { key: 'apis', link: 'https://console.cloud.google.com/apis/library/drive.googleapis.com' },
    {
      key: 'consent',
      link: 'https://console.cloud.google.com/apis/credentials/consent',
      copies: [
        [t('google.copy.domain'), new URL(origin).hostname.split('.').slice(-2).join('.')],
        [t('google.copy.scopes'), SCOPES],
      ],
    },
    {
      key: 'client',
      link: 'https://console.cloud.google.com/apis/credentials/oauthclient',
      copies: [
        [t('google.copy.origin'), origin],
        [t('google.copy.redirect'), callback],
      ],
    },
    {
      key: 'apiKey',
      link: 'https://console.cloud.google.com/apis/credentials',
      copies: [[t('google.copy.referrer'), `${origin}/*`]],
    },
    { key: 'projectNumber', link: 'https://console.cloud.google.com/home/dashboard' },
  ];

  return (
    <div className="grid max-w-4xl gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <KeyRound size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('google.title')}</h1>
        {v && (
          <span
            className={clsx(
              'ml-auto rounded px-2 py-0.5 text-xs font-medium',
              v.source === 'NONE' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
            )}
          >
            {t('google.source.label')}: {t(`google.source.${v.source}`)}
          </span>
        )}
      </header>
      <p className="text-sm text-secondary">{t('google.description')}</p>

      <section className="rounded-lg border bg-surface">
        <button
          type="button"
          aria-expanded={guideOpen}
          onClick={() => setGuideOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left font-semibold"
        >
          {guideOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t('google.guide.title')}
        </button>
        {guideOpen && (
          <ol className="grid gap-4 border-t px-4 py-4 text-sm">
            {steps.map((s, i) => (
              <li key={s.key} className="grid gap-1">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-50 text-xs text-accent-700">
                    {i + 1}
                  </span>
                  {t(`google.guide.${s.key}.title`)}
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
                    >
                      {t('google.guide.open')} <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p className="whitespace-pre-line pl-8 text-secondary">{t(`google.guide.${s.key}.body`)}</p>
                {s.copies?.map(([label, value]) => (
                  <CopyRow key={label} label={label} value={value} />
                ))}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="grid gap-3 rounded-lg border bg-surface p-4 text-sm">
        <h2 className="font-semibold">{t('google.form.title')}</h2>
        {q.isLoading && <p>{t('users.loading')}</p>}
        <Field label="Client ID" hint={t('google.form.clientIdHint')}>
          <Input
            value={form.clientId}
            autoComplete="off"
            placeholder="123456789012-xxxx.apps.googleusercontent.com"
            onChange={(e) => set('clientId', e.target.value)}
          />
        </Field>
        <Field
          label="Client Secret"
          hint={v?.hasSecret && v.source === 'SYSTEM' ? t('google.form.secretKept') : t('google.form.secretHint')}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.clientSecret}
            placeholder={v?.hasSecret && v.source === 'SYSTEM' ? '••••••••' : 'GOCSPX-…'}
            onChange={(e) => set('clientSecret', e.target.value)}
          />
        </Field>
        <Field label="Redirect URI" hint={t('google.form.redirectHint')}>
          <Input value={form.redirectUri} autoComplete="off" onChange={(e) => set('redirectUri', e.target.value)} />
        </Field>
        <Field
          label="Picker API Key"
          hint={v?.hasPickerKey ? t('google.form.pickerKept', { masked: v.pickerKeyMasked }) : t('google.form.pickerHint')}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={form.pickerKey}
            placeholder="AIza…"
            onChange={(e) => set('pickerKey', e.target.value)}
          />
        </Field>
        <Field label="Project Number" hint={t('google.form.projectNumberHint')}>
          <Input
            value={form.projectNumber}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => set('projectNumber', e.target.value)}
          />
        </Field>
        {clientChanged && (
          <p role="alert" className="rounded bg-amber-50 p-2 text-amber-800">
            {t('google.form.clientChangeWarning')}
          </p>
        )}
        {v?.updatedAt && (
          <p className="text-xs text-secondary">
            {t('google.form.updated', { at: new Date(v.updatedAt).toLocaleString(), by: v.updatedBy ?? '—' })}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-red-600">
            {errText(save.error) || t('google.form.saveError')}
          </p>
        )}
        {save.isSuccess && <p role="status">{t('google.form.saved')}</p>}
        {test.data && (
          <p
            role="status"
            className={clsx('flex items-center gap-1', test.data.ok ? 'text-emerald-700' : 'text-red-600')}
          >
            {test.data.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {t(`google.test.${test.data.code}`, t('google.test.UNKNOWN'))}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            disabled={test.isPending || !v || v.source === 'NONE'}
            onClick={() => test.mutate()}
          >
            {test.isPending ? t('google.test.running') : t('google.test.button')}
          </Button>
          {v?.source === 'SYSTEM' && (
            <Button
              variant="outline"
              disabled={clear.isPending}
              onClick={() => {
                if (window.confirm(t('google.form.clearConfirm'))) clear.mutate();
              }}
            >
              {t('google.form.clear')}
            </Button>
          )}
          <Button disabled={save.isPending || !form.clientId.trim()} onClick={() => save.mutate()}>
            {save.isPending ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-secondary">{hint}</span>}
    </label>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('system');
  const [copied, setCopied] = useState(false);
  return (
    <div className="ml-8 flex min-w-0 flex-wrap items-center gap-2 rounded bg-[var(--gray-50)] px-2 py-1">
      <span className="text-xs text-secondary">{label}</span>
      <code className="min-w-0 flex-1 break-all text-xs">{value}</code>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-accent-700 hover:underline"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        <Copy size={12} /> {copied ? t('google.copied') : t('google.copy.button')}
      </button>
    </div>
  );
}
