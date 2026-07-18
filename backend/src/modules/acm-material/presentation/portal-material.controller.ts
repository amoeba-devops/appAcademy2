import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
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
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import {
  PortalMaterialService,
  type ShareInput,
} from '../application/portal-material.service';

/**
 * PLN-260718 P3 — portal 자료실. Teachers/students author posts and share them
 * (teacher→students, student→teacher=submission); everyone views role-scoped
 * lists (own / shared) and comments on posts they can see.
 */
@ApiTags('portal-materials')
@ApiBearerAuth()
@Controller('portal/materials')
@UseGuards(PortalJwtAuthGuard)
export class PortalMaterialController {
  constructor(private readonly svc: PortalMaterialService) {}

  @Get()
  @ApiOperation({
    summary: 'List materials (scope=own|shared, default shared)',
  })
  list(@PortalUser() u: PortalAuthUser, @Query('scope') scope?: string) {
    return scope === 'own'
      ? this.svc.listOwn(u.entId, u.kind, u.refId)
      : this.svc.listShared(u.entId, u.kind, u.refId);
  }

  @Get('share-candidates')
  @ApiOperation({
    summary:
      'List who I can share with (default: class-based; scope=all → 포털 사용자 전체)',
  })
  shareCandidates(
    @PortalUser() u: PortalAuthUser,
    @Query('scope') scope?: string,
  ) {
    if (scope === 'all') {
      return this.svc.listAllPortalUsers(u.entId, {
        kind: u.kind,
        refId: u.refId,
      });
    }
    return this.svc.listShareCandidates(u.entId, u.kind, u.refId);
  }

  // ── Doc board (PLN-260719 B) ──────────────────────────────────────────

  @Post('docs')
  @ApiOperation({
    summary: 'Create a rich-text doc post + share targets/roles',
  })
  createDoc(
    @PortalUser() u: PortalAuthUser,
    @Body() body: { title: string; content: string; shares?: ShareInput[] },
  ) {
    return this.svc.createDoc(
      u.entId,
      { kind: u.kind, refId: u.refId },
      body.title,
      body.content,
      body.shares ?? [],
    );
  }

  @Get('docs/:id')
  @ApiOperation({ summary: 'Get a doc post (content + shares + canEdit)' })
  getDoc(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getDoc(u.entId, id, { kind: u.kind, refId: u.refId });
  }

  @Put('docs/:id')
  @ApiOperation({ summary: 'Update doc title/content (author or EDITOR)' })
  updateDoc(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { title?: string; content?: string },
  ) {
    return this.svc.updateDoc(
      u.entId,
      id,
      { kind: u.kind, refId: u.refId },
      body,
    );
  }

  @Put('docs/:id/shares')
  @ApiOperation({ summary: 'Replace share targets/roles (author only)' })
  updateShares(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { shares: ShareInput[] },
  ) {
    return this.svc.updateShares(
      u.entId,
      id,
      { kind: u.kind, refId: u.refId },
      body.shares ?? [],
    );
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a material post + share targets (≤20MB)' })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @PortalUser() u: PortalAuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; shareRefIds?: string | string[] },
  ) {
    const shareRefIds = Array.isArray(body.shareRefIds)
      ? body.shareRefIds
      : body.shareRefIds
        ? [body.shareRefIds]
        : [];
    return this.svc.create(
      u.entId,
      { kind: u.kind, refId: u.refId },
      file,
      body.title,
      shareRefIds,
    );
  }

  @Get(':id/download')
  @ApiOperation({
    summary: 'Download a material (author / share-target / class)',
  })
  async download(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.download(u.entId, id, {
      kind: u.kind,
      refId: u.refId,
    });
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a material post (author only)' })
  remove(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.remove(u.entId, id, { kind: u.kind, refId: u.refId });
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments on a material' })
  comments(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.listComments(u.entId, id, { kind: u.kind, refId: u.refId });
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a material' })
  addComment(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { body: string },
  ) {
    return this.svc.addComment(
      u.entId,
      id,
      { kind: u.kind, refId: u.refId },
      body.body,
    );
  }
}
