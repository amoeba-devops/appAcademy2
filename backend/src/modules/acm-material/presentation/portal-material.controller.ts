import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
    summary:
      'List materials (scope=own|shared, kind=DOC|FILE, page/limit) → { data, meta }',
  })
  list(
    @PortalUser() u: PortalAuthUser,
    @Query('scope') scope?: string,
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // REQ-260728B FR-4 — 종류필터 + 페이징 (파라미터 미지정 시 1페이지/10건).
    const opts = {
      matKind:
        kind === 'DOC' || kind === 'FILE'
          ? (kind as 'DOC' | 'FILE')
          : undefined,
      page: Math.max(1, parseInt(page ?? '', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit ?? '', 10) || 10)),
    };
    return scope === 'own'
      ? this.svc.listOwn(u.entId, u.kind, u.refId, opts)
      : this.svc.listShared(u.entId, u.kind, u.refId, opts);
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

  @Get('docs/:id/revisions')
  @ApiOperation({ summary: 'Doc revision history (viewer/editor/author)' })
  revisions(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.listRevisions(u.entId, id, {
      kind: u.kind,
      refId: u.refId,
    });
  }

  @Get('docs/:id/revisions/:seq')
  @ApiOperation({ summary: 'View a doc revision snapshot' })
  revision(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seq', ParseIntPipe) seq: number,
  ) {
    return this.svc.getRevision(u.entId, id, seq, {
      kind: u.kind,
      refId: u.refId,
    });
  }

  @Post('docs/:id/revisions/:seq/restore')
  @ApiOperation({
    summary: 'Restore a revision (author/EDITOR; records a new revision)',
  })
  restore(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('seq', ParseIntPipe) seq: number,
  ) {
    return this.svc.restoreRevision(u.entId, id, seq, {
      kind: u.kind,
      refId: u.refId,
    });
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

  @Put(':id/shares')
  @ApiOperation({
    summary:
      'Replace share targets/roles for any own post — FILE included (PLN-260724)',
  })
  updateMaterialShares(
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
  @ApiOperation({
    summary:
      'Create a material post (≤50MB) — shares JSON 필수 (REQ-260728B FR-3)',
  })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @PortalUser() u: PortalAuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; shares?: string },
  ) {
    // multipart 텍스트 필드라 shares 는 JSON 문자열로 전달된다.
    let shares: ShareInput[] = [];
    if (body.shares) {
      try {
        const parsed: unknown = JSON.parse(body.shares);
        if (Array.isArray(parsed)) shares = parsed as ShareInput[];
      } catch {
        throw new BadRequestException('INVALID_SHARES');
      }
    }
    return this.svc.create(
      u.entId,
      { kind: u.kind, refId: u.refId },
      file,
      body.title,
      shares,
    );
  }

  // ── Doc attachments (REQ-260728B FR-2) ───────────────────────────────

  @Post('docs/:id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Attach a file to a doc (author/EDITOR, ≤50MB × ≤5/doc)',
  })
  @UseInterceptors(FileInterceptor('file'))
  addAttachment(
    @PortalUser() u: PortalAuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.addAttachment(
      u.entId,
      id,
      { kind: u.kind, refId: u.refId },
      file,
    );
  }

  @Get('attachments/:attId/download')
  @ApiOperation({ summary: 'Download a doc attachment (post viewers)' })
  async downloadAttachment(
    @PortalUser() u: PortalAuthUser,
    @Param('attId', ParseUUIDPipe) attId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { stream, mime, filename } = await this.svc.downloadAttachment(
      u.entId,
      attId,
      { kind: u.kind, refId: u.refId },
    );
    res.set({
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete('attachments/:attId')
  @ApiOperation({ summary: 'Remove a doc attachment (author/EDITOR)' })
  removeAttachment(
    @PortalUser() u: PortalAuthUser,
    @Param('attId', ParseUUIDPipe) attId: string,
  ) {
    return this.svc.removeAttachment(u.entId, attId, {
      kind: u.kind,
      refId: u.refId,
    });
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
