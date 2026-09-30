import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateCalEventDto, UpdateCalEventDto } from './cal-event.dto';
export class RecurrenceRuleDto {
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'DATES']) kind!:
    | 'DAILY'
    | 'WEEKLY'
    | 'MONTHLY'
    | 'DATES';
  @IsInt() @Min(1) @Max(365) interval = 1;
  @IsBoolean() excludeWeekends = false;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsDateString({}, { each: true })
  dates?: string[];
  @IsIn(['NEVER', 'UNTIL', 'COUNT']) end!: 'NEVER' | 'UNTIL' | 'COUNT';
  @IsOptional() @IsDateString() until?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100000) count?: number;
}
export class RecurrencePreviewDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCalEventDto)
  event!: CreateCalEventDto;
  @IsDefined()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  rule!: RecurrenceRuleDto;
}
export class CreateRecurrenceDto extends RecurrencePreviewDto {
  @IsUUID() requestId!: string;
}
export class ChangeRecurrenceDto {
  @IsIn(['ONE', 'FOLLOWING', 'ALL']) scope!: 'ONE' | 'FOLLOWING' | 'ALL';
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(2) @MaxLength(500) reason!: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCalEventDto)
  event?: UpdateCalEventDto;
}
