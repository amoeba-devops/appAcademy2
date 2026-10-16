import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useAuthStore } from '@/stores/auth.store';
import {
  canIssueTempPassword,
  errorCode,
  TempPasswordResultDialog,
  type TempPasswordResult,
} from '../components/temp-password';

/** REQ-261017 — 비밀번호 재발급 요청(관리자). */
interface ResetRequestRow {
  prr_id: string;
  usr_id: string;
  prr_status: 'REQUESTED' | 'ISSUED' | 'REJECTED';
  prr_requested_at: string;
  prr_mail_sent: boolean;
  handled_at: string | null;
  usr_name: string;
  usr_email: string;
  usr_role: string;
  auth_source: string | null;
  handled_by_name: string | null;
}
type StatusFilter = '' | ResetRequestRow['prr_status'];
const STATUSES: StatusFilter[] = ['REQUESTED', 'ISSUED', 'REJECTED', ''];
const BADGE: Record<ResetRequestRow['prr_status'], string> = {
  REQUESTED: 'bg-amber-100 text-amber-800',
  ISSUED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-100 text-gray-700',
};

export function PasswordRequestsPage() {
  const { t, i18n } = useTranslation('auth');
  const role = useAuthStore((s) => s.user?.role);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('REQUESTED');
  const [result, setResult] = useState<{ r: TempPasswordResult; email: string } | null>(null);
  const [error, setError] = useState('');
  const list = useQuery({
    enabled: canIssueTempPassword(role),
    queryKey: ['password-reset-requests', status],
    queryFn: async () =>
      (
        await apiClient.get<ResetRequestRow[]>('/acm/admin/password-reset-requests', {
          params: status ? { status } : {},
        })
      ).data,
  });
  const done = () => qc.invalidateQueries({ queryKey: ['password-reset-requests'] });
  const fail = (err: unknown) =>
    setError(
      errorCode(err) === 'RESET_REQUEST_HANDLED'
        ? t('requests.alreadyHandled')
        : errorCode(err) === 'USER_INACTIVE'
          ? t('temp.inactive')
          : t('temp.failed'),
    );
  const issue = useMutation({
    mutationFn: async (row: ResetRequestRow) =>
      (await apiClient.post<TempPasswordResult>(`/acm/admin/password-reset-requests/${row.prr_id}/issue`)).data,
    onSuccess: (r, row) => {
      setResult({ r, email: row.usr_email });
      void done();
    },
    onError: (err) => {
      fail(err);
      void done();
    },
  });
  const reject = useMutation({
    mutationFn: async (row: ResetRequestRow) =>
      apiClient.post(`/acm/admin/password-reset-requests/${row.prr_id}/reject`),
    onSuccess: () => void done(),
    onError: (err) => {
      fail(err);
      void done();
    },
  });
  const fmt = (v: string) => new Date(v).toLocaleString(i18n.language);
  if (!canIssueTempPassword(role)) return <p role="alert">{t('requests.forbidden')}</p>;
  return (
    <div className="grid w-full min-w-0 gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound size={20} className="text-accent-700" />
          <h1 className="text-xl font-semibold text-primary">{t('requests.title')}</h1>
        </div>
        <div role="tablist" className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s || 'ALL'}
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === s ? 'border-accent-700 bg-accent-700 text-white' : 'bg-surface text-secondary'
              }`}
            >
              {t(`requests.status.${s || 'ALL'}`)}
            </button>
          ))}
        </div>
      </header>
      <p className="text-sm text-secondary">{t('requests.desc')}</p>
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {list.isLoading && <p>{t('requests.loading')}</p>}
      {list.isError && <p role="alert">{t('requests.loadError')}</p>}
      {list.data && list.data.length === 0 && (
        <p className="rounded-lg border bg-surface p-6 text-center text-sm text-secondary">{t('requests.empty')}</p>
      )}
      {list.data && list.data.length > 0 && (
        <ul className="grid gap-2">
          {list.data.map((r) => (
            <li
              key={r.prr_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.usr_name}</span>
                  <span className="truncate text-secondary">{r.usr_email}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${BADGE[r.prr_status]}`}>
                    {t(`requests.status.${r.prr_status}`)}
                  </span>
                  {r.auth_source === 'AMA' && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">AMA</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-secondary">
                  {t('requests.requestedAt', { at: fmt(r.prr_requested_at) })}
                  {r.handled_at &&
                    ` · ${t('requests.handled', {
                      at: fmt(r.handled_at),
                      by: r.handled_by_name ?? '—',
                    })}`}
                  {r.prr_status === 'ISSUED' && ` · ${r.prr_mail_sent ? t('requests.mailed') : t('requests.shown')}`}
                </p>
              </div>
              {r.prr_status === 'REQUESTED' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={issue.isPending || reject.isPending}
                    onClick={async () => {
                      setError('');
                      if (
                        await confirm({
                          title: t('temp.confirmTitle'),
                          description: t('temp.confirmDesc'),
                          confirmLabel: t('temp.issue'),
                        })
                      )
                        issue.mutate(r);
                    }}
                  >
                    {t('temp.issue')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={issue.isPending || reject.isPending}
                    onClick={async () => {
                      setError('');
                      if (
                        await confirm({
                          title: t('requests.rejectTitle'),
                          description: t('requests.rejectDesc'),
                          confirmLabel: t('requests.reject'),
                          variant: 'destructive',
                        })
                      )
                        reject.mutate(r);
                    }}
                  >
                    {t('requests.reject')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {result && (
        <TempPasswordResultDialog result={result.r} email={result.email} close={() => setResult(null)} />
      )}
    </div>
  );
}
