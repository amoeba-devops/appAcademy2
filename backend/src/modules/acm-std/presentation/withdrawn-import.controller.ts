import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsDateString, IsObject } from 'class-validator';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { WithdrawnImportService } from '../application/withdrawn-import.service';
import { CommitSiteImportDto } from '../application/dto/site-import.dto';
class EditWithdrawnRecordDto {
  @IsObject() fields!: Record<string, unknown>;
  @IsDateString() updatedAt!: string;
}
@Controller('acm/std/withdrawn')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
export class WithdrawnImportController {
  constructor(private readonly service: WithdrawnImportService) {}
  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  preview(
    @CurrentUser() user: AcmCurrentUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    return this.service.preview(user.entId, user.id, file.buffer);
  }
  @Post('commit') commit(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CommitSiteImportDto,
  ) {
    return this.service.commit(user.entId, user.id, dto);
  }
  @Get(':id/records') records(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.records(user.entId, id);
  }
  @Put(':id/records/:recordId') edit(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: EditWithdrawnRecordDto,
  ) {
    return this.service.edit(
      user.entId,
      id,
      recordId,
      user.id,
      dto.fields,
      dto.updatedAt,
    );
  }
}
