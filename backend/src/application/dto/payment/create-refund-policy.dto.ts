import { IsString, IsArray, ValidateNested, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class RefundPolicyTierDto {
  @IsNumber()
  tierOrder: number;

  @IsNumber()
  elapsedRatioMin: number;

  @IsNumber()
  elapsedRatioMax: number;

  @IsNumber()
  refundRate: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateRefundPolicyDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  basis?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RefundPolicyTierDto)
  tiers: RefundPolicyTierDto[];
}
