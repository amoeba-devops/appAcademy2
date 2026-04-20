import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreatePaymentOrderDto {
  @ApiProperty({ description: 'Enrollment ID (수강 등록 ID)' })
  @IsInt()
  @IsPositive()
  enrollmentId: number;

  @ApiProperty({ description: 'Payment amount in KRW (결제 금액)' })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Idempotency key (멱등성 키)', maxLength: 64 })
  @IsString()
  @MaxLength(64)
  idempotencyKey: string;
}
