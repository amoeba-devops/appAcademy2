export interface Complaint {
  id: string;
  date: string;
  site: 'TPI' | 'TRINITY' | 'SANTACROCE' | null;
  channel: 'PHONE' | 'EMAIL' | 'CHAT' | 'IN_PERSON' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  subject: string | null;
  description: string | null;
  linkedQnaId: string | null;
  createdAt: string;
  updatedAt: string;
}
