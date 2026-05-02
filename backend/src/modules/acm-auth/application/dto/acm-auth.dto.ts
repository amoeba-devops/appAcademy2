import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class AcmLoginDto {
  @ApiProperty({ example: 'admin@acm.local' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ example: 'acm20261234', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}

export interface AcmAuthUser {
  id: string;
  entId: string;
  email: string;
  name: string;
}

export interface AcmLoginResponse {
  accessToken: string;
  user: AcmAuthUser;
}
