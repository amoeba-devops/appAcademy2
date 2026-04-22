'use client';

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api-client";
import Link from "next/link";

interface DashboardKpi {
  students: { total: number; delta: number };
  revenue: { monthTotal: number; delta: number };
  consultations: { newCount: number; conversionRate: number };
  todayClasses: number;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `₩${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₩${(n / 1_000).toFixed(0)}K`;
  return `₩${n.toLocaleString()}`;
}

function DeltaBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  const { t } = useTranslation('admin');
  if (value === 0) return <span className="text-xs text-gray-400">{t('dashboard.delta.no-change')}</span>;
  const isUp = value > 0;
  return (
    <span className={`text-xs font-medium ${isUp ? "text-emerald-600" : "text-red-500"}`}>
      {isUp ? "↑" : "↓"} {Math.abs(value).toLocaleString()}{suffix} {t('dashboard.delta.vs-previous')}
    </span>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation('admin');
  const today = new Date();
  const dateStr = today.toLocaleDateString(i18n.resolvedLanguage ?? 'ko', {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const { data: kpi, isLoading } = useQuery<DashboardKpi | null>({
    queryKey: ["dashboard-kpi"],
    queryFn: async () => {
      const res = await api.get<DashboardKpi>("/dashboard/kpi");
      return res.data ?? null;
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{dateStr}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.kpi.month-students')}
          value={isLoading ? "—" : String(kpi?.students.total ?? 0)}
          delta={kpi ? <DeltaBadge value={kpi.students.delta} /> : null}
          color="bg-blue-50 text-blue-700"
        />
        <KpiCard
          label={t('dashboard.kpi.month-revenue')}
          value={isLoading ? "—" : formatCurrency(kpi?.revenue.monthTotal ?? 0)}
          delta={kpi ? <DeltaBadge value={kpi.revenue.delta} /> : null}
          color="bg-purple-50 text-purple-700"
        />
        <KpiCard
          label={t('dashboard.kpi.new-consultations')}
          value={isLoading ? "—" : String(kpi?.consultations.newCount ?? 0)}
          delta={
            kpi ? (
              <span className="text-xs text-gray-500">
                {t('dashboard.kpi.conversion-rate', { rate: kpi.consultations.conversionRate })}
              </span>
            ) : null
          }
          color="bg-amber-50 text-amber-700"
        />
        <KpiCard
          label={t('dashboard.kpi.today-classes')}
          value={isLoading ? "—" : String(kpi?.todayClasses ?? 0)}
          delta={null}
          color="bg-green-50 text-green-700"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href="/admin/consultations" title={t('dashboard.quick-links.consultations-title')} desc={t('dashboard.quick-links.consultations-desc')} icon="💬" />
        <QuickLink href="/admin/payments" title={t('dashboard.quick-links.payments-title')} desc={t('dashboard.quick-links.payments-desc')} icon="💳" />
        <QuickLink href="/admin/timetable" title={t('dashboard.quick-links.timetable-title')} desc={t('dashboard.quick-links.timetable-desc')} icon="📅" />
        <QuickLink href="/admin/students" title={t('dashboard.quick-links.students-title')} desc={t('dashboard.quick-links.students-desc')} icon="🎓" />
        <QuickLink href="/admin/program-mgmt" title={t('dashboard.quick-links.programs-title')} desc={t('dashboard.quick-links.programs-desc')} icon="📚" />
        <QuickLink href="/admin/map" title={t('dashboard.quick-links.map-title')} desc={t('dashboard.quick-links.map-desc')} icon="📝" />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  color,
}: {
  label: string;
  value: string;
  delta: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl p-5 ${color}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {delta && <div className="mt-2">{delta}</div>}
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-semibold text-navy group-hover:text-gold transition-colors">
          {title}
        </h3>
        <p className="mt-1 text-xs text-gray-500">{desc}</p>
      </div>
    </Link>
  );
}
