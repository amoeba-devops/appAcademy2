import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import {
  AuditViewerGuard,
  TenantMasterGuard,
} from '../../acm-common/guards/tenant-master.guard';
import { AuditService } from '../../acm-audit/application/audit.service';
import { currentRequestMeta } from '../../acm-common/http/request-meta';
import {
  AccessLogQueryService,
  type AccessLogFilter,
  type AccessLogRow,
} from '../application/access-log-query.service';
import { AccountLockService } from '../application/account-lock.service';
import { AuditPolicyService } from '../application/audit-policy.service';
import { UnlockAccountDto, UpdateAuditPolicyDto } from './audit.dto';

const CSV_HEADERS: Record<string, string[]> = {
  ko: [
    '일시(KST)',
    '구분',
    '계정',
    '로그인 ID',
    '역할',
    '이벤트',
    '결과',
    '사유',
    '방식',
    'IP',
    '접속 환경',
    '기기',
    '처리자',
  ],
  en: [
    'Time (KST)',
    'Kind',
    'Account',
    'Login ID',
    'Role',
    'Event',
    'Result',
    'Reason',
    'Method',
    'IP',
    'Client',
    'User agent',
    'By',
  ],
  vi: [
    'Thời gian (KST)',
    'Loại',
    'Tài khoản',
    'ID đăng nhập',
    'Vai trò',
    'Sự kiện',
    'Kết quả',
    'Lý do',
    'Cách',
    'IP',
    'Môi trường',
    'Thiết bị',
    'Người xử lý',
  ],
  'zh-CN': [
    '时间(KST)',
    '类型',
    '账号',
    '登录ID',
    '角色',
    '事件',
    '结果',
    '原因',
    '方式',
    'IP',
    '访问环境',
    '设备',
    '处理人',
  ],
};

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  // Neutralize spreadsheet formulas (CSV injection) and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function kst(ts: string): string {
  return new Date(ts).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** REQ-261021B — 감사 > 접속 로그 · 접속 통제 (tenant-scoped). */
@ApiTags('acm-audit')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, AuditViewerGuard)
@Controller('acm/audit')
export class AuditController {
  constructor(
    private readonly logs: AccessLogQueryService,
    private readonly policies: AuditPolicyService,
    private readonly locks: AccountLockService,
    private readonly audit: AuditService,
  ) {}

  private filter(q: Record<string, string | undefined>): AccessLogFilter {
    return {
      from: q.from ?? '',
      to: q.to ?? '',
      kind: q.kind,
      q: q.q,
      event: q.event,
      result: q.result,
      ip: q.ip,
    };
  }

  @Get('access-logs')
  @ApiOperation({
    summary: 'Access log (login/logout/lock) — filters, 50 per page',
  })
  list(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: Record<string, string | undefined>,
  ) {
    return this.logs.list(u.entId, this.filter(q), Number(q.page ?? 1));
  }

  @Get('access-logs/summary')
  summary(@CurrentUser() u: AcmCurrentUser) {
    return this.logs.summary(u.entId);
  }

  @Get('access-logs/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="access-log.csv"')
  @ApiOperation({
    summary: 'Access log CSV (max 100,000 rows); the export itself is audited',
  })
  async exportCsv(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: Record<string, string | undefined>,
  ): Promise<StreamableFile> {
    const f = this.filter(q);
    const rows = await this.logs.exportRows(u.entId, f);
    const head = CSV_HEADERS[q.lang ?? 'ko'] ?? CSV_HEADERS.ko;
    const line = (r: AccessLogRow) =>
      [
        kst(r.createdAt),
        r.actorKind,
        r.actorName,
        r.loginId,
        r.actorRole,
        r.event,
        r.result,
        r.reason,
        r.method,
        r.ip,
        r.client,
        r.userAgent,
        r.byUserName,
      ]
        .map(csvCell)
        .join(',');
    const meta = currentRequestMeta();
    await this.audit.record({
      entId: u.entId,
      userId: u.id,
      action: 'EXPORT',
      entityType: 'acm.aud.access_log',
      entityId: `${f.from}~${f.to}`.slice(0, 64),
      reason: `rows=${rows.length}`,
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
    });
    const csv =
      '﻿' +
      [head.map(csvCell).join(','), ...rows.map(line)].join('\r\n') +
      '\r\n';
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }

  @Get('policy')
  policy(@CurrentUser() u: AcmCurrentUser) {
    return this.policies.get(u.entId);
  }

  @Put('policy')
  @UseGuards(TenantMasterGuard)
  @ApiOperation({
    summary: 'Update login-failure lockout policy (tenant master)',
  })
  async savePolicy(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: UpdateAuditPolicyDto,
  ) {
    const { before, after } = await this.policies.save(u.entId, dto, u.id);
    const pick = (p: typeof before) =>
      JSON.stringify({
        failMax: p.failMax,
        lockMinutes: p.lockMinutes,
        ipFailMax: p.ipFailMax,
        ipWindowMinutes: p.ipWindowMinutes,
        ipBlockMinutes: p.ipBlockMinutes,
      });
    const meta = currentRequestMeta();
    await this.audit.record({
      entId: u.entId,
      userId: u.id,
      action: 'UPDATE',
      entityType: 'acm.aud.policy',
      entityId: u.entId,
      oldValue: pick(before),
      newValue: pick(after),
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
    });
    return after;
  }

  @Get('locked-accounts')
  lockedAccounts(@CurrentUser() u: AcmCurrentUser) {
    return this.logs.lockedAccounts(u.entId);
  }

  @Post('locked-accounts/unlock')
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantMasterGuard)
  @ApiOperation({
    summary: 'Unlock an account (admin lock and/or temporary lock)',
  })
  async unlock(
    @CurrentUser() u: AcmCurrentUser,
    @Body() dto: UnlockAccountDto,
  ) {
    await this.locks.unlock(u.entId, dto, u.id);
    return { ok: true };
  }
}
