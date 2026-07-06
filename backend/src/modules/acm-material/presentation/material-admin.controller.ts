import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { MaterialService } from '../application/material.service';

class UploadMaterialDto {
  @IsUUID() clsId!: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
}

/** PLN-260706 §4.5 — teacher/admin upload + manage class materials. */
@ApiTags('acm-materials')
@ApiBearerAuth()
@Controller('acm/materials')
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN', 'TEACHER', 'STAFF')
export class MaterialAdminController {
  constructor(private readonly svc: MaterialService) {}

  @Get()
  @ApiOperation({ summary: 'List materials for a class' })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Query('clsId', ParseUUIDPipe) clsId: string,
  ) {
    return this.svc.listForClass(u.entId, clsId);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a class material (≤20MB)' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMaterialDto,
  ) {
    return this.svc.upload(u.entId, dto.clsId, u.id, file, dto.title);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a material (admin/teacher)' })
  async download(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.download(u.entId, id, {
      isAdmin: true,
    });
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a material (soft)' })
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(u.entId, id);
  }
}
