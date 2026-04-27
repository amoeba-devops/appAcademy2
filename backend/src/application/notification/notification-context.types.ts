/**
 * NotificationContext — payload emitted by domain use-cases for the dispatcher.
 *
 * Domain modules MUST NOT depend on the notification module; instead they emit
 * one of the events below with this structure (ADR-002 boundary).
 */
export interface NotificationContext {
  academyId: number;
  /** Recipient phone number (one or many). */
  recipients: string[];
  /** Recipient kind for audit (PARENT / STUDENT / STAFF). */
  recipientKind?: 'PARENT' | 'STUDENT' | 'STAFF';
  /** Domain entity reference for traceability. */
  subjectId?: number;
  subjectKind?: string;
  /** Template variable bindings. Keys must match `ntf_variables`. */
  variables: Record<string, string | number>;
}

/** Canonical event names — keep in sync with `tac_notification_templates.ntf_event`. */
export const NOTIFICATION_EVENTS = {
  ConsultationReceived: 'tac.consultation.received',
  EnrollmentConfirmed: 'tac.enrollment.confirmed',
  PaymentDone: 'tac.payment.done',
  RefundDone: 'tac.refund.done',
  MapScorePublished: 'tac.map.score.published',
  ClassAbsent: 'tac.class.absent',
  TaxInvoiceApproved: 'tac.tax.invoice.approved',
} as const;

export type NotificationEventName =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/** Mapping from event name → ntf_event column value (template lookup key). */
export const EVENT_TO_NTF_EVENT: Record<NotificationEventName, string> = {
  'tac.consultation.received': 'CONSULTATION_RECEIVED',
  'tac.enrollment.confirmed': 'ENROLLMENT_CONFIRMED',
  'tac.payment.done': 'PAYMENT_DONE',
  'tac.refund.done': 'REFUND_DONE',
  'tac.map.score.published': 'MAP_SCORE',
  'tac.class.absent': 'CLASS_ABSENT',
  'tac.tax.invoice.approved': 'TAX_INVOICE_APPROVED',
};
