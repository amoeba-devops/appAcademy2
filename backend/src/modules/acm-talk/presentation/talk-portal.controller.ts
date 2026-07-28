import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  Sse,
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
import type { Observable } from 'rxjs';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { TalkService, type TalkActor } from '../application/talk.service';
import { TalkSseService } from '../application/talk-sse.service';

/**
 * REQ-260728C — 로비채팅 포털(강사) API. 참여 전용 — 개설/멤버관리 없음.
 * TEACHER 만 접근 (학생/학부모 403).
 */
@ApiTags('portal-talk')
@ApiBearerAuth()
@Controller('portal/talk')
@UseGuards(PortalJwtAuthGuard)
export class TalkPortalController {
  constructor(
    private readonly svc: TalkService,
    private readonly sse: TalkSseService,
  ) {}

  private actor(u: PortalAuthUser): TalkActor {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
    return { kind: 'TEACHER', refId: u.refId };
  }

  @Get('channels')
  @ApiOperation({ summary: 'My channels + unread counts (teacher)' })
  channels(@PortalUser() u: PortalAuthUser) {
    return this.svc.listMyChannels(u.entId, this.actor(u));
  }

  @Get('channels/:id/messages')
  @ApiOperation({ summary: 'List messages (cursor pagination)' })
  messages(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listMessages(
      u.entId,
      this.actor(u),
      id,
      cursor,
      parseInt(limit ?? '', 10) || 50,
    );
  }

  @Post('channels/:id/messages')
  @ApiOperation({ summary: 'Send a text message' })
  send(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
  ) {
    return this.svc.sendMessage(u.entId, this.actor(u), id, body.content);
  }

  @Post('channels/:id/files')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send a file message (≤50MB)' })
  @UseInterceptors(FileInterceptor('file'))
  sendFile(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.sendFile(u.entId, this.actor(u), id, file);
  }

  @Get('files/:messageId/download')
  @ApiOperation({ summary: 'Download a file message (members only)' })
  async download(
    @PortalUser() u: PortalAuthUser,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.downloadFile(
      u.entId,
      this.actor(u),
      messageId,
    );
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Post('channels/:id/read')
  @ApiOperation({ summary: 'Mark channel as read' })
  read(@PortalUser() u: PortalAuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(u.entId, this.actor(u), id);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete own message (soft)' })
  removeMessage(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteMessage(u.entId, this.actor(u), id);
  }

  @Sse('events')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'SSE stream (teacher)' })
  events(@PortalUser() u: PortalAuthUser): Observable<{ data: string }> {
    this.actor(u); // TEACHER 게이트
    return this.sse.subscribe(u.entId, `TEACHER:${u.refId}`);
  }
}
