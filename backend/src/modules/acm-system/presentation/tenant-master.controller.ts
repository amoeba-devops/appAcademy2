import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import { TenantMasterGuard } from '../../acm-common/guards/tenant-master.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ALL_MENU_KEYS } from '../application/admin-menu-keys';
import {
  MENU_ROLES,
  TenantRoleMenuService,
  type MenuRole,
} from '../application/tenant-role-menu.service';

export class RoleMenuItemDto {
  @IsIn(ALL_MENU_KEYS) key!: string;
  @IsIn(MENU_ROLES) role!: MenuRole;
  @IsBoolean() visible!: boolean;
}
export class RoleMenuDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => RoleMenuItemDto)
  items!: RoleMenuItemDto[];
}

/** REQ-261015C — 테넌트 설정: 등급별 좌측 메뉴 노출 (테넌트 마스터 전용, 자기 테넌트). */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  TenantMasterGuard,
  RequirePasswordRotationGuard,
)
@Controller('acm/tenant')
export class TenantMasterController {
  constructor(private readonly svc: TenantRoleMenuService) {}

  @Get('menus')
  @ApiOperation({ summary: 'Per-role menu visibility of allowed menus' })
  menus(@CurrentUser() user: AcmCurrentUser) {
    return this.svc.matrix(user.entId);
  }

  @Put('menus')
  @ApiOperation({ summary: 'Save per-role menu visibility' })
  save(@CurrentUser() user: AcmCurrentUser, @Body() dto: RoleMenuDto) {
    return this.svc.save(user.entId, dto.items);
  }
}
