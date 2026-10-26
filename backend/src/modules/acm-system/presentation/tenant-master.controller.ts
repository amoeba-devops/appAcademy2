import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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
import {
  CUSTOM_MENU_GROUPS,
  CUSTOM_MENU_LIMIT,
  CUSTOM_MENU_OPEN_MODES,
  CUSTOM_MENU_URL_PATTERN,
  TenantCustomMenuService,
  type CustomMenuGroup,
  type CustomMenuOpenMode,
} from '../application/tenant-custom-menu.service';

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

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** REQ-261026 — 사용자 메뉴(북마크) 추가·수정. */
export class CustomMenuDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(500)
  @Matches(CUSTOM_MENU_URL_PATTERN, {
    message: 'url must be an internal path (/...) or an http(s) URL',
  })
  url!: string;

  @IsBoolean() newTab!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(MENU_ROLES, { each: true })
  roles!: MenuRole[];

  // REQ-261026B — 생략 시 기존 동작(북마크 그룹 · 링크).
  @IsOptional()
  @IsIn(CUSTOM_MENU_GROUPS)
  group: CustomMenuGroup = 'BOOKMARKS';

  @IsOptional()
  @IsIn(CUSTOM_MENU_OPEN_MODES)
  openMode: CustomMenuOpenMode = 'LINK';
}
export class CustomMenuOrderDto {
  @IsArray()
  @ArrayMaxSize(CUSTOM_MENU_LIMIT)
  @IsUUID('all', { each: true })
  ids!: string[];
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
  constructor(
    private readonly svc: TenantRoleMenuService,
    private readonly custom: TenantCustomMenuService,
  ) {}

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

  // REQ-261026 — 사용자 메뉴(북마크).
  @Get('custom-menus')
  @ApiOperation({ summary: 'List custom sidebar menus (bookmarks)' })
  customMenus(@CurrentUser() user: AcmCurrentUser) {
    return this.custom.list(user.entId);
  }

  @Post('custom-menus')
  @ApiOperation({ summary: 'Add a custom sidebar menu' })
  addCustomMenu(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CustomMenuDto,
  ) {
    return this.custom.create(user.entId, dto);
  }

  @Put('custom-menus/order')
  @ApiOperation({ summary: 'Reorder custom sidebar menus' })
  reorderCustomMenus(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CustomMenuOrderDto,
  ) {
    return this.custom.reorder(user.entId, dto.ids);
  }

  @Patch('custom-menus/:id')
  @ApiOperation({ summary: 'Update a custom sidebar menu' })
  updateCustomMenu(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomMenuDto,
  ) {
    return this.custom.update(user.entId, id, dto);
  }

  @Delete('custom-menus/:id')
  @ApiOperation({ summary: 'Delete a custom sidebar menu' })
  deleteCustomMenu(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.custom.remove(user.entId, id);
  }
}
