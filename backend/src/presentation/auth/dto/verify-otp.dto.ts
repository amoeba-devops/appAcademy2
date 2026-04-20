import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, { message: '올바른 휴대폰 번호를 입력해주세요.' })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP는 6자리입니다.' })
  otp: string;
}
