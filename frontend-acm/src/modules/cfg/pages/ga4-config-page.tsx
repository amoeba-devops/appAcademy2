import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Upload,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  GA4_SITES,
  useCheckGa4SiteStatus,
  useGa4Config,
  useGa4SyncNow,
  useTestGa4,
  useUpdateGa4Config,
  type Ga4Metric,
  type Ga4Site,
  type Ga4SiteEntry,
  type Ga4SiteLevel,
  type Ga4SiteStatus,
} from '@/modules/cfg/hooks/use-ga4-config';

const METRICS: Ga4Metric[] = ['activeUsers', 'totalUsers', 'sessions'];

const EMPTY_SITES: Record<Ga4Site, Ga4SiteEntry> = {
  TPI: { url: '', measurementId: '', streamId: '' },
  TRINITY: { url: '', measurementId: '', streamId: '' },
  SANTACROCE: { url: '', measurementId: '', streamId: '' },
};

const LEVEL_CLASS: Record<Ga4SiteLevel, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  NO_DATA: 'bg-amber-100 text-amber-800',
  TAG_MISSING: 'bg-red-100 text-red-800',
  NOT_CONFIGURED: 'bg-[var(--canvas-subtle)] text-secondary',
  UNKNOWN: 'bg-[var(--canvas-subtle)] text-secondary',
};

function apiErrorMessage(e: unknown): string {
  const body = (e as { response?: { data?: { error?: { message?: string | string[] } } } })
    .response?.data;
  const m = body?.error?.message;
  return Array.isArray(m) ? m.join(', ') : (m ?? '');
}

function fmtDate(iso: string | null | undefined): string {
  return iso ? iso.slice(5).replace('-', '/') : '—';
}

/**
 * /admin/config/ga4 — GA4 방문자 동기화 설정 (PLN-260912) + 사이트별 연동 정보·상태 점검 (PLN-260914C).
 * 서비스계정 JSON 키는 write-only (saEmail·isSet 표시), 미입력 저장 시 유지.
 */
