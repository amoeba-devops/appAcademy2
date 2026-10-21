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

export type AcmUserPermission = 'CONFIG_ADMIN' | 'TENANT_MASTER' | 'AUDIT_VIEWER';

export function hasConfigPermission(
  ds: DataSource,
  user?: Pick<AcmCurrentUser, 'id' | 'entId'>,
): Promise<boolean> {
  return hasUserPermission(ds, user, 'CONFIG_ADMIN');
}

/** REQ-261015C — tenant-scoped supplemental permission, read from DB on every call. */
export async function hasUserPermission(
  ds: DataSource,
  user: Pick<AcmCurrentUser, 'id' | 'entId'> | undefined,
  permission: AcmUserPermission,
): Promise<boolean> {
  if (!user?.id || !user.entId) return false;
  const rows = await ds.query<{ allowed: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM amb_acm_user_permission p
       JOIN amb_acm_user u ON u.usr_id=p.usr_id AND u.ent_id=p.ent_id
       WHERE p.ent_id=$1 AND p.usr_id=$2 AND p.upr_permission=$3
         AND u.usr_status='ACTIVE'
     ) AS allowed`,
    [user.entId, user.id, permission],
  );
  return rows[0]?.allowed === true;
}

@Injectable()
export class ConfigAdminGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AcmCurrentUser }>();
    // Query current grants on every request: stale JWTs cannot retain revoked permission.
    if (!(await hasConfigPermission(this.ds, user)))
      throw new ForbiddenException('CONFIG_ADMIN permission required');
    return true;
  }
}
