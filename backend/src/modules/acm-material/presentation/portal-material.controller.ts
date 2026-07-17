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
import { PortalMaterialService } from '../application/portal-material.service';

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
  @ApiOperation({ summary: 'List who I can share with (teacher→students, student→teachers)' })
  shareCandidates(@PortalUser() u: PortalAuthUser) {
    return this.svc.listShareCandidates(u.entId, u.kind, u.refId);
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
