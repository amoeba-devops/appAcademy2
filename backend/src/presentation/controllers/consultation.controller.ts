import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateConsultationDto,
  UpdateConsultationDto,
  UpdateConsultationStatusDto,
  CreateVisitRecordDto,
} from '../../application/dto/consultation';
import {
  GetConsultationsUseCase,
  GetConsultationDetailUseCase,
  CreateConsultationUseCase,
  UpdateConsultationUseCase,
  UpdateConsultationStatusUseCase,
  CreateVisitRecordUseCase,
} from '../../application/use-cases/consultation';

@ApiTags('Consultations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('consultations')
export class ConsultationController {
  constructor(
    private readonly getConsultations: GetConsultationsUseCase,
    private readonly getConsultationDetail: GetConsultationDetailUseCase,
    private readonly createConsultation: CreateConsultationUseCase,
    private readonly updateConsultation: UpdateConsultationUseCase,
    private readonly updateConsultationStatus: UpdateConsultationStatusUseCase,
    private readonly createVisitRecord: CreateVisitRecordUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get consultation list (상담 목록 조회)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @CurrentUser() user: { academyId: number },
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
  ) {
    return this.getConsultations.execute(user.academyId, { status, channel, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get consultation detail (상담 상세 조회)' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    return this.getConsultationDetail.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create consultation (상담 등록)' })
  async create(
    @CurrentUser() user: { academyId: number },
    @Body() dto: CreateConsultationDto,
  ) {
    return this.createConsultation.execute(user.academyId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update consultation (상담 수정)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsultationDto,
  ) {
    return this.updateConsultation.execute(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update consultation status (상담 상태 변경)' })
  async changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConsultationStatusDto,
  ) {
    return this.updateConsultationStatus.execute(id, dto.status);
  }

  @Post(':id/visits')
  @ApiOperation({ summary: 'Create visit record (방문 기록 등록)' })
  async addVisit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateVisitRecordDto,
  ) {
    return this.createVisitRecord.execute(id, dto);
  }
}