export function Ga4ConfigPage() {
  const { t } = useTranslation('common');
  const toast = useToast();
  const { data, isLoading, isError } = useGa4Config();
  const update = useUpdateGa4Config();
  const testMut = useTestGa4();
  const syncMut = useGa4SyncNow();
  const checkMut = useCheckGa4SiteStatus();
  const fileRef = useRef<HTMLInputElement>(null);

  const [propertyId, setPropertyId] = useState('');
  const [sites, setSites] = useState<Record<Ga4Site, Ga4SiteEntry>>(EMPTY_SITES);
  const [saKeyJson, setSaKeyJson] = useState(''); // write-only
  const [saKeyFileName, setSaKeyFileName] = useState('');
  const [metric, setMetric] = useState<Ga4Metric>('activeUsers');
  const [isActive, setIsActive] = useState(true);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const fill = () => {
    setPropertyId(data?.propertyId ?? '');
    const next = { ...EMPTY_SITES };
    for (const s of GA4_SITES) {
      const e = data?.sites?.[s];
      next[s] = {
        url: e?.url ?? '',
        measurementId: e?.measurementId ?? '',
        streamId: e?.streamId ?? data?.streamMap?.[s] ?? '',
      };
    }
    setSites(next);
    setSaKeyJson('');
    setSaKeyFileName('');
    setMetric(data?.metric ?? 'activeUsers');
    setIsActive(data?.isActive ?? true);
  };

  useEffect(() => {
    if (data) fill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const setSiteField = (site: Ga4Site, key: keyof Ga4SiteEntry, value: string) =>
    setSites((m) => ({ ...m, [site]: { ...m[site], [key]: value } }));

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setSaKeyJson(text);
    setSaKeyFileName(file.name);
  };

  const onSave = async () => {
    try {
      await update.mutateAsync({
        propertyId: propertyId.trim(),
        siteMap: sites,
        metric,
        isActive,
        ...(saKeyJson.trim() ? { saKeyJson: saKeyJson.trim() } : {}),
      });
      setSaKeyJson('');
      setSaKeyFileName('');
      setTestResult(null);
      toast.success(t('config.saved'));
    } catch (e) {
      const raw = apiErrorMessage(e);
      toast.error(
        raw.startsWith('GA4_SA_KEY')
          ? t('config.ga4.errors.invalidKey')
          : raw.startsWith('GA4_SITE_URL_INVALID')
            ? t('config.ga4.sites.errors.invalidUrl')
            : raw.startsWith('GA4_SITE_MEASUREMENT_ID_INVALID')
              ? t('config.ga4.sites.errors.invalidMeasurementId')
              : t('config.errors.saveFailed'),
      );
    }
  };

  const onTest = async () => {
    setTestResult(null);
    try {
      const r = await testMut.mutateAsync();
      setTestResult({
        ok: true,
        message: t('config.ga4.test.ok', { rows: r.rows, streams: r.streams.join(', ') || '—' }),
      });
    } catch (e) {
      const raw = apiErrorMessage(e);
      setTestResult({
        ok: false,
        message:
          raw === 'GA4_CONFIG_NOT_SET'
            ? t('config.ga4.test.notSet')
            : `${t('config.ga4.test.failed')} ${raw}`,
      });
    }
  };

  const onSyncNow = async () => {
    setSyncResult(null);
    try {
      const r = await syncMut.mutateAsync(undefined);
      setSyncResult({
        ok: true,
        message: t('config.ga4.sync.ok', {
          from: r.from,
          to: r.to,
          rows: r.rowsUpserted,
          unmapped: r.unmappedStreams.length ? r.unmappedStreams.join(', ') : '—',
        }),
      });
    } catch (e) {
      const raw = apiErrorMessage(e);
      setSyncResult({
        ok: false,
        message:
          raw === 'GA4_CONFIG_NOT_SET'
            ? t('config.ga4.test.notSet')
            : `${t('config.ga4.sync.failed')} ${raw}`,
      });
    }
  };

  const onCheck = async () => {
    setCheckError(null);
    try {
      await checkMut.mutateAsync();
    } catch (e) {
      const raw = apiErrorMessage(e);
      setCheckError(
        raw === 'GA4_CONFIG_NOT_SET'
          ? t('config.ga4.test.notSet')
          : `${t('config.ga4.sites.errors.checkFailed')} ${raw}`,
      );
    }
  };

  const statusOf = (site: Ga4Site): Ga4SiteStatus | undefined =>
    data?.siteStatus?.[site] ?? undefined;

  return (
    <div className="w-full min-w-0">
      <Link
        to="/admin/config"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft size={16} />
        {t('config.backToList')}
      </Link>
      <header className="mb-6 flex items-center gap-2">
        <BarChart3 size={20} className="text-accent-700" />
        <h1 className="text-xl font-semibold text-primary">{t('config.ga4.title')}</h1>
      </header>

      <p className="mb-6 text-sm text-secondary">{t('config.ga4.description')}</p>

      {isLoading ? (
        <p className="text-sm text-secondary">{t('config.loading')}</p>
      ) : isError ? (
        <p className="text-sm text-red-600">{t('config.errors.loadFailed')}</p>
      ) : (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-surface p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ga4Property">{t('config.ga4.fields.propertyId.label')}</Label>
                <Input
                  id="ga4Property"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder="123456789"
                  inputMode="numeric"
                  autoComplete="off"
                  className="max-w-xs"
                />
                <p className="text-xs text-secondary">{t('config.ga4.fields.propertyId.hint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>{t('config.ga4.fields.metric.label')}</Label>
                <div className="flex flex-wrap gap-3">
                  {METRICS.map((m) => (
                    <label key={m} className="flex items-center gap-1.5 text-sm text-primary">
                      <input
                        type="radio"
                        name="ga4Metric"
                        checked={metric === m}
                        onChange={() => setMetric(m)}
                      />
                      {t(`config.ga4.fields.metric.options.${m}`)}
                    </label>
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-primary">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  {t('config.ga4.fields.isActive.label')}
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('config.ga4.fields.saKey.label')}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" />
                  {t('config.ga4.fields.saKey.choose')}
                </Button>
                <span className="text-xs text-secondary">
                  {saKeyFileName
                    ? t('config.ga4.fields.saKey.pending', { name: saKeyFileName })
                    : data?.saKeyIsSet
                      ? t('config.ga4.fields.saKey.set', { email: data.saEmail ?? '' })
                      : t('config.ga4.fields.saKey.unset')}
                </span>
              </div>
              <p className="text-xs text-secondary">{t('config.ga4.fields.saKey.hint')}</p>
              <textarea
                value={saKeyJson}
                onChange={(e) => {
                  setSaKeyJson(e.target.value);
                  setSaKeyFileName('');
                }}
                placeholder={t('config.ga4.fields.saKey.pastePlaceholder')}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-surface px-3 py-2 font-mono text-xs text-primary"
                aria-label={t('config.ga4.fields.saKey.pasteLabel')}
              />
              <p className="text-xs text-secondary">{t('config.ga4.fields.saKey.pasteHint')}</p>
            </div>

            {/* PLN-260914C — per-site integration table */}
            <div className="space-y-2" data-testid="ga4-sites">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t('config.ga4.sites.title')}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-secondary">
                    {data?.siteCheckedAt
                      ? t('config.ga4.sites.lastChecked', {
                          at: new Date(data.siteCheckedAt).toLocaleString(),
                        })
                      : t('config.ga4.sites.neverChecked')}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCheck}
                    disabled={checkMut.isPending}
                  >
                    {checkMut.isPending ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <ShieldCheck size={14} className="mr-1" />
                    )}
                    {checkMut.isPending
                      ? t('config.ga4.sites.checking')
                      : t('config.ga4.sites.check')}
                  </Button>
                </div>
              </div>
              {checkError && <p className="text-xs text-red-600">❌ {checkError}</p>}
              <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
                <table className="min-w-full text-xs">
                  <thead className="bg-[var(--canvas-subtle)] text-secondary">
                    <tr>
                      {(['site', 'url', 'measurementId', 'streamId', 'tag', 'ga4', 'acm', 'status'] as const).map(
                        (c) => (
                          <th key={c} className="px-2 py-1.5 text-left font-normal whitespace-nowrap">
                            {t(`config.ga4.sites.col.${c}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {GA4_SITES.map((site) => {
                      const st = statusOf(site);
                      const advice =
                        st && (st.level === 'TAG_MISSING' || st.level === 'NO_DATA' || st.level === 'UNKNOWN')
                          ? t(`config.ga4.sites.advice.${st.level}`)
                          : null;
                      return (
                        <FragmentRow key={site}>
                          <tr className="border-t border-[var(--border-subtle)] align-top">
                            <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                              {t(`config.ga4.sites.name.${site}`)}
                              <div className="text-[10px] text-secondary">{site}</div>
                            </td>
                            <td className="px-2 py-1.5 min-w-[200px]">
                              <Input
                                value={sites[site].url}
                                onChange={(e) => setSiteField(site, 'url', e.target.value)}
                                placeholder="https://…"
                                autoComplete="off"
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5 min-w-[130px]">
                              <Input
                                value={sites[site].measurementId}
                                onChange={(e) =>
                                  setSiteField(site, 'measurementId', e.target.value.toUpperCase())
                                }
                                placeholder="G-XXXXXXXXXX"
                                autoComplete="off"
                                className="h-8 font-mono text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5 min-w-[120px]">
                              <Input
                                value={sites[site].streamId}
                                onChange={(e) => setSiteField(site, 'streamId', e.target.value)}
                                placeholder="streamId"
                                inputMode="numeric"
                                autoComplete="off"
                                className="h-8 font-mono text-xs"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap" title={st?.tag.error ?? undefined}>
                              {st
                                ? st.tag.installed === true
                                  ? `✔ ${t('config.ga4.sites.tag.yes')}`
                                  : st.tag.installed === false
                                    ? `✖ ${t('config.ga4.sites.tag.no')}`
                                    : t('config.ga4.sites.tag.unknown')
                                : '—'}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap" title={st?.ga4.error ?? undefined}>
                              {st
                                ? `${t('config.ga4.sites.rows', { rows: st.ga4.rows })} · ${fmtDate(st.ga4.lastDate)} · ${t('config.ga4.sites.visitors', { n: st.ga4.visitors7d })}`
                                : '—'}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {st
                                ? `${fmtDate(st.acm.lastDate)} · ${t('config.ga4.sites.visitors', { n: st.acm.visitors7d })}`
                                : '—'}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {st ? (
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${LEVEL_CLASS[st.level]}`}
                                >
                                  {t(`config.ga4.sites.level.${st.level}`)}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                          {advice && (
                            <tr>
                              <td />
                              <td colSpan={7} className="px-2 pb-2 text-[11px] text-secondary">
                                ↳ {advice}
                              </td>
                            </tr>
                          )}
                        </FragmentRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-secondary">{t('config.ga4.sites.hint')}</p>
            </div>

            <div className="rounded-md border border-[var(--border-subtle)] p-4">
              <h2 className="mb-1 text-sm font-medium text-primary">{t('config.ga4.test.title')}</h2>
              <p className="mb-3 text-xs text-secondary">{t('config.ga4.test.hint')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={onTest} disabled={testMut.isPending}>
                  {testMut.isPending ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Wifi size={14} className="mr-1" />
                  )}
                  {t('config.ga4.test.run')}
                </Button>
                <Button type="button" variant="outline" onClick={onSyncNow} disabled={syncMut.isPending}>
                  {syncMut.isPending ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <RefreshCw size={14} className="mr-1" />
                  )}
                  {t('config.ga4.sync.run')}
                </Button>
              </div>
              {testResult && (
                <p className={`mt-2 text-xs ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {testResult.ok ? '✅ ' : '❌ '}
                  {testResult.message}
                </p>
              )}
              {syncResult && (
                <p className={`mt-2 text-xs ${syncResult.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                  {syncResult.ok ? '✅ ' : '❌ '}
                  {syncResult.message}
                </p>
              )}
              <div className="mt-3 rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-xs text-secondary">
                <div>
                  {t('config.ga4.sync.last', {
                    at: data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString() : '—',
                    status: data?.lastSyncStatus ?? '—',
                  })}
                </div>
                {data?.lastSyncStatus === 'FAILED' && data.lastSyncError && (
                  <div className="mt-1 break-all text-red-600">{data.lastSyncError}</div>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 rounded-md bg-[var(--canvas-subtle)] px-3 py-2 text-xs text-secondary">
            {t('config.ga4.setupHint')}
          </p>

          {data?.updatedAt && (
            <p className="mt-3 text-xs text-secondary">
              {t('config.lastUpdated', { at: new Date(data.updatedAt).toLocaleString() })}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={fill} disabled={update.isPending}>
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

/** Two-row group per site (data row + optional advice row) without extra DOM. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
