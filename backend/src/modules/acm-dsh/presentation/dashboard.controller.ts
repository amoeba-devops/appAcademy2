import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { MetricDefinitionService } from '../application/metric-definition.service';
import { DailyKpiService } from '../application/daily-kpi.service';
import { ManualInputService } from '../application/manual-input.service';
import { ComplaintService } from '../application/complaint.service';
import { MonthlySummaryService } from '../application/monthly-summary.service';
import { UpsertManualInputDto } from '../application/dto/manual-input.dto';
import { CreateComplaintDto, UpdateComplaintDto } from '../application/dto/complaint.dto';

@ApiTags('acm-dsh')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/dsh')
export class DashboardController {
  constructor(
    private readonly metrics: MetricDefinitionService,
    private readonly dailyKpi: DailyKpiService,
    private readonly manualInput: ManualInputService,
    private readonly complaint: ComplaintService,
    private readonly monthlySummary: MonthlySummaryService,
  ) {}

  // -------- Year-month list / Monthly summary --------
  @Get('year-months')
  @ApiOperation({ summary: 'List distinct year-months that have any daily_kpi rows' })
  listYearMonths(@CurrentUser() user: AcmCurrentUser) {
    return this.monthlySummary.listYearMonths(user.entId);
  }

  @Get('monthly-summary')
  @ApiOperation({ summary: 'Per-category Sum/Aver + MoM delta + sparkline series' })
  getMonthlySummary(
    @CurrentUser() user: AcmCurrentUser,
    @Query('yearMonth') yearMonth: string,
  ) {
    return this.monthlySummary.getMonthlySummary(user.entId, yearMonth);
  }

  // -------- Metric registry --------
  @Get('metrics')
  @ApiOperation({ summary: 'List 21 metric definitions for the dashboard header' })
  listMetrics(@CurrentUser() user: AcmCurrentUser) {
    return this.metrics.list(user.entId);
  }

  // -------- Daily KPI grid --------
  @Get('daily-kpi')
  @ApiOperation({ summary: 'Monthly grid (rows + sum + averages) for a YYYY-MM' })
  getMonth(
    @CurrentUser() user: AcmCurrentUser,
    @Query('yearMonth') yearMonth: string,
  ) {
    return this.dailyKpi.getMonthGrid(user.entId, yearMonth);
  }

  @Post('daily-kpi/recompute')
  @ApiOperation({ summary: 'Force-recompute one day' })
  async recompute(
    @CurrentUser() user: AcmCurrentUser,
    @Query('date') date: string,
  ) {
    await this.dailyKpi.recomputeDay(user.entId, date, 'manual_refresh');
    return { ok: true };
  }

  // -------- Manual inputs --------
  @Get('manual-inputs')
  listManual(
    @CurrentUser() user: AcmCurrentUser,
    @Query('yearMonth') yearMonth: string,
  ) {
    return this.manualInput.list(user.entId, yearMonth);
  }

  @Get('manual-inputs/:date')
  getManual(
    @CurrentUser() user: AcmCurrentUser,
    @Param('date') date: string,
  ) {
    return this.manualInput.findByDate(user.entId, date);
  }

  @Put('manual-inputs/:date')
  upsertManual(
    @CurrentUser() user: AcmCurrentUser,
    @Param('date') date: string,
    @Body() dto: UpsertManualInputDto,
  ) {
    return this.manualInput.upsert(user.entId, date, dto, user.id);
  }

  // -------- Complaints --------
  @Get('complaints')
  listComplaints(
    @CurrentUser() user: AcmCurrentUser,
    @Query('yearMonth') yearMonth: string,
  ) {
    return this.complaint.list(user.entId, yearMonth);
  }

  @Post('complaints')
  createComplaint(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.complaint.create(user.entId, dto, user.id);
  }

  @Put('complaints/:id')
  updateComplaint(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateComplaintDto,
  ) {
    return this.complaint.update(user.entId, id, dto);
  }

  @Delete('complaints/:id')
  deleteComplaint(
    @CurrentUser() user: AcmCurrentUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.complaint.softDelete(user.entId, id);
  }
}
