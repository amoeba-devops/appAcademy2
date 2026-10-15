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
