import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { SharedDriveService } from '../application/shared-drive.service';
import { SharedFolderDto } from '../application/document.dto';
import { CreateDriveDto } from '../application/project.dto';
import {
  DriveFilesDto,
  DriveMoveDto,
  DriveRenameDto,
} from '../application/shared-drive.dto';
const fileId = (s: string) => {
  if (!/^[\w-]{1,200}$/.test(s)) throw new BadRequestException();
  return s;
};
@Controller('acm/drive/folders')
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Roles('ADMIN', 'STAFF', 'TEACHER', 'APP_ADMIN')
export class SharedDriveController {
  constructor(readonly service: SharedDriveService) {}
  @Get() list(@CurrentUser() u: AcmCurrentUser) {
    return this.service.list(u);
  }
  @Post() save(@CurrentUser() u: AcmCurrentUser, @Body() d: SharedFolderDto) {
    return this.service.save(u, d);
  }
  /** REQ-261016E — 볼 수 있는 연결 폴더 안 이름 검색(':id' 보다 먼저 선언). */
  @Get('search') search(@CurrentUser() u: AcmCurrentUser, @Query('q') q = '') {
    if (q.length > 100) throw new BadRequestException();
    return this.service.search(u, q);
  }
  @Get(':id/permissions') permissions(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.permissions(u, id);
  }
  @Get(':id') browse(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('parent') parent?: string,
    @Query('page') page?: string,
  ) {
    if (page && page.length > 2000) throw new BadRequestException();
    return this.service.browse(
      u,
      id,
      parent ? fileId(parent) : undefined,
      page,
    );
  }
  @Post(':id/create') create(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CreateDriveDto,
  ) {
    return this.service.create(u, id, d);
  }
  @Get(':id/open') open(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('file') file: string,
  ) {
    return this.service.open(u, id, fileId(file));
  }
  @Get(':id/files/:file') detail(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('file') file: string,
  ) {
    return this.service.detail(u, id, fileId(file));
  }
  @Patch(':id/files/:file') rename(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('file') file: string,
    @Body() d: DriveRenameDto,
  ) {
    return this.service.rename(u, id, fileId(file), d.name);
  }
  @Post(':id/move') move(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DriveMoveDto,
  ) {
    return this.service.move(u, id, d.fileIds, d.targetId);
  }
  @Post(':id/trash') trash(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DriveFilesDto,
  ) {
    return this.service.trash(u, id, d.fileIds);
  }
  @Delete(':id') unlink(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.unlink(u, id);
  }
  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // REQ-261016E — AMA 와 같은 50MB(nginx client_max_body_size 55M)
      limits: { fileSize: 50 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CreateDriveDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('파일을 선택하세요.');
    return this.service.create(u, id, d, file);
  }
}
