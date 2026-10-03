import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as XLSX from 'xlsx';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { CollectionsService } from '../application/collections.service';
import {
  ActiveDraftBatchDto,
  MonthlyPayQuery,
  TopStatisticsQuery,
  StateBatchDto,
  AdjustmentDto,
  BillActionDto,
  BillBatchDto,
  BillQuery,
  CollectionDto,
  EditBatchDto,
  RefundDto,
} from '../application/dto/collections.dto';
@Controller('acm/pay/bills')
@UseGuards(AcmJwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'APP_ADMIN', 'STAFF')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}
  @Get() list(@CurrentUser() u: AcmCurrentUser, @Query() q: BillQuery) {
    return this.service.list(u, q);
  }
  @Get('statistics') statistics(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: TopStatisticsQuery,
  ) {
    return this.service.statistics(u, q);
  }
  @Get('monthly') monthly(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: MonthlyPayQuery,
  ) {
    return this.service.monthly(u, q);
  }
  @Get('monthly-export') async monthlyExport(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: MonthlyPayQuery,
    @Res() res: Response,
  ) {
    const result = await this.service.monthly(u, q, true);
    const sheet = XLSX.utils.json_to_sheet(
      result.items.map((r) => ({
        Student: r.name,
        Month: q.month,
        Site: r.periods.map((p) => p.site || 'UNASSIGNED').join(', '),
        Enrolled: r.enrolled,
        Review: r.review,
        Status: r.status,
        Bills: r.billCount,
        Drafts: r.drafts,
        Net: r.net,
        Received: r.received,
        Unpaid: r.unpaid,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Monthly');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="monthly-${q.month}.xlsx"`,
    );
    res.send(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  }
  @Get('options') options(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: BillQuery,
  ) {
    return this.service.options(u, q);
  }
  @Post('active-drafts-preview') activeDraftPreview(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: ActiveDraftBatchDto,
  ) {
    return this.service.activeDrafts(u, d, false);
  }
  @Post('active-drafts') activeDraftCreate(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: ActiveDraftBatchDto,
  ) {
    return this.service.activeDrafts(u, d, true);
  }
  @Post('batch-preview') preview(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: BillBatchDto,
  ) {
    return this.service.preview(u, d);
  }
  @Post('batch-create') create(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: BillBatchDto,
  ) {
    return this.service.create(u, d);
  }
  @Patch('batch') edit(
    @CurrentUser() u: AcmCurrentUser,
    @Body() d: EditBatchDto,
  ) {
    return this.service.edit(u, d);
  }
  @Post('batch-state')
  @Roles('ADMIN', 'APP_ADMIN')
  stateBatch(@CurrentUser() u: AcmCurrentUser, @Body() d: StateBatchDto) {
    return this.service.stateBatch(u, d);
  }
  @Get('export') async export(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: BillQuery,
    @Res() res: Response,
  ) {
    const result = await this.service.list(u, q, true);
    // XLSX string cells never contain formula definitions, even for leading '=' input.
    const sheet = XLSX.utils.json_to_sheet(
      result.items.map((b) => ({
        Student: b.studentName,
        Grade: b.grade,
        Site: b.site,
        Month: b.month,
        Due: b.due,
        Kind: b.kind,
        Title: b.title,
        Amount: b.amount,
        Discount: b.discount,
        Adjustment: b.adjustment,
        Net: b.net,
        Paid: b.paid,
        Refunded: b.refunded,
        Received: b.received,
        Unpaid: b.unpaid,
        Status: b.status,
        Methods: b.methods.join(', '),
        PaymentDate: b.paidDate,
        Memo: b.memo,
        PeriodReceived: b.periodReceived,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Collections');
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet([result.summary]),
      'Summary',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="collections.xlsx"',
    );
    res.send(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
  }
  @Get(':id') detail(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(u, id);
  }
  @Post(':id/collections') collect(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CollectionDto,
  ) {
    return this.service.collect(u, id, d);
  }
  @Post(':id/refunds') @Roles('ADMIN', 'APP_ADMIN') refund(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: RefundDto,
  ) {
    return this.service.refund(u, id, d);
  }
  @Post(':id/adjustments') @Roles('ADMIN', 'APP_ADMIN') adjust(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AdjustmentDto,
  ) {
    return this.service.adjust(u, id, d);
  }
  @Post(':id/cancel') @Roles('ADMIN', 'APP_ADMIN') cancel(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillActionDto,
  ) {
    return this.service.state(u, id, d, false);
  }
  @Post(':id/restore') @Roles('ADMIN', 'APP_ADMIN') restore(
    @CurrentUser() u: AcmCurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillActionDto,
  ) {
    return this.service.state(u, id, d, true);
  }
}
