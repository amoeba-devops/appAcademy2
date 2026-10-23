import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { StudentLinkService } from '../application/student-link.service';

class StudentLinkItemDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  eventIds!: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  stdIds!: string[];
}
class ApplyStudentLinksDto {
  @ApiProperty({ type: [StudentLinkItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => StudentLinkItemDto)
  items!: StudentLinkItemDto[];
}

/** REQ-261023B — 수업 일정 > 학생 연결 정리 (관리자). */
@ApiTags('acm-cal')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
@Controller('acm/cal/student-links')
export class StudentLinkController {
  constructor(private readonly svc: StudentLinkService) {}

  @Get('preview')
  @ApiOperation({
    summary:
      'Events without a STUDENT invitee, grouped by title, with name-matched students',
  })
  preview(
    @CurrentUser() u: AcmCurrentUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('category') category?: string,
    @Query('includeWithdrawn') includeWithdrawn?: string,
  ) {
    return this.svc.preview(u.entId, {
      from,
      to,
      category,
      includeWithdrawn: includeWithdrawn === 'true',
    });
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add the chosen students as invitees (no mail)' })
  apply(@CurrentUser() u: AcmCurrentUser, @Body() dto: ApplyStudentLinksDto) {
    return this.svc.apply(u.entId, u.id, dto.items);
  }
}
