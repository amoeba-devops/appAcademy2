import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
export class AdCostDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MaxLength(100) medium!: string;
  @IsInt() @Min(0) @Max(999999999999) amount!: number;
}
export class MarketingSitePatchDto {
  @IsIn(['TPI', 'TRINITY', 'SANTACROCE', 'COMMON']) site!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000000) adjustment?: number | null;
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdCostDto)
  ads?: AdCostDto[];
}
export class MarketingPatchDto {
  @IsInt() @Min(0) expectedRevision!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => MarketingSitePatchDto)
  sites!: MarketingSitePatchDto[];
}
