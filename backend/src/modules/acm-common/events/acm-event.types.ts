/**
 * ACM cross-module event payloads.
 * @see ADR-002 — modules communicate via EventEmitter, no direct service injection.
 */

export type AcmEventName =
  | 'acm.csl.created'
  | 'acm.csl.status.changed'
  | 'acm.csl.enrolled'
  | 'acm.qna.created'
  | 'acm.qna.responded'
  | 'acm.qna.escalated'
  | 'acm.ref.published'
  | 'acm.sch.created'
  | 'acm.sch.updated';

export interface BaseEvent {
  entId: string;
  occurredAt: string; // ISO 8601
  actorId?: string;
}

export interface CslCreatedEvent extends BaseEvent {
  consultationId: string;
  studentName: string;
  schoolId?: string;
}

export interface CslStatusChangedEvent extends BaseEvent {
  consultationId: string;
  fromStatus: string;
  toStatus: string;
}

export interface QnaCreatedEvent extends BaseEvent {
  questionId: string;
  studentId?: string;
  parentId?: string;
}

export interface RefPublishedEvent extends BaseEvent {
  referenceId: string;
  schoolId: string;
  effectiveFrom: string;
}
