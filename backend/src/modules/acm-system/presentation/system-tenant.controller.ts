import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { IsUUID } from 'class-validator';
import { TenantService } from '../application/tenant.service';
import { ParseEntIdPipe } from '../../acm-common/validators/ent-id';
import { TenantRoleMenuService } from '../application/tenant-role-menu.service';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';

export class GrantTenantMasterDto {
  @IsUUID() userId!: string;
}
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateTenantMenusDto,
} from '../application/dto/tenant.dto';

/**
 * REQ-260621 v1.1 — tenant registry + per-tenant admin-menu visibility.
 * Cross-tenant; APP_ADMIN only (+ password rotation required). No OwnEntityGuard.
 */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, RolesGuard, RequirePasswordRotationGuard)
@Roles('APP_ADMIN')
@Controller('acm/system/tenants')
export class SystemTenantController {
  constructor(
    private readonly svc: TenantService,
    private readonly roleMenus: TenantRoleMenuService,
  ) {}

  // REQ-261015C — 테넌트 마스터 지정/해제.
  @Get(':entId/masters')
  @ApiOperation({ summary: 'List tenant masters (APP_ADMIN)' })
  masters(@Param('entId', ParseEntIdPipe) entId: string) {
    return this.roleMenus.masters(entId);
  }

  @Post(':entId/masters')
  @ApiOperation({ summary: 'Grant tenant master (APP_ADMIN)' })
  grantMaster(
    @Param('entId', ParseEntIdPipe) entId: string,
    @Body() dto: GrantTenantMasterDto,
    @CurrentUser() user: AcmCurrentUser,
  ) {
    return this.roleMenus.grantMaster(entId, dto.userId, user.id);
  }

  @Delete(':entId/masters/:userId')
  @ApiOperation({ summary: 'Revoke tenant master (APP_ADMIN)' })
  revokeMaster(
    @Param('entId', ParseEntIdPipe) entId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.roleMenus.revokeMaster(entId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants (APP_ADMIN)' })
  list() {
    return this.svc.list();
  }

  @Post()
  @ApiOperation({ summary: 'Register a tenant (APP_ADMIN)' })
  create(@Body() dto: CreateTenantDto) {
    return this.svc.create(dto);
  }

  @Get(':entId')
  @ApiOperation({ summary: 'Get tenant detail (APP_ADMIN)' })
  get(@Param('entId', ParseEntIdPipe) entId: string) {
    return this.svc.get(entId);
  }

  @Patch(':entId')
  @ApiOperation({ summary: 'Update tenant name / status (APP_ADMIN)' })
  update(
    @Param('entId', ParseEntIdPipe) entId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.svc.update(entId, dto);
  }

  @Get(':entId/menus')
  @ApiOperation({ summary: 'Get per-tenant admin-menu visibility (APP_ADMIN)' })
  getMenus(@Param('entId', ParseEntIdPipe) entId: string) {
    return this.svc.getMenuConfig(entId);
  }

  @Put(':entId/menus')
  @ApiOperation({ summary: 'Set per-tenant admin-menu visibility (APP_ADMIN)' })
  setMenus(
    @Param('entId', ParseEntIdPipe) entId: string,
    @Body() dto: UpdateTenantMenusDto,
  ) {
    return this.svc.setMenuConfig(entId, dto.items);
  }
}
