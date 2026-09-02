import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** REQ-260902B — 테넌트 메일(SMTP) 설정 갱신. 모든 필드 부분 갱신. */
export class UpdateMailConfigDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  username?: string;

  /** 앱 비밀번호 — undefined 시 기존값 유지, 빈 문자열이면 삭제. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  fromAddress?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestMailDto {
  @IsEmail()
  @MaxLength(200)
  to!: string;
}
