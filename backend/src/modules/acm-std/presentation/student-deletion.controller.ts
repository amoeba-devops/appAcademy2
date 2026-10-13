import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { IsBoolean, IsString, Length, Matches } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { StudentDeletionService } from '../application/student-deletion.service';
class PurgeStudentDto {
  @IsString() @Length(1, 100) name!: string;
  @IsBoolean() testConfirmed!: boolean;
  @IsString() @Matches(/^[a-f0-9]{64}$/) version!: string;
}
@Controller('acm/std/deletion')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
export class StudentDeletionController {
  constructor(private readonly service: StudentDeletionService) {}
  @Get('access') access(@CurrentUser() u: AcmCurrentUser) {
    return this.service.access(u);
  }
  @Get('archived') list(
    @CurrentUser() u: AcmCurrentUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (page < 1 || page > 100000)
      throw new BadRequestException('INVALID_PAGE');
    return this.service.list(u, page);
  }
  @Get('history') history(
    @CurrentUser() u: AcmCurrentUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (page < 1 || page > 100000)
      throw new BadRequestException('INVALID_PAGE');
    return this.service.list(u, page, true);
  }
  @Get(':id/preview') preview(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.preview(u, id);
  }
  @Post(':id/purge') purge(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PurgeStudentDto,
  ) {
    return this.service.purge(u, id, dto);
  }
}
