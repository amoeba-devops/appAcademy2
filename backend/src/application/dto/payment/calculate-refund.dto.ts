import { IsInt, Min } from 'class-validator';

export class CalculateRefundDto {
  @IsInt()
  orderId: number;

  @IsInt()
  @Min(0)
  heldSessionCount: number;

  @IsInt()
  @Min(1)
  totalSessionCount: number;
}
