import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { ScoreBenchmarkService } from '../application/score-benchmark.service';
import {
  CreateScoreBenchmarkDto,
  CreateScoreBenchmarkModifierDto,
  GapAnalysisRequestDto,
  UpdateScoreBenchmarkDto,
} from '../application/dto/score-benchmark.dto';

@ApiTags('acm-ref')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/ref/score-benchmarks')
export class ScoreBenchmarkController {
  constructor(private readonly service: ScoreBenchmarkService) {}

  @Post()
  @ApiOperation({ summary: 'Create score benchmark (FR-REF-006/007/008)' })
  create(@CurrentUser() user: AcmCurrentUser, @Body() dto: CreateScoreBenchmarkDto) {
    return this.service.create(user.entId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List active benchmarks; filter by examType' })
  list(
    @CurrentUser() user: AcmCurrentUser,
    @Query('examType') examType?: 'MAP' | 'ISEE' | 'SSAT',
  ) {
    return this.service.list(user.entId, examType);
  }

  // ----- lookup endpoints (FR-REF-L01..L05) -----

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup active benchmark by examType + grade + asOfDate' })
  lookup(
    @CurrentUser() user: AcmCurrentUser,
    @Query('examType') examType: 'MAP' | 'ISEE' | 'SSAT',
    @Query('grade') grade: string,
    @Query('asOf') asOf?: string,
  ) {
    const date = asOf ? new Date(asOf) : new Date();
    return this.service.findActiveBenchmark(user.entId, examType, Number(grade), date);
  }

  @Post('gap-analysis')
  @ApiOperation({ summary: 'Gap analysis (FR-REF-L03..L05)' })
  gap(@CurrentUser() user: AcmCurrentUser, @Body() dto: GapAnalysisRequestDto) {
    return this.service.analyzeGap(user.entId, dto);
  }

  // ----- Modifiers -----

  @Post('modifiers')
  @ApiOperation({ summary: 'Create score benchmark modifier (FR-REF-011)' })
  createModifier(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CreateScoreBenchmarkModifierDto,
  ) {
    return this.service.createModifier(user.entId, dto, user.id);
  }

  @Get('modifiers')
  listModifiers(@CurrentUser() user: AcmCurrentUser) {
    return this.service.listModifiers(user.entId);
  }

  // ----- Detail / Update / Delete (placed after specific routes to avoid match conflicts) -----

  @Get(':id')
  findOne(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(user.entId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update (creates new version per BR-REF-002)' })
  update(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScoreBenchmarkDto,
  ) {
    return this.service.update(user.entId, id, dto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AcmCurrentUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.softDelete(user.entId, id);
  }
}
