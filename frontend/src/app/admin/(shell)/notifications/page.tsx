'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useNotificationLogs,
  useResendNotification,
  type NotificationLogFilters,
} from '@/hooks/use-notifications';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NotificationLogDetailModal } from '@/components/admin/notification/log-detail-modal';
import { RotateCcw, RefreshCw } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  SENT: 'default',
  PENDING: 'secondary',
  RETRYING: 'secondary',
  FAILED: 'destructive',
};

const EVENT_OPTIONS = [
  'CONSULTATION_RECEIVED',
  'ENROLLMENT_CONFIRMED',
  'PAYMENT_DONE',
  'REFUND_DONE',
  'MAP_SCORE',
  'CLASS_ABSENT',
  'TAX_INVOICE_APPROVED',
];

const STATUS_OPTIONS = ['PENDING', 'SENT', 'FAILED', 'RETRYING'];

export default function NotificationLogsPage() {
  const { t } = useTranslation('admin');
  const [filters, setFilters] = useState<NotificationLogFilters>({
    page: 1,
    limit: 20,
  });
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useNotificationLogs(filters);
  const resend = useResendNotification();

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (filters.limit ?? 20)));

  async function handleResend(id: number) {
    try {
      await resend.mutateAsync(id);
      alert(t('notifications.toast.resentOk', '재발송 완료'));
    } catch (err) {
      alert(
        t('notifications.toast.resentFail', '재발송 실패: {{msg}}', {
          msg: (err as Error).message,
        }),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('notifications.logs.title', '알림 발송 이력')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'notifications.logs.subtitle',
              'AmoebaTalk 발송 결과를 조회하고 실패 건을 재발송할 수 있습니다.',
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('common.refresh', '새로고침')}
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Select
          value={filters.event ?? 'ALL'}
          onValueChange={(v) =>
            setFilters((p) => ({ ...p, event: !v || v === 'ALL' ? undefined : v, page: 1 }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('notifications.filter.event', '이벤트')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.all', '전체')}</SelectItem>
            {EVENT_OPTIONS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? 'ALL'}
          onValueChange={(v) =>
            setFilters((p) => ({ ...p, status: !v || v === 'ALL' ? undefined : v, page: 1 }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t('notifications.filter.status', '상태')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('common.all', '전체')}</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filters.from ?? ''}
          onChange={(e) =>
            setFilters((p) => ({ ...p, from: e.target.value || undefined, page: 1 }))
          }
          placeholder={t('notifications.filter.from', '시작일')}
        />
        <Input
          type="date"
          value={filters.to ?? ''}
          onChange={(e) =>
            setFilters((p) => ({ ...p, to: e.target.value || undefined, page: 1 }))
          }
          placeholder={t('notifications.filter.to', '종료일')}
        />
        <Button
          variant="ghost"
          onClick={() => setFilters({ page: 1, limit: 20 })}
        >
          {t('common.reset', '초기화')}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('notifications.col.id', 'ID')}</TableHead>
              <TableHead>{t('notifications.col.event', '이벤트')}</TableHead>
              <TableHead>{t('notifications.col.recipient', '수신자')}</TableHead>
              <TableHead>{t('notifications.col.channel', '채널')}</TableHead>
              <TableHead>{t('notifications.col.status', '상태')}</TableHead>
              <TableHead>{t('notifications.col.attempts', '시도')}</TableHead>
              <TableHead>{t('notifications.col.createdAt', '발송시각')}</TableHead>
              <TableHead className="text-right">
                {t('notifications.col.action', '작업')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t('common.loading', '불러오는 중...')}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t('notifications.empty', '발송 이력이 없습니다.')}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setDetailId(row.id)}
                >
                  <TableCell className="font-mono text-xs">{row.id}</TableCell>
                  <TableCell className="text-sm">{row.event}</TableCell>
                  <TableCell className="font-mono text-xs">{row.recipient}</TableCell>
                  <TableCell className="text-xs">{row.channel}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{row.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status !== 'SENT' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleResend(row.id);
                        }}
                        disabled={resend.isPending}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        {t('notifications.action.resend', '재발송')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t('notifications.pagination.total', '총 {{n}}건', { n: total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() =>
              setFilters((p) => ({ ...p, page: Math.max(1, (p.page ?? 1) - 1) }))
            }
          >
            ←
          </Button>
          <span>
            {filters.page ?? 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={(filters.page ?? 1) >= totalPages}
            onClick={() =>
              setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))
            }
          >
            →
          </Button>
        </div>
      </div>

      {detailId !== null && (
        <NotificationLogDetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onResend={handleResend}
        />
      )}
    </div>
  );
}
