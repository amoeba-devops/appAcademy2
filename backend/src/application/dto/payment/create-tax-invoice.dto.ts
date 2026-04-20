import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateTaxInvoiceDto {
  @IsInt()
  orderId: number;

  @IsString()
  supplierBizNo: string;

  @IsOptional()
  @IsString()
  buyerBizNo?: string;

  @IsOptional()
  @IsString()
  buyerType?: string;
}
