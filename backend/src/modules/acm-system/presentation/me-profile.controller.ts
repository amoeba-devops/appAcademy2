import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ACM_DS } from '../../acm-common/datasource';
import { normalizeUserTimeZone } from '../../acm-common/time/user-timezone';

export class ConsoleProfileDto {
  /** IANA 타임존. 빈 값이면 테넌트 기본을 따른다. */
  @IsOptional() @IsString() @MaxLength(64) timezone?: string | null;
}

/** REQ-261015C — 콘솔 사용자(관리자·강사·직원) 마이페이지: 사용자 타임존. */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('acm/me/profile')
export class MeProfileController {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  private async load(user: AcmCurrentUser) {
    const [row] = await this.ds.query<
      {
        usr_email: string;
        usr_name: string;
        usr_role: string;
        usr_timezone: string | null;
        tnt_timezone: string | null;
      }[]
    >(
      `SELECT u.usr_email, u.usr_name, u.usr_role, u.usr_timezone, t.tnt_timezone
         FROM amb_acm_user u
         LEFT JOIN amb_acm_tenant t ON t.tnt_ent_id = u.ent_id
        WHERE u.usr_id = $1 AND u.ent_id = $2`,
      [user.id, user.entId],
    );
    return {
      email: row?.usr_email ?? user.email ?? '',
      name: row?.usr_name ?? '',
      role: row?.usr_role ?? user.role ?? '',
      timezone: row?.usr_timezone ?? null,
      tenantTimezone: row?.tnt_timezone || 'Asia/Seoul',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Own console profile (timezone)' })
  get(@CurrentUser() user: AcmCurrentUser) {
    return this.load(user);
  }

  @Put()
  @ApiOperation({ summary: 'Update own timezone (empty = tenant default)' })
  async update(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: ConsoleProfileDto,
  ) {
    await this.ds.query(
      `UPDATE amb_acm_user SET usr_timezone = $3 WHERE usr_id = $1 AND ent_id = $2`,
      [user.id, user.entId, normalizeUserTimeZone(dto.timezone)],
    );
    return this.load(user);
  }
}
