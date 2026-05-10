import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import {
  MAX_BYTES,
  TeacherAttachmentService,
} from '../application/teacher-attachment.service';

@ApiTags('acm-tch')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/tch/teachers/:id/attachments')
export class TeacherAttachmentController {
  constructor(private readonly svc: TeacherAttachmentService) {}

  @Get()
  @ApiOperation({ summary: 'List teacher attachments (REQ-260510)' })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.list(u.entId, id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Upload teacher attachment (REQ-260510)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_BYTES },
    }),
  )
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.upload(u.entId, id, file, u.id, 'RESUME');
  }

  @Get(':attId/download')
  @ApiOperation({ summary: 'Download teacher attachment (REQ-260510)' })
  async download(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attId', ParseUUIDPipe) attId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, originalName, mime } = await this.svc.getForDownload(
      u.entId,
      id,
      attId,
    );
    const encoded = encodeURIComponent(originalName);
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':attId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Soft-delete teacher attachment (REQ-260510)' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attId', ParseUUIDPipe) attId: string,
  ) {
    return this.svc.remove(u.entId, id, attId);
  }
}
