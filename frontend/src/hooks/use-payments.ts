'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  CalculateRefundRequest,
  ConfirmPaymentRequest,
  CreatePaymentOrderRequest,
  CreateTaxInvoiceRequest,
  ExecuteRefundRequest,
  PaymentOrder,
  RefundCalculationResult,
  TaxInvoice,
} from '@/types/payment';

export function usePaymentOrders(filters?: {
  status?: string;
  enrollmentId?: number;
  method?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.enrollmentId) params.set('enrollmentId', String(filters.enrollmentId));
  if (filters?.method) params.set('method', filters.method);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  const qs = params.toString();

  return useQuery({
    queryKey: ['paymentOrders', filters],
    queryFn: () => api.get<PaymentOrder[]>(`/payments/orders${qs ? `?${qs}` : ''}`),
    select: (res) => res.data ?? [],
  });
}

export function usePaymentOrder(id: number) {
  return useQuery({
    queryKey: ['paymentOrders', id],
    queryFn: () => api.get<PaymentOrder>(`/payments/orders/${id}`),
    select: (res) => res.data ?? null,
    enabled: id > 0,
  });
}

export function useCreatePaymentOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentOrderRequest) =>
      api.post<PaymentOrder>('/payments/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentOrders'] });
    },
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ConfirmPaymentRequest) =>
      api.post<PaymentOrder>('/payments/confirm', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentOrders'] });
    },
  });
}

export function useCalculateRefund() {
  return useMutation({
    mutationFn: (data: CalculateRefundRequest) =>
      api.post<RefundCalculationResult>('/payments/refund/calculate', data),
  });
}

export function useExecuteRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExecuteRefundRequest) =>
      api.post<{ orderId: number; status: string; refundAmount: number }>(
        '/payments/refund/execute',
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentOrders'] });
    },
  });
}

// --- Tax Invoice Hooks ---

export function useTaxInvoices(filters?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  const qs = params.toString();

  return useQuery<TaxInvoice[]>({
    queryKey: ['taxInvoices', filters],
    queryFn: async () => {
      const res = await api.get<TaxInvoice[]>(`/payments/tax-invoices${qs ? `?${qs}` : ''}`);
      return res.data ?? [];
    },
  });
}

export function useTaxInvoice(id: number | null) {
  return useQuery<TaxInvoice>({
    queryKey: ['taxInvoice', id],
    queryFn: async () => {
      const res = await api.get<TaxInvoice>(`/payments/tax-invoices/${id}`);
      return res.data!;
    },
    enabled: !!id,
  });
}

export function useCreateTaxInvoice() {
  const queryClient = useQueryClient();
  return useMutation<TaxInvoice, Error, CreateTaxInvoiceRequest>({
    mutationFn: async (data) => {
      const res = await api.post<TaxInvoice>('/payments/tax-invoices', data);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxInvoices'] });
    },
  });
}

export function useSubmitTaxInvoice() {
  const queryClient = useQueryClient();
  return useMutation<TaxInvoice, Error, number>({
    mutationFn: async (id) => {
      const res = await api.post<TaxInvoice>(`/payments/tax-invoices/${id}/submit`);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['taxInvoice'] });
    },
  });
}
