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
import {
  CreateMpqDto,
  ListMpqQueryDto,
  PatchMpqAnswerDto,
  UpdateMpqDto,
} from '../application/dto/mpq.dto';
import { MpqImportService } from '../application/mpq-import.service';
import { MpqService } from '../application/mpq.service';

@ApiTags('acm-map')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/map/questions')
export class MpqController {
  constructor(
    private readonly questions: MpqService,
    private readonly importer: MpqImportService,
  ) {}

  @Get('template')
  @ApiOperation({ summary: 'Download MAP past-question xlsx template' })
  getTemplate(@Res() res: Response) {
    const buf = this.importer.generateTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="map-past-questions-template.xlsx"',
    });
    res.send(buf);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import MAP past questions from xlsx' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @CurrentUser() u: AcmCurrentUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.importer.importFromBuffer(u.entId, file.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'List MAP past questions' })
  list(@CurrentUser() u: AcmCurrentUser, @Query() q: ListMpqQueryDto) {
    return this.questions.list(u.entId, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get MAP past question detail' })
  findOne(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.findOne(u.entId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create MAP past question' })
  create(@CurrentUser() u: AcmCurrentUser, @Body() dto: CreateMpqDto) {
    return this.questions.create(u.entId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update MAP past question' })
  update(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMpqDto,
  ) {
    return this.questions.update(u.entId, id, dto);
  }

  @Patch(':id/answer')
  @ApiOperation({ summary: 'Set/clear answer key' })
  patchAnswer(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchMpqAnswerDto,
  ) {
    return this.questions.patchAnswer(u.entId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (archive) MAP past question' })
  remove(@CurrentUser() u: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.questions.remove(u.entId, id);
  }
}
