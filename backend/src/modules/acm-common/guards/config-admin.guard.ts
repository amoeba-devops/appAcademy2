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

export async function hasConfigPermission(
  ds: DataSource,
  user?: Pick<AcmCurrentUser, 'id' | 'entId'>,
): Promise<boolean> {
  if (!user?.id || !user.entId) return false;
  const rows = await ds.query<{ allowed: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM amb_acm_user_permission p
       JOIN amb_acm_user u ON u.usr_id=p.usr_id AND u.ent_id=p.ent_id
       WHERE p.ent_id=$1 AND p.usr_id=$2 AND p.upr_permission='CONFIG_ADMIN'
         AND u.usr_status='ACTIVE'
     ) AS allowed`,
    [user.entId, user.id],
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
