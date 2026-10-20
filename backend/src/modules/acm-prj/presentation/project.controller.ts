import { ProjectFileService } from '../application/project-file.service';
import {
  DocumentPermissionDto,
  ProjectFileDto,
  ProjectRelationDto,
  DocumentDto,
} from '../application/document.dto';
import {
  BadRequestException,
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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Request } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ProjectService } from '../application/project.service';
import { ProjectDriveService } from '../application/drive.service';
import {
  ConnectDto,
  CreateDriveDto,
  DriveFileDto,
  ItemDto,
  ProjectDto,
  RootDto,
} from '../application/project.dto';
@Controller('acm/prj')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER', 'APP_ADMIN')
export class ProjectController {
  constructor(
    readonly projects: ProjectService,
    readonly files: ProjectFileService,
    readonly drive: ProjectDriveService,
  ) {}
  @Post('projects/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024, files: 1 }, // REQ-261018C — 드라이브와 같은 50MB
    }),
  )
  uploadFile(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ProjectFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일을 선택하세요.');
    return this.files.upload(u, id, d, file);
  }
  @Get('projects/:id/files/:item/download')
  downloadFile(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
  ) {
    return this.files.download(u, id, item);
  }
  @Put('projects/:id/items/:item/permissions') permissions(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
    @Body() d: DocumentPermissionDto,
  ) {
    return this.projects.permissions(u, id, item, d.viewers);
  }
  @Get('documents') async documents(@CurrentUser() u: AcmCurrentUser) {
    await this.drive.backfillFolderNames(u.entId);
    return this.projects.allDocuments(u);
  }
  @Get('projects/:id/relations') relations(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.relations(u, id);
  }
  @Post('projects/:id/relations') relation(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ProjectRelationDto,
  ) {
    return this.projects.relation(u, id, d);
  }
  @Delete('projects/:id/relations/:relation') removeRelation(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relation', ParseUUIDPipe) relation: string,
  ) {
    return this.projects.removeRelation(u, id, relation);
  }
  @Get('people') people(@CurrentUser() u: AcmCurrentUser) {
    return this.projects.people(u);
  }
  @Get('drive') status(
    @CurrentUser() u: AcmCurrentUser,
    @Query('projectId') projectId?: string,
  ) {
    // FIX-261020C — projectId 가 있으면 그 프로젝트 업로드 가능 여부(projectReady)도 준다.
    return this.drive.status(
      u,
      projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : undefined,
    );
  }
  @Post('drive/connect') async connect(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: ConnectDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.drive.connect(u, d.returnPath);
    res.cookie('acm_prj_oauth', new URL(result.url).searchParams.get('state'), {
      httpOnly: true,
      secure: this.drive.google.setting('REDIRECT_URI').startsWith('https:'),
      sameSite: 'lax',
      path: '/api/acm/prj/drive/callback',
      maxAge: 600000,
    });
    res.setHeader('Cache-Control', 'no-store');
    return result;
  }
  @Delete('drive') disconnect(@CurrentUser() u: AcmCurrentUser) {
    return this.drive.disconnect(u);
  }
  @Put('drive/root') root(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: RootDto,
  ) {
    return this.drive.root(u, d.fileId, d.name);
  }
  @Get('projects') async list(@CurrentUser() u: AcmCurrentUser) {
    await this.drive.backfillFolderNames(u.entId);
    return this.projects.list(u);
  }
  @Post('projects') create(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: ProjectDto,
  ) {
    return this.projects.save(u, d);
  }
  @Get('projects/:id') detail(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.detail(u, id);
  }
  @Put('projects/:id') update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ProjectDto,
  ) {
    return this.projects.save(u, d, id);
  }
  @Get('projects/:id/items') items(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projects.items(u, id);
  }
  @Post('projects/:id/items') item(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ItemDto,
  ) {
    return this.projects.saveItem(u, id, d);
  }
  @Put('projects/:id/items/:item') edit(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
    @Body() d: ItemDto,
  ) {
    return this.projects.saveItem(u, id, d, item);
  }
  @Post('projects/:id/documents') document(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DocumentDto,
  ) {
    return this.projects.saveDocument(u, id, d);
  }
  @Put('projects/:id/documents/:item') editDocument(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
    @Body() d: DocumentDto,
  ) {
    return this.projects.saveDocument(u, id, d, item);
  }
  // REQ-261019 — 목록 삭제(작성자·프로젝트 담당자·테넌트 마스터)
  @Delete('projects/:id/items/:item') removeItem(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
  ) {
    return this.projects.deleteItem(u, id, item);
  }
  @Delete('projects/:id/items/:item/link') unlink(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
  ) {
    return this.projects.unlink(u, id, item);
  }
  @Get('projects/:id/items/:item/open') open(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('item', ParseUUIDPipe) item: string,
  ) {
    return this.drive.open(u, id, item);
  }
  @Post('projects/:id/drive/link') link(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DriveFileDto,
  ) {
    return this.drive.link(u, id, d.fileId);
  }
  @Post('projects/:id/drive/create') file(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CreateDriveDto,
  ) {
    return this.drive.create(u, id, d);
  }
  @Post('drive/picker') picker(
    @CurrentUser() u: AcmCurrentUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.drive.picker(u);
  }
  @Get('projects/:id/drive') browse(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('parent') parent?: string,
    @Query('page') page?: string,
  ) {
    if (parent && !/^[\w-]{1,200}$/.test(parent))
      throw new BadRequestException();
    if (page && page.length > 2000) throw new BadRequestException();
    return this.drive.browse(u, id, parent, page);
  }
  @Post('projects/:id/drive/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024, files: 1 }, // REQ-261018C — 드라이브와 같은 50MB
    }),
  )
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CreateDriveDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일을 선택하세요.');
    return this.drive.create(u, id, d, file);
  }
}
@Controller('acm/prj/drive')
export class ProjectOAuthController {
  constructor(readonly drive: ProjectDriveService) {}
  @Get('callback') async callback(
    @Query('state') state: string,
    @Query('code') code: string | undefined,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    if (!state || state.length > 200) {
      res.redirect('/admin/config/drive?drive=failed');
      return;
    }
    const cookie =
      (req.headers.cookie ?? '')
        .split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith('acm_prj_oauth='))
        ?.slice('acm_prj_oauth='.length) ?? '';
    res.clearCookie('acm_prj_oauth', { path: '/api/acm/prj/drive/callback' });
    try {
      const path = await this.drive.callback(state, code, cookie);
      res.redirect(path);
    } catch {
      res.redirect('/admin/config/drive?drive=failed');
    }
  }
}
