import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { hasUserPermission } from '../../acm-common/guards/config-admin.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { TenantRoleMenuService } from '../application/tenant-role-menu.service';
import {
  TenantCustomMenuService,
  type NavCustomMenu,
} from '../application/tenant-custom-menu.service';

/**
 * REQ-260621 v1.1 — the admin shell asks which sidebar menus are hidden for the
 * caller's own tenant. Any authenticated ACM user (own ent_id only) — NOT gated
 * by APP_ADMIN. UI-only: hiding a menu does not relax backend tenant scoping.
 */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('acm/me')
export class MeMenuController {
  constructor(
    private readonly svc: TenantRoleMenuService,
    private readonly custom: TenantCustomMenuService,
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
  ) {}

  @Get('menus')
  @ApiOperation({
    summary: "Hidden + ordered admin-menu keys for the caller's tenant",
  })
  async menus(
    @CurrentUser() user: AcmCurrentUser,
  ): Promise<{ hidden: string[]; order: string[]; custom: NavCustomMenu[] }> {
    // REQ-261015C — 테넌트 허가 AND 등급별 노출(테넌트 마스터 설정).
    // 테넌트 마스터 본인은 등급 숨김 없이 허가된 메뉴를 모두 본다.
    const master = await hasUserPermission(this.ds, user, 'TENANT_MASTER');
    const [nav, custom] = await Promise.all([
      this.svc.navFor(user.entId, user.role, master),
      // REQ-261026 — 사용자 메뉴(북마크)도 등급 노출을 따른다.
      this.custom.navFor(user.entId, user.role, master),
    ]);
    return { ...nav, custom };
  }
}
