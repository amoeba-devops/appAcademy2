import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateQnaCategoryDto {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @IsString() @MinLength(1) @MaxLength(50)
  code!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @IsString() @MinLength(1) @MaxLength(100)
  labelKr!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  labelEn?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  labelVi?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  labelZh?: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateQnaCategoryDto extends PartialType(CreateQnaCategoryDto) {}
