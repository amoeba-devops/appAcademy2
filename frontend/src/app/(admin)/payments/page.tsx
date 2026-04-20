'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { usePaymentOrders } from '@/hooks/use-payments';
import {
  PAYMENT_STATUS_LABEL_KEYS,
  PAYMENT_STATUS_COLORS,
} from '@/types/payment';
import type { PaymentOrderStatus } from '@/types/payment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Plus,
  Eye,
  DollarSign,
  XCircle,
  Clock,
  FileText,
  Shield,
  Receipt,
} from 'lucide-react';

const STATUS_VALUES: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'payments.filter.status-all' },
  { value: 'READY', labelKey: 'payments.status.READY' },
  { value: 'IN_PROGRESS', labelKey: 'payments.status.IN_PROGRESS' },
  { value: 'DONE', labelKey: 'payments.status.DONE' },
  { value: 'CANCELED', labelKey: 'payments.status.CANCELED' },
  { value: 'PARTIAL_CANCELED', labelKey: 'payments.status.PARTIAL_CANCELED' },
];

export default function PaymentOrdersPage() {
  const { t, i18n } = useTranslation('admin');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const lng = i18n.resolvedLanguage ?? 'ko';

  const formatAmount = (amount: number): string =>
    new Intl.NumberFormat(lng, { style: 'currency', currency: 'KRW' }).format(amount);

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(lng, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const { data: orders = [], isLoading } = usePaymentOrders({
    status: statusFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const totalOrders = orders.length;
  const doneOrders = orders.filter((o) => o.status === 'DONE');
  const totalRevenue = doneOrders.reduce((sum, o) => sum + o.amount, 0);
  const pendingOrders = orders.filter(
    (o) => o.status === 'READY' || o.status === 'IN_PROGRESS',
  ).length;
  const canceledOrders = orders.filter(
    (o) => o.status === 'CANCELED' || o.status === 'PARTIAL_CANCELED',
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('payments.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('payments.lead')}</p>
        </div>
        <Link href="/payments/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            {t('payments.new')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            {t('payments.kpi.total-revenue')}
          </div>
          <p className="text-2xl font-bold mt-1">{formatAmount(totalRevenue)}</p>
          <p className="text-xs text-gray-400">{t('payments.kpi.done-summary', { count: doneOrders.length })}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CreditCard className="h-4 w-4" />
            {t('payments.kpi.total-orders')}
          </div>
          <p className="text-2xl font-bold mt-1">{t('payments.count-suffix', { count: totalOrders })}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            {t('payments.kpi.pending')}
          </div>
          <p className="text-2xl font-bold mt-1 text-blue-600">{t('payments.count-suffix', { count: pendingOrders })}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <XCircle className="h-4 w-4" />
            {t('payments.kpi.canceled')}
          </div>
          <p className="text-2xl font-bold mt-1 text-red-600">{t('payments.count-suffix', { count: canceledOrders })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/payments/tax-invoices"
          className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:border-[#0E1E3A]/30 hover:shadow-sm transition"
        >
          <div className="rounded-lg bg-blue-50 p-2.5">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{t('payments.quick-nav.tax-invoices-title')}</p>
            <p className="text-xs text-gray-500">{t('payments.quick-nav.tax-invoices-desc')}</p>
          </div>
        </Link>
        <Link
          href="/settings/refund-policy"
          className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:border-[#0E1E3A]/30 hover:shadow-sm transition"
        >
          <div className="rounded-lg bg-amber-50 p-2.5">
            <Shield className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{t('payments.quick-nav.refund-policy-title')}</p>
            <p className="text-xs text-gray-500">{t('payments.quick-nav.refund-policy-desc')}</p>
          </div>
        </Link>
        <Link
          href="/payments/receipts"
          className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:border-[#0E1E3A]/30 hover:shadow-sm transition"
        >
          <div className="rounded-lg bg-green-50 p-2.5">
            <Receipt className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{t('payments.quick-nav.receipts-title')}</p>
            <p className="text-xs text-gray-500">{t('payments.quick-nav.receipts-desc')}</p>
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t('payments.filter.status-label')}</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? '')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('payments.filter.status-all')} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_VALUES.map((opt) => (
                <SelectItem key={opt.value || 'all'} value={opt.value}>
                  {t(opt.labelKey as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t('payments.filter.date-from')}</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">{t('payments.filter.date-to')}</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('payments.table.order-no')}</TableHead>
              <TableHead>{t('payments.table.student')}</TableHead>
              <TableHead>{t('payments.table.program')}</TableHead>
              <TableHead className="text-right">{t('payments.table.amount')}</TableHead>
              <TableHead>{t('payments.table.method')}</TableHead>
              <TableHead>{t('payments.table.status')}</TableHead>
              <TableHead>{t('payments.table.approved-at')}</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                  {t('payments.loading')}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                  {t('payments.empty')}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const statusKey = PAYMENT_STATUS_LABEL_KEYS[order.status as PaymentOrderStatus];
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">{order.orderNo}</TableCell>
                    <TableCell>{order.studentName ?? '-'}</TableCell>
                    <TableCell>{order.programName ?? '-'}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(order.amount)}
                    </TableCell>
                    <TableCell>{order.method ?? '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={PAYMENT_STATUS_COLORS[order.status as PaymentOrderStatus] ?? ''}
                      >
                        {statusKey ? t(statusKey as never) : order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(order.approvedAt ?? order.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/payments/orders/${order.id}`}>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
