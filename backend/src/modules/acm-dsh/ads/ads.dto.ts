import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  IsOptional,
  IsObject,
  Matches,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { PROVIDERS, type Provider } from './ads.types';
export class ConnectionConfigDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) mappingEffectiveFrom?: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate!: string;
  @IsOptional() @IsIn(['TPI', 'TRINITY', 'SANTACROCE']) defaultSite?:
    | 'TPI'
    | 'TRINITY'
    | 'SANTACROCE';
  @IsObject() campaigns!: Record<string, 'TPI' | 'TRINITY' | 'SANTACROCE'>;
  @IsOptional() @Matches(/^\d{1,20}$/) managerId?: string;
  @IsOptional() @Matches(/^v\d+(\.\d+)?$/) apiVersion?: string;
}
export class SaveConnectionDto {
  @IsOptional() @IsInt() @Min(1) expectedRevision?: number;
  @IsIn(PROVIDERS) provider!: Provider;
  @Matches(/^[a-zA-Z0-9_-]{1,80}$/) accountId!: string;
  @IsString() @MaxLength(100) name!: string;
  @ValidateNested()
  @Type(() => ConnectionConfigDto)
  config!: ConnectionConfigDto;
  @IsOptional() @IsObject() credentials?: Record<string, string>;
}
export class SyncDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
}
export class RevisionDto {
  @IsInt() @Min(1) expectedRevision!: number;
}
export class AdjustmentDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsIn(['TPI', 'TRINITY', 'SANTACROCE']) site!: string;
  @IsIn(PROVIDERS) provider!: Provider;
  @IsIn(['DELTA', 'FIXED', 'RESET']) mode!: 'DELTA' | 'FIXED' | 'RESET';
  @IsInt() @Min(-999999999999) @Max(999999999999) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsIn(['ADD', 'REPLACE']) manualMode?: 'ADD' | 'REPLACE';
}

export class OAuthFinishDto {
  @Matches(/^[a-f0-9]{64}$/) state!: string;
  @IsString() @MaxLength(4096) code!: string;
}
