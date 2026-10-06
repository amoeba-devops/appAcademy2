import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  ConfigAdminGuard,
  hasConfigPermission,
} from '../../acm-common/guards/config-admin.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RequirePasswordRotationGuard } from '../../acm-common/guards/require-password-rotation.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ACM_DS } from '../../acm-common/datasource';
import { ALL_MENU_KEYS } from '../application/admin-menu-keys';
import { TenantService } from '../application/tenant.service';

export class ConfigMenuItemDto {
  @IsIn(ALL_MENU_KEYS) key!: string;
  @IsBoolean() visible!: boolean;
}
export class ConfigMenuDto {
  @IsArray()
  @ArrayMaxSize(64)
  @ArrayUnique((item: ConfigMenuItemDto | null) => item?.key)
  @ValidateNested({ each: true })
  @Type(() => ConfigMenuItemDto)
  items!: ConfigMenuItemDto[];
}

@Controller('acm/me')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
export class ConfigAccessController {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly tenants: TenantService,
  ) {}

  @Get('config-access')
  async access(@CurrentUser() user: AcmCurrentUser) {
    return { canManageConfig: await hasConfigPermission(this.ds, user) };
  }

  @Get('config-menus')
  @UseGuards(ConfigAdminGuard, RequirePasswordRotationGuard)
  async menus(@CurrentUser() user: AcmCurrentUser) {
    const items = await this.tenants.getMenuConfig(user.entId);
    return items.map((item) =>
      item.key === 'config' ? { ...item, visible: true, alwaysOn: true } : item,
    );
  }

  @Put('config-menus')
  @UseGuards(ConfigAdminGuard, RequirePasswordRotationGuard)
  async save(@CurrentUser() user: AcmCurrentUser, @Body() dto: ConfigMenuDto) {
    if (
      dto.items.some(
        (item) => ['dashboard', 'config'].includes(item.key) && !item.visible,
      )
    ) {
      throw new BadRequestException(
        'Dashboard and configuration access must remain visible',
      );
    }
    await this.ds.transaction(async (manager) => {
      for (const item of dto.items) {
        // Only visibility changes; existing customized order stays intact.
        await manager.query(
          `INSERT INTO amb_acm_tenant_menu (tnm_ent_id,tnm_menu_key,tnm_visible)
           VALUES ($1,$2,$3) ON CONFLICT (tnm_ent_id,tnm_menu_key)
           DO UPDATE SET tnm_visible=EXCLUDED.tnm_visible, updated_at=NOW()`,
          [user.entId, item.key, item.visible],
        );
      }
    });
    return this.menus(user);
  }
}
