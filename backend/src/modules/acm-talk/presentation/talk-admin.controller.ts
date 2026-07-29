import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import {
  TalkService,
  type TalkActor,
  type TalkMemberInput,
} from '../application/talk.service';
import { TalkSseService } from '../application/talk-sse.service';

/**
 * REQ-260728C — 로비채팅 콘솔(운영자) API. 개설/DM/멤버관리 포함.
 * 운영자 = ADMIN·APP_ADMIN (STAFF 제외 — REQ §7).
 */
@ApiTags('acm-talk')
@ApiBearerAuth()
@Controller('acm/talk')
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN')
export class TalkAdminController {
  constructor(
    private readonly svc: TalkService,
    private readonly sse: TalkSseService,
  ) {}

  private actor(u: AcmCurrentUser): TalkActor {
    return { kind: 'USER', refId: u.id };
  }

  @Get('channels')
  @ApiOperation({ summary: 'My channels + unread counts' })
  channels(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.listMyChannels(u.entId, this.actor(u));
  }

  @Get('candidates')
  @ApiOperation({ summary: 'Member candidates (operators + teachers)' })
  candidates(@CurrentUser() u: AcmCurrentUser) {
    return this.svc.listCandidates(u.entId);
  }

  @Post('channels')
  @ApiOperation({ summary: 'Create a group channel (operator only)' })
  createChannel(
    @CurrentUser() u: AcmCurrentUser,
    @Body() body: { name: string; members?: TalkMemberInput[] },
  ) {
    return this.svc.createChannel(u.entId, u.id, body.name, body.members ?? []);
  }

  @Post('channels/dm')
  @ApiOperation({ summary: 'Find-or-create a DM with an operator/teacher' })
  dm(
    @CurrentUser() u: AcmCurrentUser,
    @Body() body: { kind: 'USER' | 'TEACHER'; refId: string },
  ) {
    return this.svc.findOrCreateDm(u.entId, u.id, {
      kind: body.kind,
      refId: body.refId,
    });
  }

  @Put('channels/:id/members')
  @ApiOperation({ summary: 'Replace group members (owner only)' })
  updateMembers(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { members: TalkMemberInput[] },
  ) {
    return this.svc.updateMembers(u.entId, u.id, id, body.members ?? []);
  }

  @Delete('channels/:id')
  @ApiOperation({ summary: 'Delete a channel (owner only, soft)' })
  removeChannel(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteChannel(u.entId, u.id, id);
  }

  @Get('channels/:id/messages')
  @ApiOperation({ summary: 'List messages (cursor pagination, newest first)' })
  messages(
    @CurrentUser() u: AcmCurrentUser,
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
    @CurrentUser() u: AcmCurrentUser,
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
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.sendFile(u.entId, this.actor(u), id, file);
  }

  @Get('files/:messageId/download')
  @ApiOperation({ summary: 'Download a file message (members only)' })
  async download(
    @CurrentUser() u: AcmCurrentUser,
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
  read(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.markRead(u.entId, this.actor(u), id);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete own message (soft)' })
  removeMessage(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.deleteMessage(u.entId, this.actor(u), id);
  }

  @Sse('events')
  @Header('X-Accel-Buffering', 'no')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: 'SSE stream (message/channel events + heartbeat)' })
  events(@CurrentUser() u: AcmCurrentUser): Observable<{ data: string }> {
    return this.sse.subscribe(u.entId, `USER:${u.id}`);
  }
}
