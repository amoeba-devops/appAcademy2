import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
export class BillInput {
  @IsUUID() studentId!: string;
  @IsOptional() @IsUUID() classId?: string;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) due!: string;
  @IsIn(['CLASS', 'BOOK', 'MATERIAL', 'TRANSPORT', 'OTHER']) kind!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsInt() @Min(0) @Max(50000000) amount!: number;
  @IsInt() @Min(0) @Max(50000000) discount!: number;
  @IsOptional() @IsString() @MaxLength(2000) memo?: string;
}
export class BillBatchDto {
  @IsUUID() requestId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BillInput)
  items!: BillInput[];
}
export class BillEdit {
  @IsUUID() id!: string;
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(0) @Max(50000000) amount!: number;
  @IsInt() @Min(0) @Max(50000000) discount!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) due!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @IsString() @MaxLength(2000) memo!: string;
}
export class EditBatchDto {
  @IsUUID() requestId!: string;
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BillEdit)
  items!: BillEdit[];
}
export class BillActionDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) version!: number;
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
}
export class CollectionDto extends BillActionDto {
  @IsInt() @Min(1) @Max(50000000) amount!: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true }) date!: string;
  @IsIn(['CASH', 'TRANSFER', 'CARD', 'OTHER']) method!: string;
}
export class RefundDto extends CollectionDto {
  @IsUUID() originalId!: string;
  @IsIn(['REFUND', 'REVERSAL']) type!: 'REFUND' | 'REVERSAL';
  @IsBoolean() reduceBill!: boolean;
}
export class AdjustmentDto extends BillActionDto {
  @IsInt() @Min(-50000000) @Max(50000000) amount!: number;
}
export class BillQuery {
  @IsOptional() @IsIn(['MONTH', 'PAYMENT']) basis?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/) to?: string;
  @IsOptional() @IsIn(['true', 'false']) previous?: string;
  @IsOptional() @IsIn(['true', 'false']) canceled?: string;
  @IsOptional()
  @IsIn(['DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'FREE'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(100) school?: string;
  @IsOptional() @IsString() @MaxLength(30) grade?: string;
  @IsOptional() @IsString() @MaxLength(20) site?: string;
  @IsOptional() @IsString() @MaxLength(20) studentStatus?: string;
  @IsOptional() @IsString() @MaxLength(100) memo?: string;
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsUUID() teacherId?: string;
  @IsOptional()
  @IsIn(['CLASS', 'BOOK', 'MATERIAL', 'TRANSPORT', 'OTHER'])
  kind?: string;
  @IsOptional() @IsIn(['CASH', 'TRANSFER', 'CARD', 'OTHER']) method?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dueFrom?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dueTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}

export class StateItem {
  @IsUUID() id!: string;
  @IsInt() @Min(1) version!: number;
}
export class StateBatchDto {
  @IsUUID() requestId!: string;
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
  @IsBoolean() restore!: boolean;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => StateItem)
  items!: StateItem[];
}

export class ActiveDraftBatchDto {
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional()
  @IsIn(['ALL', 'TPI', 'TRINITY', 'SANTACROCE', 'UNASSIGNED'])
  site?: string;
  @IsOptional() @IsIn(['CURRENT', 'MONTH']) roster?: string;
  @IsUUID() requestId!: string;
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month!: string;
  @IsString() @MinLength(1) @MaxLength(200) title!: string;
}

export class MonthlyPayQuery {
  @Matches(/^(20[0-9]{2})-(0[1-9]|1[0-2])$/) month!: string;
  @IsOptional()
  @IsIn(['ALL', 'TPI', 'TRINITY', 'SANTACROCE', 'UNASSIGNED'])
  site?: string;
  @IsOptional() @IsIn(['ENROLLED', 'ALL', 'REVIEW']) scope?: string;
  @IsOptional()
  @IsIn(['NONE', 'DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'FREE', 'FINALIZED'])
  status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
}
