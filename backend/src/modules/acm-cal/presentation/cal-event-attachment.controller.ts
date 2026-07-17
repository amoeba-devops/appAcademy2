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
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { CalEventAttachmentService } from '../application/cal-event-attachment.service';

/**
 * PLN-260718 P2 — admin/teacher CRUD for calendar event attachments.
 * Scoped by the event's own tenant guard (OwnEntityGuard injects entId).
 */
@ApiTags('acm-cal')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cal/events/:id/attachments')
export class CalEventAttachmentController {
  constructor(private readonly svc: CalEventAttachmentService) {}

  @Get()
  @ApiOperation({ summary: 'List event attachments' })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) evtId: string,
  ) {
    return this.svc.list(u.entId, evtId);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an event attachment (≤20MB)' })
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) evtId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.upload(u.entId, evtId, file, u.id);
  }

  @Get(':attId/download')
  @ApiOperation({ summary: 'Download an event attachment (admin/teacher)' })
  async download(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) evtId: string,
    @Param('attId', ParseUUIDPipe) attId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.streamDownload(
      u.entId,
      evtId,
      attId,
    );
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':attId')
  @ApiOperation({ summary: 'Delete an event attachment (soft)' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) evtId: string,
    @Param('attId', ParseUUIDPipe) attId: string,
  ) {
    return this.svc.softDelete(u.entId, evtId, attId);
  }
}
