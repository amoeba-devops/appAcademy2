import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Toss paymentKey' })
  @IsString()
  @MaxLength(200)
  paymentKey: string;

  @ApiProperty({ description: 'Order ID sent to Toss (= orderNo)' })
  @IsString()
  @MaxLength(64)
  orderId: string;

  @ApiProperty({ description: 'Amount to confirm (결제 승인 금액)' })
  @IsNumber()
  @IsPositive()
  amount: number;
}
