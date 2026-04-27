import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** C-08 — Reassign advisor */
export class AssignDto {
  @ApiProperty() @IsUUID()
  advisorId!: string;
}

/** C-26 — Append timeline note */
export class CreateRemarkDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000)
  body!: string;
}

/** C-12 — Backward override (admin) */
export class BackwardTransitionDto {
  @ApiProperty({ description: 'Target stage' }) @IsString()
  toStage!: string;

  @ApiProperty({ description: 'Reason required for backward override' })
  @IsString() @MinLength(2) @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
