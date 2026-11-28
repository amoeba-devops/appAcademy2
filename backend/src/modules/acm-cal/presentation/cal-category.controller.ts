import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import {
  CAL_CATEGORY_NAME_MAX,
  CalCategoryService,
} from '../application/cal-category.service';
import { CAL_CATEGORY_CODE_RE } from '../application/cal-category';
import { HEX_COLOR_RE } from '../application/cal-color.service';

class CalCategoryItemDto {
  @IsOptional()
  @Matches(CAL_CATEGORY_CODE_RE)
  code?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(CAL_CATEGORY_NAME_MAX)
  name?: string | null;

  /** `#RRGGBB`; null resets to the default color. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(HEX_COLOR_RE)
  color?: string | null;

  @IsOptional()
  @IsBoolean()
  inStats?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;
}

class SaveCalCategoriesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CalCategoryItemDto)
  items!: CalCategoryItemDto[];
}

/** REQ-261128-CAL — calendar category management. */
@ApiTags('acm-cal')
@ApiBearerAuth()
@Controller('acm/cal/categories')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER')
export class CalCategoryController {
  constructor(private readonly svc: CalCategoryService) {}

  @Get()
  list(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.list(u.entId);
  }

  @Put()
  @Roles('ADMIN')
  save(@CurrentUser() u: AcmCurrentUser, @Body() dto: SaveCalCategoriesDto) {
    return this.svc.save(u.entId, dto.items);
  }

  @Delete(':code')
  @Roles('ADMIN')
  remove(@CurrentUser() u: AcmCurrentUser, @Param('code') code: string) {
    return this.svc.remove(u.entId, code);
  }
}

/** Read-only list for the portal calendar (names + colors). */
@ApiTags('portal-cal')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/cal/categories')
export class PortalCalCategoryController {
  constructor(private readonly svc: CalCategoryService) {}

  @Get()
  async list(@PortalUser() u: PortalAuthUser) {
    return (await this.svc.list(u.entId, false)).map(
      ({ code, name, system, sortOrder, color, active }) => ({
        code,
        name,
        system,
        sortOrder,
        color,
        active,
      }),
    );
  }
}
