import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const MAX_INT = 1_000_000_000;

/**
 * Direct full-row manual edit of a single daily_kpi row.
 * 19 metric fields all optional. csCounseling/csApply etc. are normally
 * recomputed from CSL aggregates but operators can override them here.
 * marketingEffect is intentionally OMITTED — it is always derived as
 * (csCounseling + csApply) at read time.
 */
export class UpsertDailyKpiManualDto {
  // Marketing
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT)
  marketingVisitor?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT)
  marketingCost?: number;

  // CS
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csCounseling?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csApply?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csBeginning?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csMissing?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csTrialClass?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) csComplain?: number;

  // Operating
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsNewSt?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsOutSt?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsCountSt?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsNewTc?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsOutTc?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) opsCountTc?: number;

  // Class
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) classMapTest?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) classTtClass?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) classStudent?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_INT) classTeacher?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}
