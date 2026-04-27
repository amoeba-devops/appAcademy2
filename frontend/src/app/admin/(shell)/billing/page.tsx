'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';

interface BillingStatus {
  acdId: number;
  plan: string | null;
  subscriptionStatus: string;
  provisionedAt: string | null;
  canceledAt: string | null;
  amaPortalUrl: string;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-green-500',
  SUSPENDED: 'bg-amber-500',
  CANCELED: 'bg-red-500',
  DEPROVISIONED: 'bg-slate-400',
};

export default function BillingPage() {
  const q = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: () => api.get<BillingStatus>('/billing/status'),
    select: (res) => res.data,
  });

  if (q.isLoading) return <div className="p-4 text-sm text-slate-500">로딩…</div>;
  if (q.error || !q.data)
    return <div className="p-4 text-sm text-red-700">구독 정보를 불러올 수 없습니다.</div>;

  const b = q.data;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">구독 정보</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="text-slate-500">플랜</dt>
          <dd className="col-span-2 font-medium text-slate-900">{b.plan ?? '—'}</dd>

          <dt className="text-slate-500">상태</dt>
          <dd className="col-span-2 flex items-center gap-2 font-medium text-slate-900">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                STATUS_DOT[b.subscriptionStatus] ?? 'bg-slate-300'
              }`}
              aria-hidden="true"
            />
            {b.subscriptionStatus}
          </dd>

          <dt className="text-slate-500">시작일</dt>
          <dd className="col-span-2 text-slate-900">
            {b.provisionedAt ? new Date(b.provisionedAt).toLocaleDateString('ko-KR') : '—'}
          </dd>

          {b.canceledAt && (
            <>
              <dt className="text-slate-500">취소일</dt>
              <dd className="col-span-2 text-slate-900">
                {new Date(b.canceledAt).toLocaleDateString('ko-KR')}
              </dd>
            </>
          )}
        </dl>

        <p className="mt-6 text-xs text-slate-500">
          플랜 변경, 결제 수단, 인보이스는 AMA 결제센터에서 관리합니다.
        </p>
        <a
          href={b.amaPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          AMA 결제센터로 이동
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
