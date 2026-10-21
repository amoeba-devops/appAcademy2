import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { AuditViewerGuard } from '../../acm-common/guards/tenant-master.guard';
import { clientIp } from '../../acm-common/http/client-ip';
import {
  ActivityLogQueryService,
  type ActivityLogFilter,
  type ActivityLogRow,
} from '../application/activity-log-query.service';
import { ActivityWriterService } from '../application/activity-writer.service';

const CSV_HEADERS: Record<string, string[]> = {
  ko: [
    '일시(KST)',
    '행위자',
    '역할',
    '행위',
    '메뉴',
    '대상 종류',
    '대상',
    '대상 ID',
    '변경 항목',
    '결과',
    '응답 코드',
    '요청',
    'IP',
    '기기',
    '요청 ID',
  ],
  en: [
    'Time (KST)',
    'Actor',
    'Role',
    'Action',
    'Menu',
    'Target type',
    'Target',
    'Target ID',
    'Changed fields',
    'Result',
    'Status',
    'Request',
    'IP',
    'User agent',
    'Request ID',
  ],
  vi: [
    'Thời gian (KST)',
    'Người thực hiện',
    'Vai trò',
    'Hành động',
    'Menu',
    'Loại đối tượng',
    'Đối tượng',
    'ID đối tượng',
    'Mục thay đổi',
    'Kết quả',
    'Mã phản hồi',
    'Yêu cầu',
    'IP',
    'Thiết bị',
    'ID yêu cầu',
  ],
  'zh-CN': [
    '时间(KST)',
    '操作人',
    '角色',
    '操作',
    '菜单',
    '对象类型',
    '对象',
    '对象ID',
    '变更项',
    '结果',
    '响应码',
    '请求',
    'IP',
    '设备',
    '请求ID',
  ],
};
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
const kst = (ts: string) =>
  new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });

class ClientDownloadDto {
  @ApiProperty({ enum: ['dashboard-csv', 'operating-csv', 'workbook-xlsx'] })
  @IsIn(['dashboard-csv', 'operating-csv', 'workbook-xlsx'])
  kind!: 'dashboard-csv' | 'operating-csv' | 'workbook-xlsx';
  @ApiProperty({ required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

/** PLN-261022 — 감사 > 활동 로그 (TENANT_MASTER · AUDIT_VIEWER). */
@ApiTags('acm-audit')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, AuditViewerGuard)
@Controller('acm/audit/activity-logs')
export class ActivityController {
  constructor(
    private readonly logs: ActivityLogQueryService,
    private readonly writer: ActivityWriterService,
  ) {}

  private filter(q: Record<string, string | undefined>): ActivityLogFilter {
    const {
      from = '',
      to = '',
      q: actor,
      action,
      menu,
      target,
      targetType,
      targetId,
      result,
      ip,
    } = q;
    return {
      from,
      to,
      q: actor,
      action,
      menu,
      target,
      targetType,
      targetId,
      result,
      ip,
    };
  }

  @Get()
  @ApiOperation({
    summary:
      'Activity log (create/update/delete/read/download) — filters, 50 per page',
  })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.logs.list(u.entId, this.filter(q), Number(q.page ?? 1));
  }

  @Get('summary')
  summary(@CurrentUser() u: AcmCurrentUser) {
    return this.logs.summary(u.entId);
  }

  @Get('menus')
  menus(@CurrentUser() u: AcmCurrentUser) {
    return this.logs.menus(u.entId);
  }

  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="activity-log.csv"')
  @ApiOperation({
    summary:
      'Activity log CSV (max 100,000 rows); the export itself is recorded',
  })
  async exportCsv(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: Record<string, string | undefined>,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const f = this.filter(q);
    const rows = await this.logs.exportRows(u.entId, f);
    const head = CSV_HEADERS[q.lang ?? 'ko'] ?? CSV_HEADERS.ko;
    const line = (r: ActivityLogRow) =>
      [
        kst(r.createdAt),
        r.actorName,
        r.actorRole,
        r.action,
        r.menu,
        r.targetType,
        r.targetLabel,
        r.targetId,
        r.fields,
        r.result,
        r.status,
        r.method && r.path ? `${r.method} ${r.path}` : '',
        r.ip,
        r.userAgent,
        r.requestId,
      ]
        .map(csvCell)
        .join(',');
    await this.writer.write({
      entId: u.entId,
      userId: u.id,
      actorKind: 'CONSOLE',
      actorName: u.name ?? null,
      actorRole: u.role ?? null,
      action: 'DOWNLOAD',
      menu: 'audit',
      targetType: 'activity-log-export',
      targetId: `${f.from}~${f.to}`,
      targetLabel: `activity-log.csv (${rows.length})`,
      fields: null,
      result: 'SUCCESS',
      method: 'GET',
      path: '/acm/audit/activity-logs/export.csv',
      status: 200,
      ip: clientIp(req) || null,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 500) || null,
      requestId: null,
    });
    const csv =
      '﻿' +
      [head.map(csvCell).join(','), ...rows.map(line)].join('\r\n') +
      '\r\n';
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }
}

/** PLN-261022 — files generated in the browser (dashboard CSV, workbook) report themselves here. */
@ApiTags('acm-audit')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/audit/client-download')
export class ClientDownloadController {
  constructor(private readonly writer: ActivityWriterService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Record a download generated in the browser' })
  async record(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: ClientDownloadDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.writer.write({
      entId: u.entId,
      userId: u.id,
      actorKind: 'CONSOLE',
      actorName: u.name ?? null,
      actorRole: u.role ?? null,
      action: 'DOWNLOAD',
      menu: dto.kind === 'workbook-xlsx' ? 'projects' : 'dashboard',
      targetType: dto.kind,
      targetId: null,
      targetLabel: dto.label ?? null,
      fields: null,
      result: 'SUCCESS',
      method: 'POST',
      path: '/acm/audit/client-download',
      status: 204,
      ip: clientIp(req) || null,
      userAgent: (req.headers['user-agent'] ?? '').slice(0, 500) || null,
      requestId: null,
    });
  }
}
