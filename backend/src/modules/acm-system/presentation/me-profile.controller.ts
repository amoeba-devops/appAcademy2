import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { ACM_DS } from '../../acm-common/datasource';
import { AesGcmService } from '../../acm-common/crypto/aes-gcm.service';
import { normalizeUserTimeZone } from '../../acm-common/time/user-timezone';

export class ConsoleProfileDto {
  /** IANA 타임존. 빈 값이면 테넌트 기본을 따른다. 생략하면 그대로 둔다. */
  @IsOptional() @IsString() @MaxLength(64) timezone?: string | null;
  // REQ-261017 — 마이페이지 비상연락망·자기소개(생략한 항목은 그대로 둔다)
  @IsOptional() @IsString() @MaxLength(100) emergencyName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) emergencyRelation?: string | null;
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+()\-\s]*$/, { message: 'emergencyPhone: digits only' })
  emergencyPhone?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) bio?: string | null;
}

const blankToNull = (v: string | null | undefined) =>
  v == null || !v.trim() ? null : v.trim();

/**
 * REQ-261015C — 콘솔 사용자(관리자·강사·직원) 마이페이지: 사용자 타임존.
 * REQ-261017 — 가입일·비상연락망(연락처는 AES-GCM)·자기소개·로그인 방식.
 */
@ApiTags('acm-system')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard)
@Controller('acm/me/profile')
export class MeProfileController {
  constructor(
    @InjectDataSource(ACM_DS) private readonly ds: DataSource,
    private readonly crypto: AesGcmService,
  ) {}

  private async load(user: AcmCurrentUser) {
    const [row] = await this.ds.query<
      {
        usr_email: string;
        usr_name: string;
        usr_role: string;
        usr_timezone: string | null;
        tnt_timezone: string | null;
        auth_source: string | null;
        has_password: boolean;
        created_at: Date;
        usr_emergency_name: string | null;
        usr_emergency_relation: string | null;
        usr_emergency_phone_encrypted: Buffer | null;
        usr_emergency_phone_iv: Buffer | null;
        usr_emergency_phone_auth_tag: Buffer | null;
        usr_bio: string | null;
      }[]
    >(
      `SELECT u.usr_email, u.usr_name, u.usr_role, u.usr_timezone, t.tnt_timezone,
              u.auth_source, (u.usr_password_hash IS NOT NULL) AS has_password, u.created_at,
              u.usr_emergency_name, u.usr_emergency_relation,
              u.usr_emergency_phone_encrypted, u.usr_emergency_phone_iv, u.usr_emergency_phone_auth_tag,
              u.usr_bio
         FROM amb_acm_user u
         LEFT JOIN amb_acm_tenant t ON t.tnt_ent_id = u.ent_id
        WHERE u.usr_id = $1 AND u.ent_id = $2`,
      [user.id, user.entId],
    );
    let emergencyPhone: string | null = null;
    if (
      row?.usr_emergency_phone_encrypted &&
      row.usr_emergency_phone_iv &&
      row.usr_emergency_phone_auth_tag
    ) {
      try {
        emergencyPhone = this.crypto.decrypt({
          ciphertext: row.usr_emergency_phone_encrypted,
          iv: row.usr_emergency_phone_iv,
          authTag: row.usr_emergency_phone_auth_tag,
        });
      } catch {
        emergencyPhone = null; // 키 교체 등으로 복호화 불가 — 비워서 다시 입력하게 한다
      }
    }
    return {
      email: row?.usr_email ?? user.email ?? '',
      name: row?.usr_name ?? '',
      role: row?.usr_role ?? user.role ?? '',
      timezone: row?.usr_timezone ?? null,
      tenantTimezone: row?.tnt_timezone || 'Asia/Seoul',
      authSource: row?.auth_source ?? 'local',
      hasPassword: !!row?.has_password,
      createdAt: row?.created_at ?? null,
      emergencyName: row?.usr_emergency_name ?? null,
      emergencyRelation: row?.usr_emergency_relation ?? null,
      emergencyPhone,
      bio: row?.usr_bio ?? null,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Own console profile' })
  get(@CurrentUser() user: AcmCurrentUser) {
    return this.load(user);
  }

  @Put()
  @ApiOperation({ summary: 'Update own profile (omitted fields unchanged)' })
  async update(
    @CurrentUser() user: AcmCurrentUser,
    @Body() dto: ConsoleProfileDto,
  ) {
    const sets: string[] = [];
    const params: unknown[] = [user.id, user.entId];
    const set = (col: string, v: unknown) => {
      params.push(v);
      sets.push(`${col} = $${params.length}`);
    };
    if (dto.timezone !== undefined)
      set('usr_timezone', normalizeUserTimeZone(dto.timezone));
    if (dto.emergencyName !== undefined)
      set('usr_emergency_name', blankToNull(dto.emergencyName));
    if (dto.emergencyRelation !== undefined)
      set('usr_emergency_relation', blankToNull(dto.emergencyRelation));
    if (dto.emergencyPhone !== undefined) {
      const phone = blankToNull(dto.emergencyPhone);
      const enc = phone ? this.crypto.encrypt(phone) : null;
      set('usr_emergency_phone_encrypted', enc?.ciphertext ?? null);
      set('usr_emergency_phone_iv', enc?.iv ?? null);
      set('usr_emergency_phone_auth_tag', enc?.authTag ?? null);
    }
    if (dto.bio !== undefined) set('usr_bio', blankToNull(dto.bio));
    if (sets.length)
      await this.ds.query(
        `UPDATE amb_acm_user SET ${sets.join(', ')}, updated_at = now() WHERE usr_id = $1 AND ent_id = $2`,
        params,
      );
    return this.load(user);
  }
}
