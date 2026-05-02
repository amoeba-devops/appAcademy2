import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const SCHEDULE_TYPES = ['REGULAR', 'ROLLING', 'ED', 'EA', 'OTHER'] as const;
export type ScheduleTypeDto = typeof SCHEDULE_TYPES[number];

export class CreateScheduleDto {
  @ApiProperty({ minimum: 2000, maximum: 2100 })
  @IsInt() @Min(2000) @Max(2100)
  year!: number;

  @ApiProperty({ enum: SCHEDULE_TYPES })
  @IsEnum(SCHEDULE_TYPES)
  type!: ScheduleTypeDto;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  openDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  closeDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  testDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  resultDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class UpdateScheduleDto extends PartialType(CreateScheduleDto) {}
