import {
  Body,
  Controller,
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
import { TenantService } from '../application/tenant.service';
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
  constructor(private readonly svc: TenantService) {}

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
  get(@Param('entId', ParseUUIDPipe) entId: string) {
    return this.svc.get(entId);
  }

  @Patch(':entId')
  @ApiOperation({ summary: 'Update tenant name / status (APP_ADMIN)' })
  update(
    @Param('entId', ParseUUIDPipe) entId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.svc.update(entId, dto);
  }

  @Get(':entId/menus')
  @ApiOperation({ summary: 'Get per-tenant admin-menu visibility (APP_ADMIN)' })
  getMenus(@Param('entId', ParseUUIDPipe) entId: string) {
    return this.svc.getMenuConfig(entId);
  }

  @Put(':entId/menus')
  @ApiOperation({ summary: 'Set per-tenant admin-menu visibility (APP_ADMIN)' })
  setMenus(
    @Param('entId', ParseUUIDPipe) entId: string,
    @Body() dto: UpdateTenantMenusDto,
  ) {
    return this.svc.setMenuConfig(entId, dto.items);
  }
}
