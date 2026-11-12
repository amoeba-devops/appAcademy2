import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
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

  /** CSL-PLN-260916 — 운영자 알림 수신 이메일 (쉼표 구분) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operatorEmails?: string;

  /** REQ-261112I — 메일 기본 숨은참조(BCC) (쉼표 구분, 비우면 없음) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(
    /^\s*$|^\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+\s*(,\s*[^\s@,]+@[^\s@,]+\.[^\s@,]+\s*)*,?\s*$/,
    {
      message: 'defaultBcc must be comma-separated email addresses',
    },
  )
  defaultBcc?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestMailDto {
  @IsEmail()
  @MaxLength(200)
  to!: string;
}
