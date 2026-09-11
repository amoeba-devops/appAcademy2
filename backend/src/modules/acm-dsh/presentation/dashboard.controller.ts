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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { MetricDefinitionService } from '../application/metric-definition.service';
import { DailyKpiService } from '../application/daily-kpi.service';
import { ManualInputService } from '../application/manual-input.service';
import { ComplaintService } from '../application/complaint.service';
import { MonthlySummaryService } from '../application/monthly-summary.service';
import { UpsertManualInputDto } from '../application/dto/manual-input.dto';
import { UpsertDailyKpiManualDto } from '../application/dto/daily-kpi-manual.dto';
import {
  CreateComplaintDto,
  UpdateComplaintDto,
} from '../application/dto/complaint.dto';
import { Ga4SyncService } from '../application/ga4-sync.service';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 365;

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function validateRange(from: string, to: string): void {
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    throw new BadRequestException('from / to must be ISO YYYY-MM-DD');
  }
  if (from > to) throw new BadRequestException('from must be ≤ to');
  const ms =
    new Date(`${to}T00:00:00Z`).getTime() -
    new Date(`${from}T00:00:00Z`).getTime();
  const days = Math.round(ms / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `Range too wide (${days}d) — max ${MAX_RANGE_DAYS}d`,
    );
  }
}

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
    private readonly ga4Sync: Ga4SyncService,
  ) {}

  // -------- PLN-260912: GA4 site visits --------
  @Get('site-visits')
  @ApiOperation({ summary: 'GA4 per-site daily visitors for [from,to]' })
  getSiteVisits(
    @CurrentUser() user: AcmCurrentUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    validateRange(from, to);
    return this.ga4Sync.getSiteVisits(user.entId, from, to);
  }

  @Post('ga4-sync')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary:
      'Sync GA4 visitors now (default window D-7..D-1, max 365d) and recompute daily KPI',
  })
  async ga4SyncNow(
    @CurrentUser() user: AcmCurrentUser,
    @Body() body: { from?: string; to?: string },
  ) {
    const to = body?.to ?? isoDaysAgo(1);
    const from = body?.from ?? isoDaysAgo(7);
    validateRange(from, to);
    try {
      return await this.ga4Sync.syncRange(user.entId, from, to);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg);
    }
  }

  // -------- Year-month list / Monthly summary --------
  @Get('year-months')
  @ApiOperation({
    summary: 'List distinct year-months that have any daily_kpi rows',
  })
  listYearMonths(@CurrentUser() user: AcmCurrentUser) {
    return this.monthlySummary.listYearMonths(user.entId);
  }

  @Get('monthly-summary')
  @ApiOperation({
    summary: 'Per-category Sum/Aver + MoM delta + sparkline series',
  })
  getMonthlySummary(
    @CurrentUser() user: AcmCurrentUser,
    @Query('yearMonth') yearMonth: string,
  ) {
    return this.monthlySummary.getMonthlySummary(user.entId, yearMonth);
  }

  // -------- v2: range-based grid + summary --------
  @Get('daily-kpi-range')
  @ApiOperation({
    summary:
      'Daily KPI rows + sums/avgs for an arbitrary [from,to] window (max 365d)',
  })
  getRange(
    @CurrentUser() user: AcmCurrentUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    validateRange(from, to);
    return this.dailyKpi.getRange(user.entId, from, to);
  }

  @Get('range-summary')
  @ApiOperation({
    summary:
      'Per-category multi-metric summary for [from,to] (delta vs same-length prior window)',
  })
  getRangeSummary(
    @CurrentUser() user: AcmCurrentUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    validateRange(from, to);
    return this.monthlySummary.getRangeSummary(user.entId, from, to);
  }

  @Put('daily-kpi-manual/:date')
  @ApiOperation({
    summary:
      'Full-row manual override of a daily_kpi row (sets manually_overridden=true)',
  })
  upsertDailyKpiManual(
    @CurrentUser() user: AcmCurrentUser,
    @Param('date') date: string,
    @Body() dto: UpsertDailyKpiManualDto,
  ) {
    if (!ISO_DATE.test(date))
      throw new BadRequestException('date must be ISO YYYY-MM-DD');
    return this.dailyKpi.upsertManualKpi(user.entId, date, dto);
  }

  // -------- Metric registry --------
  @Get('metrics')
  @ApiOperation({
    summary: 'List 21 metric definitions for the dashboard header',
  })
  listMetrics(@CurrentUser() user: AcmCurrentUser) {
    return this.metrics.list(user.entId);
  }

  // -------- Daily KPI grid --------
  @Get('daily-kpi')
  @ApiOperation({
    summary: 'Monthly grid (rows + sum + averages) for a YYYY-MM',
  })
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
  getManual(@CurrentUser() user: AcmCurrentUser, @Param('date') date: string) {
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
