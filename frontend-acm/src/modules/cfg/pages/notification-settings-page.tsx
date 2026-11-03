import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Notice } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { UnderlineTabs } from '@/components/ui/tabs';
import { useMailConfig } from '../hooks/use-mail-config';
import { useKakaoConfig } from '../hooks/use-kakao-config';
import {
  TENANT_URL,
  myUrl,
  type NotifyChannel,
  type NotifyRole,
  type PushStatus,
  type TenantNotifyConfig,
  type TenantNotifyView,
  type TestPushResult,
} from '@/modules/notifications/notify-settings';

/** REQ-261102B — 서비스 설정 > 알림 설정(상황별 알림·기기 푸시·발송 경로). */
type Tab = 'situations' | 'devices' | 'routes';
type Column = NotifyChannel | 'ama';
const COLUMNS: Column[] = ['inbox', 'push', 'popup', 'ama', 'mail', 'alimtalk'];
const box = 'h-5 w-5 accent-[var(--acm-accent-600)] disabled:opacity-40';

export function NotificationSettingsPage() {
  const { t } = useTranslation('common');
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('situations');
  const view = useQuery({ queryKey: ['config-notifications'], queryFn: async () => (await apiClient.get<TenantNotifyView>(TENANT_URL)).data });
  const [draft, setDraft] = useState<TenantNotifyConfig | null>(null);
  const [ama, setAma] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (view.data) {
      setDraft(structuredClone(view.data.config));
      setAma(view.data.ama.types);
    }
  }, [view.data]);
  const dirty = useMemo(
    () => !!view.data && !!draft && (JSON.stringify(draft) !== JSON.stringify(view.data.config) || [...ama].sort().join() !== [...view.data.ama.types].sort().join()),
    [view.data, draft, ama],
  );
  const reminderOk = !!draft && draft.reminder.first >= 1 && draft.reminder.second <= 48 && draft.reminder.second > draft.reminder.first;
  const save = useMutation({
    mutationFn: async () =>
      (await apiClient.put<TenantNotifyView>(TENANT_URL, { ...draft, ...(view.data?.ama.connected ? { ama } : {}) })).data,
    onSuccess: (d) => {
      qc.setQueryData(['config-notifications'], d);
      void qc.invalidateQueries({ queryKey: ['notification-my-settings'] });
      setMsg({ ok: true, text: t('notifySettings.saved') });
    },
    onError: () => setMsg({ ok: false, text: t('notifySettings.failed') }),
  });
  const setType = (type: string, patch: Partial<TenantNotifyConfig['types'][string]>) =>
    setDraft((d) => (d ? { ...d, types: { ...d.types, [type]: { ...d.types[type], ...patch } } } : d));
  const setPush = (patch: Partial<TenantNotifyConfig['push']>) => setDraft((d) => (d ? { ...d, push: { ...d.push, ...patch } } : d));

  const v = view.data;
  return (
    <div className="w-full min-w-0 pb-20">
      <PageHeader icon={BellRing} title={t('notifySettings.title')} description={t('notifySettings.desc')} back={{ to: '/admin/config', label: t('nav.config') }} />
      <UnderlineTabs
        label={t('notifySettings.title')}
        value={tab}
        onChange={setTab}
        items={[
          { key: 'situations', label: t('notifySettings.tabs.situations') },
          { key: 'devices', label: t('notifySettings.tabs.devices') },
          { key: 'routes', label: t('notifySettings.tabs.routes') },
        ]}
      />
      {view.isError && <p role="alert" className="mt-4 text-sm text-red-600">{t('notifySettings.loadFailed')}</p>}
      {v && draft && (
        <div className="mt-4 grid gap-4">
          {tab === 'situations' && (
            <Situations view={v} draft={draft} ama={ama} setAma={setAma} setType={setType} setReminder={(r) => setDraft({ ...draft, reminder: r })} reminderOk={reminderOk} />
          )}
          {tab === 'devices' && <Devices draft={draft} setPush={setPush} />}
          {tab === 'routes' && <Routes ama={v.ama} />}
          {msg && <Notice tone={msg.ok ? 'success' : 'error'}>{msg.text}</Notice>}
        </div>
      )}
      {v && draft && tab !== 'routes' && (
        <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-surface py-3">
          {dirty && <span className="text-xs text-amber-700">{t('notifySettings.unsaved')}</span>}
          <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => { setDraft(structuredClone(v.config)); setAma(v.ama.types); setMsg(null); }}>
            {t('notifySettings.reset')}
          </Button>
          <Button disabled={!dirty || !reminderOk || save.isPending} onClick={() => { setMsg(null); save.mutate(); }}>
            {t('notifySettings.save')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Situations({
  view,
  draft,
  ama,
  setAma,
  setType,
  setReminder,
  reminderOk,
}: {
  view: TenantNotifyView;
  draft: TenantNotifyConfig;
  ama: string[];
  setAma: (v: string[]) => void;
  setType: (type: string, patch: Partial<TenantNotifyConfig['types'][string]>) => void;
  setReminder: (r: TenantNotifyConfig['reminder']) => void;
  reminderOk: boolean;
}) {
  const { t } = useTranslation('common');
  const amaUsable = view.ama.connected;
  /** 한 칸: 해당 없음 '—', 항상 켜짐, 체크박스. 푸시는 알림함을 켠 경우에만. */
  const cell = (type: string, col: Column) => {
    const spec = view.spec[type];
    const s = draft.types[type];
    const name = `${t(`notifySettings.types.${type}`)} ${t(`notifySettings.channels.${col}`)}`;
    if (col === 'ama') {
      if (!view.ama.supported.includes(type)) return <span className="text-secondary">—</span>;
      return (
        <input
          type="checkbox"
          className={box}
          aria-label={name}
          disabled={!amaUsable || !s.inbox}
          checked={ama.includes(type) && s.inbox}
          onChange={(e) => setAma(e.target.checked ? [...ama, type] : ama.filter((x) => x !== type))}
        />
      );
    }
    if (!spec.channels.includes(col)) return <span className="text-secondary">—</span>;
    if (spec.fixed?.includes(col)) return <span className="text-xs font-medium text-emerald-700">{t('notifySettings.always')}</span>;
    const off = col === 'push' && !s.inbox;
    return <input type="checkbox" className={box} aria-label={name} disabled={off} checked={s[col] && !off} onChange={(e) => setType(type, { [col]: e.target.checked })} />;
  };
  const roles = (type: string) => {
    const spec = view.spec[type];
    const s = draft.types[type];
    if (!spec.roles.length) return <span className="text-xs text-secondary">{t(`notifySettings.fixedRecipients.${type}`)}</span>;
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {spec.roles.map((r: NotifyRole) => (
          <label key={r} className="inline-flex min-h-9 items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className={box}
              checked={s.roles.includes(r)}
              onChange={(e) => setType(type, { roles: e.target.checked ? spec.roles.filter((x) => x === r || s.roles.includes(x)) : s.roles.filter((x) => x !== r) })}
            />
            {t(`notifySettings.roles.${r}`)}
          </label>
        ))}
      </span>
    );
  };
  const reminderInput = (key: 'first' | 'second') => (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-secondary">{t(`notifySettings.reminder.${key}`)}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={1}
        max={48}
        className="w-20 text-right tabular-nums"
        value={draft.reminder[key]}
        onChange={(e) => setReminder({ ...draft.reminder, [key]: Number(e.target.value) })}
      />
      <span>{t('notifySettings.reminder.unit')}</span>
    </label>
  );
  return (
    <>
      <Section title={t('notifySettings.situationsTitle')} description={t('notifySettings.situationsHint')} bodyClassName="p-0">
        {/* PC — 표 */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-50)] text-xs text-secondary">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t('notifySettings.situation')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('notifySettings.recipients')}</th>
                {COLUMNS.map((c) => (
                  <th key={c} className="px-2 py-2 text-center font-medium">{t(`notifySettings.channels.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.types.map((type) => (
                <tr key={type} className="border-t border-[var(--border-subtle)]">
                  <td className="px-4 py-2 font-medium">{t(`notifySettings.types.${type}`)}</td>
                  <td className="px-3 py-1">{roles(type)}</td>
                  {COLUMNS.map((c) => (
                    <td key={c} className="px-2 py-2 text-center">{cell(type, c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 모바일 — 상황마다 카드 */}
        <ul className="divide-y divide-[var(--border-subtle)] md:hidden">
          {view.types.map((type) => (
            <li key={type} className="grid gap-2 px-4 py-3">
              <span className="font-medium">{t(`notifySettings.types.${type}`)}</span>
              {roles(type)}
              <span className="flex flex-wrap gap-x-4 gap-y-2">
                {COLUMNS.filter((c) => (c === 'ama' ? view.ama.supported.includes(type) : view.spec[type].channels.includes(c))).map((c) => (
                  <label key={c} className="inline-flex min-h-9 items-center gap-1.5 text-sm">
                    {cell(type, c)}
                    {t(`notifySettings.channels.${c}`)}
                  </label>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {!amaUsable && <Notice tone="info">{t('notifySettings.amaNotConnected')}</Notice>}
      {amaUsable && !view.ama.enabled && <Notice tone="info">{t('notifySettings.amaOff')}</Notice>}
      <Section title={t('notifySettings.reminder.title')} description={t('notifySettings.reminder.hint')}>
        <div className="flex flex-wrap items-center gap-4">
          {reminderInput('first')}
          {reminderInput('second')}
        </div>
        {!reminderOk && <p role="alert" className="mt-2 text-xs text-red-600">{t('notifySettings.reminder.invalid')}</p>}
      </Section>
      <Notice tone="info">{t('notifySettings.notCovered')}</Notice>
    </>
  );
}

function Devices({ draft, setPush }: { draft: TenantNotifyConfig; setPush: (p: Partial<TenantNotifyConfig['push']>) => void }) {
  const { t } = useTranslation('common');
  const status = useQuery({ queryKey: ['config-notifications', 'status'], queryFn: async () => (await apiClient.get<PushStatus>(`${TENANT_URL}/status`)).data });
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const send = useMutation({
    mutationFn: async () => (await apiClient.post<TestPushResult>(`${myUrl('admin')}/test-push`)).data,
    onSuccess: (r) =>
      setTest(r.devices ? { ok: r.failed === 0, text: t('notifySettings.test.result', { ...r }) } : { ok: false, text: t('notifySettings.test.noDevice') }),
    onError: () => setTest({ ok: false, text: t('notifySettings.test.failed') }),
  });
  const q = draft.push.quiet;
  const row = 'flex flex-wrap items-center gap-3 py-2 text-sm';
  const s = status.data;
  return (
    <>
      <Section title={t('notifySettings.push.title')} description={t('notifySettings.push.hint')}>
        <label className={row}>
          <input type="checkbox" className={box} checked={draft.push.enabled} onChange={(e) => setPush({ enabled: e.target.checked })} />
          <span className="font-medium">{t('notifySettings.push.enabled')}</span>
        </label>
        <div className={row}>
          <label className="inline-flex min-h-9 items-center gap-2">
            <input type="checkbox" className={box} checked={q.on} onChange={(e) => setPush({ quiet: { ...q, on: e.target.checked } })} />
            <span className="font-medium">{t('notifySettings.push.quiet')}</span>
          </label>
          <Input type="time" aria-label={t('notifySettings.push.quietStart')} className="w-32" disabled={!q.on} value={q.start} onChange={(e) => e.target.value && setPush({ quiet: { ...q, start: e.target.value } })} />
          <span>~</span>
          <Input type="time" aria-label={t('notifySettings.push.quietEnd')} className="w-32" disabled={!q.on} value={q.end} onChange={(e) => e.target.value && setPush({ quiet: { ...q, end: e.target.value } })} />
        </div>
        <p className="text-xs text-secondary">{t('notifySettings.push.quietHint')}</p>
        <label className={row}>
          <input type="checkbox" className={box} checked={draft.push.chatPreview} onChange={(e) => setPush({ chatPreview: e.target.checked })} />
          <span className="font-medium">{t('notifySettings.push.chatPreview')}</span>
        </label>
      </Section>
      <Section
        title={t('notifySettings.status.title')}
        description={t('notifySettings.status.hint')}
        actions={
          <Button variant="outline" disabled={send.isPending || !s?.push} onClick={() => { setTest(null); send.mutate(); }}>
            {t('notifySettings.test.button')}
          </Button>
        }
      >
        {s && (
          <div className="grid gap-3">
            <p className="text-sm">
              {t('notifySettings.status.server')}: {s.push ? <span className="text-emerald-700">✅ {t('notifySettings.status.ready')}</span> : <span className="text-red-700">⚠ {t('notifySettings.status.notReady')}</span>}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t('notifySettings.status.mobile')} value={s.devices.mobile} />
              <StatCard label={t('notifySettings.status.desktop')} value={s.devices.desktop} />
              <StatCard label={t('notifySettings.status.unknown')} value={s.devices.unknown} hint={t('notifySettings.status.unknownHint')} />
              <StatCard
                label={t('notifySettings.status.sent')}
                value={s.last7days.sent.toLocaleString()}
                hint={t('notifySettings.status.failedCount', { count: s.last7days.failed })}
                tone={s.last7days.failed ? 'warning' : 'success'}
              />
            </div>
          </div>
        )}
        {status.isError && <p role="alert" className="text-sm text-red-600">{t('notifySettings.loadFailed')}</p>}
        {test && <div className="mt-3"><Notice tone={test.ok ? 'success' : 'error'}>{test.text}</Notice></div>}
      </Section>
    </>
  );
}

function Routes({ ama }: { ama: TenantNotifyView['ama'] }) {
  const { t } = useTranslation('common');
  const mail = useMailConfig();
  const kakao = useKakaoConfig();
  const items: { key: string; to: string; state: 'ok' | 'warn' | 'off'; detail?: string | null }[] = [
    {
      key: 'mail',
      to: '/admin/config/mail',
      state: mail.data?.isActive && mail.data.host ? 'ok' : 'off',
      detail: mail.data?.fromAddress,
    },
    {
      key: 'kakao',
      to: '/admin/config/kakao',
      state: kakao.data?.isActive && kakao.data.apiKey ? (kakao.data.templateIdMapApply ? 'ok' : 'warn') : 'off',
      detail: kakao.data?.isActive && kakao.data.apiKey && !kakao.data.templateIdMapApply ? t('notifySettings.routes.kakaoNoTemplate') : null,
    },
    { key: 'ama', to: '/admin/config/ama', state: ama.enabled ? 'ok' : 'off' },
  ];
  const label = { ok: `✅ ${t('notifySettings.routes.on')}`, warn: `⚠ ${t('notifySettings.routes.warn')}`, off: `○ ${t('notifySettings.routes.off')}` };
  return (
    <Section title={t('notifySettings.routes.title')} description={t('notifySettings.routes.hint')} bodyClassName="p-0">
      <ul className="divide-y divide-[var(--border-subtle)]">
        {items.map((it) => (
          <li key={it.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="w-28 font-medium">{t(`notifySettings.routes.${it.key}`)}</span>
            <span className={it.state === 'ok' ? 'text-emerald-700' : it.state === 'warn' ? 'text-amber-700' : 'text-secondary'}>{label[it.state]}</span>
            {it.detail && <span className="text-xs text-secondary">{it.detail}</span>}
            <Link to={it.to} className="ml-auto inline-flex min-h-9 items-center text-accent-700 hover:underline">
              {t('notifySettings.routes.open')} →
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
