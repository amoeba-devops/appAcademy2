import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class CreateTestSetItemDto {
  @ApiProperty({ description: 'Item ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  itemId: number;

  @ApiPropertyOptional({ description: 'Display ordinal', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ordinal?: number;
}

export class CreateTestSetDto {
  @ApiProperty({ description: 'Test set name', example: '2026 Spring Formative #3' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Composition mode', example: 'FIXED' })
  @IsOptional()
  @IsString()
  @IsIn(['FIXED', 'SHUFFLED'])
  compositionMode?: string;

  @ApiPropertyOptional({ description: 'Saved bank filters', example: { gradeLevel: 'G6' } })
  @IsOptional()
  @IsObject()
  filterCriteria?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Status', example: 'DRAFT' })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: string;

  @ApiProperty({ description: 'Selected items', type: [CreateTestSetItemDto] })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((item) => ({
          itemId: Number(item?.itemId),
          ordinal: item?.ordinal !== undefined ? Number(item.ordinal) : undefined,
        }))
      : [],
  )
  @IsArray()
  @ArrayMinSize(1)
  items: CreateTestSetItemDto[];
}

export { CreateTestSetItemDto };