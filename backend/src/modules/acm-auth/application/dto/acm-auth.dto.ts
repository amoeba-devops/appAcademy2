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
  role?: 'ADMIN' | 'TEACHER' | 'STAFF' | 'APP_ADMIN';
  authSource?: 'local' | 'ama';
  /** REQ-260621 — true when the user must rotate their password before use. */
  mustChangePassword?: boolean;
}

export class AcmChangePasswordDto {
  @ApiProperty({ minLength: 8, maxLength: 120 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 120 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  newPassword!: string;
}

export interface AcmLoginResponse {
  accessToken: string;
  user: AcmAuthUser;
}

export class AmaExchangeDto {
  @ApiProperty({ description: 'AMA Custom App context JWT (HS256)' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  amaToken!: string;
}
