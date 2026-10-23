import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../datasource';
import type { AcmCurrentUser } from '../decorators/current-user.decorator';
import { hasUserPermission } from './config-admin.guard';

/** REQ-261015C — tenant settings (테넌트 설정) are limited to the tenant master. */
@Injectable()
export class TenantMasterGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AcmCurrentUser }>();
    if (!(await hasUserPermission(this.ds, user, 'TENANT_MASTER')))
      throw new ForbiddenException('TENANT_MASTER permission required');
    return true;
  }
}

/** Timezone etc.: tenant master, or the service operator (CONFIG_ADMIN). */
@Injectable()
export class TenantSettingsGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AcmCurrentUser }>();
    if (
      (await hasUserPermission(this.ds, user, 'TENANT_MASTER')) ||
      (await hasUserPermission(this.ds, user, 'CONFIG_ADMIN'))
    )
      return true;
    throw new ForbiddenException('TENANT_MASTER permission required');
  }
}

/** REQ-261021B — audit menu: tenant master, or AUDIT_VIEWER (read only). */
export async function canViewAudit(
  ds: DataSource,
  user: AcmCurrentUser | undefined,
): Promise<boolean> {
  return (
    (await hasUserPermission(ds, user, 'TENANT_MASTER')) ||
    (await hasUserPermission(ds, user, 'AUDIT_VIEWER'))
  );
}

@Injectable()
export class AuditViewerGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AcmCurrentUser }>();
    if (await canViewAudit(this.ds, user)) return true;
    throw new ForbiddenException('AUDIT_VIEWER permission required');
  }
}

/**
 * REQ-261024 Q-A2 — deleting consultations/students: an administrator (ADMIN/APP_ADMIN) who is
 * also the service operator (CONFIG_ADMIN) or the tenant master. Replaces the AMA-account rule.
 */
export async function canDeleteRecords(ds: DataSource, user: AcmCurrentUser | undefined): Promise<boolean> {
  if (!user || !['ADMIN', 'APP_ADMIN'].includes(user.role ?? '')) return false;
  return (
    (await hasUserPermission(ds, user, 'CONFIG_ADMIN')) ||
    (await hasUserPermission(ds, user, 'TENANT_MASTER'))
  );
}

@Injectable()
export class RecordDeleteGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (await canDeleteRecords(this.ds, user)) return true;
    throw new ForbiddenException('DELETE_PERMISSION_REQUIRED');
  }
}
