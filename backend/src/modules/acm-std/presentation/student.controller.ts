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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type multer from 'multer';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { ImportService } from '../application/import.service';
import { StudentService } from '../application/student.service';
import {
  ChangeStudentStatusDto,
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
} from '../application/dto/student.dto';

@ApiTags('acm-std')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/std/students')
export class StudentController {
  constructor(
    private readonly students: StudentService,
    private readonly importer: ImportService,
  ) {}

  @Get('template')
  @ApiOperation({ summary: 'Download TPI-format xlsx template (FR-STD-007)' })
  getTemplate(@Res() res: Response) {
    const buf = this.importer.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="tpi-student-template.xlsx"',
    });
    res.send(buf);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import students from xlsx (FR-STD-006)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @CurrentUser() u: AcmCurrentUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.importer.importFromBuffer(u.entId, file.buffer);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get student detail (FR-STD-002)' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.findOne(u.entId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update student (FR-STD-004)' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(u.entId, id, dto);
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
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.students.remove(u.entId, id);
  }
}
