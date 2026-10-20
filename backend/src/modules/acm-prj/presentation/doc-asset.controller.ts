import {
  BadRequestException,
  Controller,
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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { DocAssetService, FILE_MAX } from '../application/doc-asset.service';

/** PLN-261020C — 문서 본문 이미지·첨부 업로드(프로젝트 참여자). */
@ApiTags('acm-prj')
@Controller('acm/prj/projects/:id/doc-assets')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER', 'APP_ADMIN')
export class DocAssetUploadController {
  constructor(private readonly assets: DocAssetService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image or file for a document body' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FILE_MAX, files: 1 } }),
  )
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('kind') kind = 'file',
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일을 선택하세요.');
    return this.assets.upload(u, id, kind === 'image' ? 'image' : 'file', file);
  }
}

/** 고유 링크(자산 id + HMAC)로 내용을 내려준다 — `<img>` 는 로그인 헤더를 보낼 수 없다. */
@ApiTags('acm-prj')
@Controller('acm/prj/doc-assets')
export class DocAssetContentController {
  constructor(private readonly assets: DocAssetService) {}

  @Get(':asset/:token')
  @ApiOperation({ summary: 'Open a document image or file by its unique link' })
  async content(
    @Param('asset') asset: string,
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const f = await this.assets.open(asset, token);
    res.set({
      'Content-Type': f.mime,
      'Content-Disposition': `${f.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      ...(f.contentLength ? { 'Content-Length': String(f.contentLength) } : {}),
    });
    return new StreamableFile(f.stream);
  }
}
