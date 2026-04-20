'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation, Trans } from 'react-i18next';
import { api } from '@/lib/api-client';

interface ChildInfo {
  id: number;
  name: string;
  grade: string;
  school: string;
  status: string;
}

interface StudentKpi {
  weekClasses: { total: number; held: number };
  latestScore: { rit: number; percentile: number; date: string } | null;
  unpaidOrders: number;
}

interface TimetableSession {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  className: string;
  teacherName: string;
  programName: string;
}

interface PaymentOrder {
  id: number;
  orderNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  programName: string;
  studentName: string;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

function getDayIndex(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
}

const STATUS_COLORS: Record<string, string> = {
  DONE: 'text-emerald-400',
  PENDING: 'text-amber-400',
  READY: 'text-blue-400',
  CANCELED: 'text-red-400',
  PARTIAL_CANCELED: 'text-orange-400',
};

export default function ParentDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { t, i18n } = useTranslation(['portal', 'common']);

  const formatCurrency = (amount: number) => {
    const n = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ko').format(amount);
    return t('common:currency.krw-format', { amount: n });
  };

  const statusLabel = (status: string) => ({
    label: t(`portal:my.payment-status.${status}`, { defaultValue: status }),
    color: STATUS_COLORS[status] ?? 'text-cream/60',
  });

  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [kpi, setKpi] = useState<StudentKpi | null>(null);
  const [sessions, setSessions] = useState<TimetableSession[]>([]);
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Load children on mount
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login/parent');
      return;
    }
    if (authStatus !== 'authenticated') return;

    (async () => {
      try {
        const res = await api.get<{
          children: ChildInfo[];
          selectedStudentId: number | null;
          kpi: StudentKpi | null;
        }>('/portal/my/children');
        if (res.data) {
          setChildren(res.data.children);
          if (res.data.selectedStudentId) {
            setSelectedChild(res.data.selectedStudentId);
            setKpi(res.data.kpi ?? null);
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [authStatus, router]);

  // Load data when child changes
  const loadChildData = useCallback(async (studentId: number) => {
    const [kpiRes, ttRes, payRes] = await Promise.all([
      api.get<StudentKpi>(`/portal/my/kpi?studentId=${studentId}`),
      api.get<{ sessions: TimetableSession[] }>(`/portal/my/timetable?studentId=${studentId}`),
      api.get<PaymentOrder[]>(`/portal/my/payments?studentId=${studentId}`),
    ]);
    setKpi(kpiRes.data ?? null);
    setSessions(ttRes.data?.sessions ?? []);
    setPayments(payRes.data ?? []);
  }, []);

  useEffect(() => {
    if (selectedChild) {
      loadChildData(selectedChild);
    }
  }, [selectedChild, loadChildData]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center">
        <div className="text-cream/60 animate-pulse">{t('portal:my.loading')}</div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-cream text-lg mb-2">{t('portal:my.no-children-title')}</p>
          <p className="text-cream/50 text-sm">{t('portal:my.no-children-hint')}</p>
        </div>
      </div>
    );
  }

  const parentName = session?.user?.name ?? '';

  return (
    <div className="min-h-screen bg-navy text-cream">
      {/* Welcome Banner */}
      <div className="border-b border-cream/10 bg-navy">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <h1 className="font-display text-2xl sm:text-3xl">
            <Trans
              ns="portal"
              i18nKey="my.welcome"
              values={{ name: parentName }}
              components={{ 1: <span className="text-heraldic-gold" /> }}
            />
          </h1>
          <p className="mt-1 text-cream/50 text-sm">{t('portal:my.welcome-subtitle')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-8">
        {/* Child Selector */}
        {children.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => setSelectedChild(child.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedChild === child.id
                    ? 'bg-heraldic-gold text-navy'
                    : 'bg-cream/10 text-cream/70 hover:bg-cream/20'
                }`}
              >
                {child.name}
                <span className="ml-1 text-xs opacity-70">{child.grade}</span>
              </button>
            ))}
          </div>
        )}

        {/* KPI Cards */}
        {kpi && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-lg bg-cream/5 border border-cream/10 p-5">
              <p className="text-cream/50 text-xs mb-1">{t('portal:my.kpi.week-classes')}</p>
              <p className="text-2xl font-semibold">
                {kpi.weekClasses.held}
                <span className="text-cream/40 text-base ml-1">/ {kpi.weekClasses.total}</span>
              </p>
            </div>

            <div className="rounded-lg bg-cream/5 border border-cream/10 p-5">
              <p className="text-cream/50 text-xs mb-1">{t('portal:my.kpi.latest-map')}</p>
              {kpi.latestScore ? (
                <p className="text-2xl font-semibold">
                  {kpi.latestScore.rit}
                  <span className="text-cream/40 text-sm ml-2">
                    {t('portal:my.kpi.latest-map-top', { percentile: kpi.latestScore.percentile })}
                  </span>
                </p>
              ) : (
                <p className="text-cream/40 text-sm">{t('portal:my.kpi.latest-map-empty')}</p>
              )}
            </div>

            <div className="rounded-lg bg-cream/5 border border-cream/10 p-5">
              <p className="text-cream/50 text-xs mb-1">{t('portal:my.kpi.unpaid')}</p>
              <p className={`text-2xl font-semibold ${kpi.unpaidOrders > 0 ? 'text-amber-400' : ''}`}>
                {kpi.unpaidOrders}{t('portal:my.kpi.count-suffix')}
              </p>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex gap-3 flex-wrap">
          <Link
            href={`/my/timetable${selectedChild ? `?studentId=${selectedChild}` : ''}`}
            className="px-4 py-2 rounded-md bg-cream/10 text-sm hover:bg-cream/20 transition-colors"
          >
            {t('portal:my.quick-links.timetable')}
          </Link>
          <Link
            href={`/my/scores${selectedChild ? `?studentId=${selectedChild}` : ''}`}
            className="px-4 py-2 rounded-md bg-cream/10 text-sm hover:bg-cream/20 transition-colors"
          >
            {t('portal:my.quick-links.scores')}
          </Link>
          <Link
            href={`/my/payments${selectedChild ? `?studentId=${selectedChild}` : ''}`}
            className="px-4 py-2 rounded-md bg-cream/10 text-sm hover:bg-cream/20 transition-colors"
          >
            {t('portal:my.quick-links.payments')}
          </Link>
        </div>

        {/* Weekly Timetable Preview */}
        <section>
          <h2 className="text-lg font-medium mb-3">{t('portal:my.timetable.title')}</h2>
          {sessions.length === 0 ? (
            <p className="text-cream/40 text-sm">{t('portal:my.timetable.empty')}</p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {DAY_KEYS.map((dk) => (
                <div key={dk} className="text-center text-xs text-cream/50 pb-1">{t(`common:days-short.${dk}`)}</div>
              ))}
              {DAY_KEYS.map((_, i) => {
                const daySessions = sessions.filter((s) => getDayIndex(s.date) === i);
                return (
                  <div key={i} className="min-h-[60px] rounded bg-cream/5 p-1 space-y-1">
                    {daySessions.map((s) => (
                      <div
                        key={s.id}
                        className={`text-[10px] leading-tight rounded px-1 py-0.5 ${
                          s.status === 'HELD'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cream/10 text-cream/70'
                        }`}
                      >
                        <span className="block truncate">{s.className}</span>
                        <span className="text-cream/40">
                          {s.startTime?.slice(0, 5)}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Payments */}
        <section>
          <h2 className="text-lg font-medium mb-3">{t('portal:my.payments-section.title')}</h2>
          {payments.length === 0 ? (
            <p className="text-cream/40 text-sm">{t('portal:my.payments-section.empty')}</p>
          ) : (
            <div className="rounded-lg border border-cream/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-cream/5">
                  <tr className="text-cream/50 text-xs">
                    <th className="text-left px-4 py-2">{t('portal:my.payments-section.table.order-no')}</th>
                    <th className="text-left px-4 py-2">{t('portal:my.payments-section.table.program')}</th>
                    <th className="text-right px-4 py-2">{t('portal:my.payments-section.table.amount')}</th>
                    <th className="text-center px-4 py-2">{t('portal:my.payments-section.table.status')}</th>
                    <th className="text-right px-4 py-2">{t('portal:my.payments-section.table.date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream/5">
                  {payments.slice(0, 5).map((p) => {
                    const st = statusLabel(p.status);
                    return (
                      <tr key={p.id} className="hover:bg-cream/5">
                        <td className="px-4 py-3 font-mono text-xs">{p.orderNumber}</td>
                        <td className="px-4 py-3">{p.programName}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(p.amount)}</td>
                        <td className={`px-4 py-3 text-center ${st.color}`}>{st.label}</td>
                        <td className="px-4 py-3 text-right text-cream/50 text-xs">
                          {new Date(p.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? 'ko')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
