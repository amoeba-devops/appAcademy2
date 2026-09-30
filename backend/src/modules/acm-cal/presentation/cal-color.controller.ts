import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { CalColorService, PALETTES } from '../application/cal-color.service';
class ColorDto {
  @IsIn(['CATEGORY', 'ASSIGNEE']) kind!: 'CATEGORY' | 'ASSIGNEE';
  @IsString() @MaxLength(50) target!: string;
  @IsIn(PALETTES) palette!: string;
}
class ColorsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ColorDto)
  items!: ColorDto[];
}
@Controller('acm/cal/color-settings')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER')
export class CalColorController {
  constructor(private readonly svc: CalColorService) {}
  @Get() list(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.list(u.entId);
  }
  @Put() @Roles('ADMIN') save(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ColorsDto,
  ) {
    return this.svc.save(u.entId, dto.items);
  }
}
