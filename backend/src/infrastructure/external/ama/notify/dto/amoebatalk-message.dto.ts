/**
 * AmoebaTalk message DTO sent to provider.
 *
 * @see docs/implementation/tasks/AMOEBATALK-NOTIFY-TASK-1.0.0.md §2.4 B-02
 */
export interface AmoebaTalkSendDto {
  to: string; // Phone (010-XXXX-XXXX or E.164)
  templateCode: string; // Maps to ntf_event in current spec (B-03)
  variables: Record<string, string>;
  body?: string; // Pre-rendered body (some providers require it as fallback)
}

export interface AmoebaTalkSendResultDto {
  messageId: string;
  status: 'ACCEPTED' | 'SENT' | 'FAILED';
}
