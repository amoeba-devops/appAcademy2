import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: '010-1234-5678', description: 'Parent phone number (학부모 휴대폰 번호)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^01[016789]-?\d{3,4}-?\d{4}$/, { message: '올바른 휴대폰 번호를 입력해주세요.' })
  phone: string;
}
