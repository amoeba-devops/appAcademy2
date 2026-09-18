import { BadRequestException } from '@nestjs/common';
import { SiteImportService } from '../application/site-import.service';
import { CommitSiteImportDto } from '../application/dto/site-import.dto';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type multer from 'multer';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { ImportService } from '../application/import.service';
import { StudentService } from '../application/student.service';
import {
  ChangeStudentStatusDto,
  ChangeStudentSitesDto,
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from '../application/dto/student.dto';

@ApiTags('acm-std')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('acm/std/students')
export class StudentController {
  constructor(
    private readonly siteImporter: SiteImportService,
    private readonly students: StudentService,
    private readonly importer: ImportService,
  ) {}

  @Get('template')
  @ApiOperation({ summary: 'Download TPI-format xlsx template (FR-STD-007)' })
  getTemplate(@Res() res: Response) {
    const buf = this.importer.generateTemplate();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tpi-student-template.xlsx"',
    });
    res.send(buf);
  }

  @Post('import/preview')
  @Roles('ADMIN', 'APP_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  preview(
    @CurrentUser() u: AcmCurrentUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('FILE_REQUIRED');
    return this.siteImporter.preview(u.entId, u.id, file.buffer);
  }

  @Post('import/commit')
  @Roles('ADMIN', 'APP_ADMIN')
  commit(@CurrentUser() u: AcmCurrentUser, @Body() dto: CommitSiteImportDto) {
    return this.siteImporter.commit(u.entId, u.id, dto);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import students from xlsx (FR-STD-006)' })
  @ApiConsumes('multipart/form-data')
  @Roles('ADMIN', 'APP_ADMIN')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importExcel() {
    throw new BadRequestException('IMPORT_PREVIEW_REQUIRED');
  }

  @Post()
  @ApiOperation({ summary: 'Create student (FR-STD-003)' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateStudentDto) {
    return this.students.create(u.entId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List students (FR-STD-001)' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListStudentsQueryDto) {
    return this.students.list(u.entId, q);
  }

  @Patch('sites')
  @Roles('ADMIN', 'APP_ADMIN')
  changeSites(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ChangeStudentSitesDto,
  ) {
    return this.students.changeSites(u.entId, u.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student detail (FR-STD-002)' })
  findOne(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.findOne(u.entId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student (FR-STD-004)' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(u.entId, id, dto, u.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change student status (FR-STD-005)' })
  changeStatus(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStudentStatusDto,
  ) {
    return this.students.changeStatus(u.entId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete student (FR-STD-005)' })
  remove(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.students.remove(u.entId, id);
  }
}
