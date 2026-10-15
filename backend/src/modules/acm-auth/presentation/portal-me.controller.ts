import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { ACM_DS } from '../../acm-common/datasource';
import { normalizeUserTimeZone } from '../../acm-common/time/user-timezone';
import { PortalJwtAuthGuard } from '../guards/portal-jwt-auth.guard';
import { PortalUser } from '../decorators/portal-user.decorator';
import type { PortalAuthUser } from '../application/portal-account.service';

export class PortalProfileDto {
  /** IANA 타임존. 빈 값이면 테넌트 기본을 따른다. */
  @IsOptional() @IsString() @MaxLength(64) timezone?: string | null;
}

interface ProfileRow {
  pac_login_id: string;
  pac_kind: string;
  pac_timezone: string | null;
  tnt_timezone: string | null;
  name: string | null;
}

/** REQ-261015C — 포털(학생·학부모·강사) 마이페이지: 사용자 타임존. */
@ApiTags('portal-auth')
@ApiBearerAuth()
@UseGuards(PortalJwtAuthGuard)
@Controller('portal/me')
export class PortalMeController {
  constructor(@InjectDataSource(ACM_DS) private readonly ds: DataSource) {}

  private async load(user: PortalAuthUser) {
    const [row] = await this.ds.query<ProfileRow[]>(
      `SELECT a.pac_login_id, a.pac_kind, a.pac_timezone, t.tnt_timezone,
              CASE a.pac_kind
                WHEN 'STUDENT' THEN (SELECT s.std_name FROM amb_acm_std_student s WHERE s.std_id = a.pac_ref_id AND s.ent_id = a.ent_id)
                WHEN 'TEACHER' THEN (SELECT tc.tch_name FROM amb_acm_tch_teacher tc WHERE tc.tch_id = a.pac_ref_id AND tc.ent_id = a.ent_id)
              END AS name
         FROM amb_acm_portal_account a
         LEFT JOIN amb_acm_tenant t ON t.tnt_ent_id = a.ent_id
        WHERE a.pac_id = $1 AND a.ent_id = $2`,
      [user.id, user.entId],
    );
    return {
      kind: row?.pac_kind ?? user.kind,
      loginId: row?.pac_login_id ?? user.loginId,
      name: row?.name ?? null,
      timezone: row?.pac_timezone ?? null,
      tenantTimezone: row?.tnt_timezone || 'Asia/Seoul',
    };
  }

  @Get()
  @ApiOperation({ summary: 'Own portal profile (timezone)' })
  get(@PortalUser() user: PortalAuthUser) {
    return this.load(user);
  }

  @Put()
  @ApiOperation({ summary: 'Update own timezone (empty = tenant default)' })
  async update(
    @PortalUser() user: PortalAuthUser,
    @Body() dto: PortalProfileDto,
  ) {
    await this.ds.query(
      `UPDATE amb_acm_portal_account SET pac_timezone = $3 WHERE pac_id = $1 AND ent_id = $2`,
      [user.id, user.entId, normalizeUserTimeZone(dto.timezone)],
    );
    return this.load(user);
  }
}
