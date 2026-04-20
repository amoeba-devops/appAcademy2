import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProgramSettingResponseDto {
  @ApiProperty()
  id: number;

  @ApiPropertyOptional()
  feeAmount: string | null;

  @ApiProperty()
  feeCurrency: string;

  @ApiPropertyOptional()
  capacityMax: number | null;

  @ApiPropertyOptional()
  sessionCount: number | null;

  @ApiPropertyOptional()
  materialInfo: unknown | null;

  @ApiPropertyOptional()
  refundPolicy: unknown | null;

  @ApiProperty()
  updatedAt: Date;
}

export class ProgramResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  durationWeeks: number | null;

  @ApiPropertyOptional()
  targetAgeMin: number | null;

  @ApiPropertyOptional()
  targetAgeMax: number | null;

  @ApiPropertyOptional()
  level: string | null;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional({ type: ProgramSettingResponseDto })
  setting: ProgramSettingResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
