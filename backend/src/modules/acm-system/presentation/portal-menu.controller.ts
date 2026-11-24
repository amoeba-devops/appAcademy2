import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { TenantMasterGuard } from '../../acm-common/guards/tenant-master.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import {
  PORTAL_MENU_KEYS,
  PORTAL_MENU_KINDS,
  PortalMenuService,
  type PortalMenuKind,
  type PortalMenuKey,
} from '../application/portal-menu.service';

class PortalMenuUpdateDto {
  @IsIn(PORTAL_MENU_KEYS) key!: PortalMenuKey;
  @IsIn(PORTAL_MENU_KINDS) kind!: PortalMenuKind;
  @IsBoolean() visible!: boolean;
}
export class UpdatePortalMenusDto {
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => PortalMenuUpdateDto)
  items!: PortalMenuUpdateDto[];
}

@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(
  AcmJwtAuthGuard,
  OwnEntityGuard,
  TenantMasterGuard,
  RequirePasswordRotationGuard,
)
@Controller('acm/tenant/portal-menus')
export class TenantPortalMenuController {
  constructor(private readonly menus: PortalMenuService) {}
  @Get()
  @ApiOperation({
    summary: 'Teacher/student portal menu matrix for own tenant',
  })
  list(@CurrentUser() user: AcmCurrentUser) {
    return this.menus.matrix(user.entId);
  }
  @Put()
  @ApiOperation({ summary: 'Save teacher/student portal menu visibility' })
  save(@CurrentUser() user: AcmCurrentUser, @Body() dto: UpdatePortalMenusDto) {
    return this.menus.save(user.entId, dto.items);
  }
}

@ApiTags('portal')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/me/menus')
export class PortalMenuController {
  constructor(private readonly menus: PortalMenuService) {}
  @Get()
  @ApiOperation({
    summary: 'Effective academy portal menus for the authenticated account',
  })
  nav(@PortalUser() user: PortalAuthUser) {
    return this.menus.nav(user.entId, user.kind);
  }
}
