import type { Request } from 'express';
import type { Scope } from './dto/scheduler.dto';
export interface IntegrationPrincipal {
  entId: string;
  clientId: string;
  keyId: string;
  actorId: string;
  clientName: string;
  scopes: Scope[];
}
export interface IntegrationRequest extends Request {
  integration: IntegrationPrincipal;
}
export interface WriteResult {
  status: number;
  data: Record<string, unknown>;
  etag?: string;
}
