import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGradeBandDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString() @MinLength(1) @MaxLength(80)
  label!: string;

  @ApiProperty({ minimum: 1, maximum: 13 })
  @IsInt() @Min(1) @Max(13)
  gradeMin!: number;

  @ApiProperty({ minimum: 1, maximum: 13 })
  @IsInt() @Min(1) @Max(13)
  gradeMax!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class UpdateGradeBandDto extends PartialType(CreateGradeBandDto) {}
