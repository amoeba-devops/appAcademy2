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
import { hasConfigPermission } from './config-admin.guard';

/** API settings only: an explicit tenant master or an active AMA MASTER admin. */
export async function canManageApi(
  ds: DataSource,
  user?: Pick<AcmCurrentUser, 'id' | 'entId'>,
) {
  if (!user?.id || !user.entId) return false;
  const [row] = await ds.query<{ allowed: boolean }[]>(
    `SELECT EXISTS (
    SELECT 1 FROM amb_acm_user u WHERE u.usr_id=$1 AND u.ent_id=$2 AND u.usr_status='ACTIVE'
      AND ((u.usr_role IN ('ADMIN','APP_ADMIN') AND upper(trim(u.ama_role))='MASTER')
        OR EXISTS (SELECT 1 FROM amb_acm_user_permission p WHERE p.usr_id=u.usr_id AND p.ent_id=u.ent_id AND p.upr_permission='TENANT_MASTER'))
    ) AS allowed`,
    [user.id, user.entId],
  );
  return row?.allowed === true;
}
@Injectable()
export class ApiManagementGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(ctx: ExecutionContext) {
    const { user } = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (!(await canManageApi(this.ds, user)))
      throw new ForbiddenException('API_MASTER_REQUIRED');
    return true;
  }
}
@Injectable()
export class ApiGuideGuard implements CanActivate {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}
  async canActivate(ctx: ExecutionContext) {
    const { user } = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (
      !(await canManageApi(this.ds, user)) &&
      !(await hasConfigPermission(this.ds, user))
    )
      throw new ForbiddenException('API_GUIDE_ACCESS_REQUIRED');
    return true;
  }
}
