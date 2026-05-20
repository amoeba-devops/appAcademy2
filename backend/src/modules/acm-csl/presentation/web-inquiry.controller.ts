import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InquiryService } from '../application/inquiry.service';

const APPLY_PURPOSES = [
  'MAP_TEST_TUTORING',
  'ISEE_TUTORING',
  'INTL_SCHOOL_PREP',
  'GPA_MGMT',
  'ADVANCED_COURSES',
] as const;

const GRADES = [
  '1학년', '2학년', '3학년', '4학년', '5학년', '6학년',
  '중1', '중2', '중3', '고1', '고2', '고3',
] as const;

/** Default tenant entity ID (Trinity Academy). Override via ACM_DEFAULT_ENT_ID env var. */
const DEFAULT_ENT_ID =
  process.env.ACM_DEFAULT_ENT_ID ?? '00000000-0000-0000-0000-000000000001';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export class WebContactDto {
  @IsString() @MinLength(1) @MaxLength(50)
  studentName!: string;

  @IsOptional() @IsString() @MaxLength(10)
  grade?: string;

  @IsString() @MinLength(1) @MaxLength(50)
  parentName!: string;

  @IsOptional() @IsString() @MaxLength(100)
  schoolName?: string;

  @IsString() @Matches(/^[0-9+\-() ]{7,20}$/)
  parentPhone!: string;

  @IsOptional()
  @IsArray()
  @IsIn([...APPLY_PURPOSES], { each: true })
  applyPurposes?: string[];
}

export class WebMapTestDto {
  /** 학생 한글 이름 */
  @IsString() @MinLength(1) @MaxLength(50)
  studentName!: string;

  /** 학부모 이름 — REQ-260520 FR-02-002, 필수 */
  @IsString() @MinLength(1) @MaxLength(50)
  parentName!: string;

  /** 학생 영문 이름 */
  @IsOptional() @IsString() @MaxLength(100)
  studentNameEn?: string;

  /** 생년월일 YYYY-MM-DD */
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthdate?: string;

  @IsOptional() @IsString() @MaxLength(10)
  grade?: string;

  /** 성별 */
  @IsOptional() @IsString() @MaxLength(10)
  gender?: string;

  @IsString() @Matches(/^[0-9+\-() ]{7,20}$/)
  parentPhone!: string;

  /** 학부모 이메일 */
  @IsOptional() @IsString() @MaxLength(200)
  parentEmail?: string;

  /** 응시 국가/도시 */
  @IsOptional() @IsString() @MaxLength(100)
  location?: string;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * Public intake endpoints — no JWT required.
 * Routes: /api/web/contact, /api/web/test
 */
@ApiTags('web-public')
@Controller('web')
export class WebInquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  /**
   * POST /api/web/contact
   * Public consultation request form (mirrors tpi.co.kr/contact).
   */
  @Post('contact')
  @HttpCode(201)
  @ApiOperation({ summary: 'Public contact / counseling request' })
  async submitContact(@Body() dto: WebContactDto) {
    const memo = dto.applyPurposes?.length
      ? `신청 목적: ${dto.applyPurposes.join(', ')}`
      : null;

    await this.inquiryService.create(DEFAULT_ENT_ID, {
      studentName: dto.studentName,
      grade: dto.grade,
      parentName: dto.parentName,
      schoolName: dto.schoolName,
      parentPhone: dto.parentPhone,
      phoneStatus: 'PROVIDED',
      inflowType: 'HOMEPAGE',
      applyType: 'COUNSELING_ONLY',
      applyPurposes: dto.applyPurposes ?? [],
      schoolFreetext: dto.schoolName || '홈페이지 접수',
      followupMemo: memo ?? undefined,
    });

    return { success: true };
  }

  /**
   * POST /api/web/test
   * Public MAP Test registration form (mirrors tpi.co.kr/test).
   */
  @Post('test')
  @HttpCode(201)
  @ApiOperation({ summary: 'Public MAP Test registration request' })
  async submitMapTest(@Body() dto: WebMapTestDto) {
    const details: string[] = [];
    if (dto.studentNameEn) details.push(`영문이름: ${dto.studentNameEn}`);
    if (dto.birthdate) details.push(`생년월일: ${dto.birthdate}`);
    if (dto.gender) details.push(`성별: ${dto.gender}`);
    if (dto.parentEmail) details.push(`이메일: ${dto.parentEmail}`);
    if (dto.location) details.push(`응시 국가/도시: ${dto.location}`);

    await this.inquiryService.create(DEFAULT_ENT_ID, {
      studentName: dto.studentName,
      parentName: dto.parentName,
      grade: dto.grade,
      parentPhone: dto.parentPhone,
      phoneStatus: 'PROVIDED',
      inflowType: 'HOMEPAGE',
      applyType: 'EXAM_ONLY',
      applyPurposes: ['MAP_TEST_TUTORING'],
      schoolFreetext: '홈페이지 접수',
      followupMemo: details.length ? details.join(' / ') : undefined,
    });

    return { success: true };
  }
}
