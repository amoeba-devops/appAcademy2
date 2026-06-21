import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { TenantService } from '../application/tenant.service';

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
  constructor(private readonly svc: TenantService) {}

  @Get('menus')
  @ApiOperation({ summary: "Hidden admin-menu keys for the caller's tenant" })
  async menus(@CurrentUser() user: AcmCurrentUser): Promise<{ hidden: string[] }> {
    return { hidden: await this.svc.getHiddenKeys(user.entId) };
  }
}
