import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ObjectStoreClient } from '../../acm-csl/infrastructure/external/object-store.client';
import { ProjectService } from '../application/project.service';
import { openTicketFile } from '../application/project-file.service';

/** 프로젝트 ACM 저장소 파일 내용 — 5분 서명 링크(로그인 헤더 없이 새 창에서 연다). */
@ApiTags('acm-prj')
@Controller('acm/prj/files')
export class ProjectFileContentController {
  constructor(
    private readonly projects: ProjectService,
    private readonly store: ObjectStoreClient,
  ) {}

  @Get('content')
  @ApiOperation({
    summary:
      'Download a project file stored in ACM storage (signed 5-minute link)',
  })
  async content(
    @Query('t') t: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const f = await openTicketFile(this.projects.ds, this.store, t);
    res.set({
      'Content-Type': f.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
      'Cache-Control': 'private, no-store',
      ...(f.contentLength ? { 'Content-Length': String(f.contentLength) } : {}),
    });
    return new StreamableFile(f.stream);
  }
}
