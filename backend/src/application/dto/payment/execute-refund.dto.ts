import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ExecuteRefundDto {
  @IsInt()
  orderId: number;

  @IsInt()
  @Min(0)
  heldSessionCount: number;

  @IsInt()
  @Min(1)
  totalSessionCount: number;

  @IsString()
  cancelReason: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  overrideAmount?: number;
}
