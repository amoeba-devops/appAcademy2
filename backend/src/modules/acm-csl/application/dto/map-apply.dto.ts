import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  MAP_APPLY_GENDERS,
  type MapApplyGender,
} from '../../infrastructure/typeorm/map-apply.typeorm-entity';
import type {
  CslStage,
  SourceSite,
} from '../../infrastructure/typeorm/inquiry.typeorm-entity';

/** inquiry.dto.ts 의 동명 상수는 모듈 비공개라 여기서 다시 선언한다. */
const SOURCE_SITES: readonly SourceSite[] = ['TPI', 'TRINITY', 'SANTACROCE'];
const STAGES: readonly CslStage[] = [
  'INTAKE',
  'MAP_TEST',
  'TRIAL_CLASS',
  'ENROLLMENT_COUNSELING',
  'PAYMENT',
  'CLASS_STARTED',
  'ATTENDING',
  'DROPPED',
];

/** CSL-PLN-260916 — 아임웹 `/test2` 공개 접수 payload. */
export class ExternalMapApplyDto {
  @ApiProperty({ description: '학생 한글 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  studentName!: string;

  @ApiProperty({ description: '학생 영문 이름' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  studentNameEn!: string;

  /** `20100914` 또는 `2010-09-14`. 정규화 실패해도 원문을 보존한다. */
  @ApiProperty({ description: '생년월일 (YYYYMMDD)' })
  @IsString()
  @MinLength(4)
  @MaxLength(40)
  birthdate!: string;

  @ApiProperty({ description: '학년 (자유 입력, 예: G10)' })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  grade!: string;

  @ApiPropertyOptional({ enum: MAP_APPLY_GENDERS })
  @IsOptional()
  @IsEnum(MAP_APPLY_GENDERS)
  gender?: MapApplyGender;

  @ApiProperty({ description: '연락처 (숫자만)' })
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/)
  parentPhone!: string;

  @ApiPropertyOptional({ description: '학부모 이메일' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  parentEmail?: string;

  @ApiProperty({ description: '응시 국가/도시' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  examLocation!: string;

  @ApiPropertyOptional({ description: '응시 희망 요일/시간' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredSlot?: string;

  @ApiProperty({ description: '개인정보 수집·이용 동의 (필수)' })
  @IsBoolean()
  @Equals(true)
  consent!: boolean;

  /** 허니팟 — 값이 있으면 봇으로 간주하고 조용히 무시한다. */
  @ApiPropertyOptional({ description: 'Honeypot (must stay empty)' })
  @IsOptional()
  @IsString()
  website?: string;
}

/** 목록 조회 쿼리. */
export class ListMapApplyQueryDto {
  @ApiPropertyOptional({ description: '학생명·영문명·연락처 뒤 4자리' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: SOURCE_SITES })
  @IsOptional()
  @IsEnum(SOURCE_SITES)
  site?: SourceSite;

  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsEnum(STAGES)
  stage?: CslStage;

  @ApiPropertyOptional({ description: '접수일 From (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ description: '접수일 To (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

/** 신청서 원본 항목 보정. */
export class UpdateMapApplyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expectedUpdatedAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  studentNameEn?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD (빈 문자열이면 해제)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  birthdate?: string;

  @ApiPropertyOptional({ enum: MAP_APPLY_GENDERS, nullable: true })
  @IsOptional()
  @IsIn([...MAP_APPLY_GENDERS, null])
  gender?: MapApplyGender | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  examLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredSlot?: string;
}

/** 아임웹 CSV 이관 1건. */
export class ImportMapApplyRowDto {
  @ApiProperty({ description: '아임웹 작성시각 (ISO 또는 YYYY-MM-DD HH:mm)' })
  @IsString()
  @MaxLength(40)
  submittedAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  studentName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  studentNameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  birthdate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  grade?: string;

  @ApiPropertyOptional({ enum: MAP_APPLY_GENDERS })
  @IsOptional()
  @IsEnum(MAP_APPLY_GENDERS)
  gender?: MapApplyGender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  parentPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  examLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  preferredSlot?: string;
}

/** 아임웹 CSV 이관 요청 (관리자 전용). */
export class ImportMapApplyDto {
  @ApiProperty({ enum: SOURCE_SITES, description: '이관 대상 사이트' })
  @IsEnum(SOURCE_SITES)
  site!: SourceSite;

  @ApiProperty({ type: [ImportMapApplyRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportMapApplyRowDto)
  rows!: ImportMapApplyRowDto[];

  @ApiPropertyOptional({
    default: false,
    description: 'true 면 저장하지 않고 검증 결과만 반환',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

/** 목록 1행. */
export interface MapApplyListItem {
  id: string;
  inqId: string;
  seqNo: number;
  submittedAt: string;
  sourceSite: string;
  origin: string;
  studentName: string;
  studentNameEn: string | null;
  birthdate: string | null;
  grade: string | null;
  gender: MapApplyGender | null;
  parentPhone: string | null;
  parentEmail: string | null;
  examLocation: string | null;
  preferredSlot: string | null;
  currentStage: CslStage;
}

export interface MapApplyDetail extends MapApplyListItem {
  updatedAt: string;
  birthdateRaw: string | null;
  followupAt: string | null;
  followupMemo: string | null;
  registeredAt: string;
  advisorId: string | null;
  rawPayload: Record<string, unknown> | null;
}
