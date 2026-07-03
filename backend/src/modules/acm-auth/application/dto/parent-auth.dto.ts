import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class SendParentOtpDto {
  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9+\-() ]{7,30}$/)
  phone!: string;
}

export class VerifyParentOtpDto extends SendParentOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}

export interface ParentAuthUser {
  id: string;
  entId: string;
  name: string;
  phone: string | null;
  role: 'PARENT';
}

export interface ParentLoginResponse {
  accessToken: string;
  parent: ParentAuthUser;
}
