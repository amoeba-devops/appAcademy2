import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InquiryService } from '../application/inquiry.service';
import { MapApplyService } from '../application/map-apply.service';
import { ExternalMapApplyDto } from '../application/dto/map-apply.dto';
import type { ApplyPurpose } from '../infrastructure/typeorm/inquiry.typeorm-entity';
import { resolveSiteByKey } from './external-intake.config';

/** Default tenant entity ID (Trinity Academy). Override via ACM_DEFAULT_ENT_ID env var. */
const DEFAULT_ENT_ID =
  process.env.ACM_DEFAULT_ENT_ID ?? '00000000-0000-0000-0000-000000000001';

// ── DTO ──────────────────────────────────────────────────────────────────────

export class ExternalIntakeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  studentName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  parentName?: string;

  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/)
  parentPhone!: string;

  /**
   * 요구 260914E — 사이트 폼에서 연락처를 전화번호/이메일로 분리하면서 추가.
   * 이메일 칸이 없는 사이트도 있으므로 optional 로 둔다.
   */
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  parentEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  /** Raw checkbox labels as shown on the site — mapped server-side (FR-3). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  applyPurposeLabels?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Personal-info collection consent — must be true (FR-6). */
  @IsBoolean()
  @Equals(true, { message: 'consent required' })
  consent!: boolean;

  /** Honeypot — hidden field, humans leave it empty. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * REQ-260903G — public consultation intake for external imweb sites
 * (tpi.co.kr / trinityacademy.imweb.me / santacroce.co.kr).
 *
 * No JWT. Defense: per-site key header (identification), Origin allowlist,
 * 10 req/min/IP throttle, honeypot. The key is embedded in browser JS and
 * is NOT a secret — see external-intake.config.ts.
 */
@ApiTags('web-public')
@Controller('web')
export class ExternalIntakeController {
  constructor(
    private readonly inquiryService: InquiryService,
    private readonly mapApply: MapApplyService,
  ) {}

  @Post('external-intake')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'External-site consultation intake (imweb forms)' })
  @ApiHeader({ name: 'x-acm-site-key', description: 'Per-site intake key' })
  async submit(
    @Body() dto: ExternalIntakeDto,
    @Headers('x-acm-site-key') siteKey?: string,
    @Headers('origin') origin?: string,
  ) {
    // Honeypot filled → pretend success, store nothing (don't tip off bots).
    if (dto.website) return { success: true };

    const site = siteKey ? resolveSiteByKey(siteKey) : undefined;
    if (!site) throw new UnauthorizedException('invalid site key');

    // Browser requests carry Origin; enforce allowlist when present.
    if (origin && !site.origins.includes(origin)) {
      throw new ForbiddenException('origin not allowed');
    }

    // Map site checkbox labels → standard codes; keep unmapped labels verbatim.
    const codes = new Set<ApplyPurpose>();
    const unmapped: string[] = [];
    for (const label of dto.applyPurposeLabels ?? []) {
      const code = site.purposeMap[label.trim()];
      if (code) codes.add(code);
      else if (label.trim()) unmapped.push(label.trim());
    }

    const view = await this.inquiryService.create(DEFAULT_ENT_ID, {
      studentName: dto.studentName,
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail,
      phoneStatus: 'PROVIDED',
      grade: dto.grade,
      inflowType: 'WEB_EXTERNAL',
      sourceSite: site.code,
      applyType: 'COUNSELING_ONLY',
      applyPurposes: [...codes],
      applyPurposeOther: unmapped.length ? unmapped.join(', ') : undefined,
      schoolFreetext: dto.schoolName || site.displayName,
      followupMemo: dto.message || undefined,
    });

    return { success: true, seqNo: view.seqNo };
  }

  /**
   * CSL-PLN-260916 — MAP TEST 응시 신청 (아임웹 `/test2`).
   * 방어 수단(사이트 키·오리진·허니팟·레이트리밋)은 상담 접수와 동일하다.
   */
  @Post('external-intake/map-test')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'External-site MAP test application (imweb /test2)',
  })
  @ApiHeader({ name: 'x-acm-site-key', description: 'Per-site intake key' })
  async submitMapTest(
    @Body() dto: ExternalMapApplyDto,
    @Headers('x-acm-site-key') siteKey?: string,
    @Headers('origin') origin?: string,
  ) {
    // Honeypot filled → pretend success, store nothing.
    if (dto.website) return { success: true };

    const site = siteKey ? resolveSiteByKey(siteKey) : undefined;
    if (!site) throw new UnauthorizedException('invalid site key');
    if (origin && !site.origins.includes(origin)) {
      throw new ForbiddenException('origin not allowed');
    }

    const r = await this.mapApply.createFromIntake(
      DEFAULT_ENT_ID,
      site.code,
      dto,
    );
    return { success: true, seqNo: r.seqNo };
  }
}
