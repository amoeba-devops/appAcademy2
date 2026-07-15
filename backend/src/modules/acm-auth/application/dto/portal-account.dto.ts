import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import type { PortalKind } from '../../infrastructure/typeorm/portal-account.typeorm-entity';

/** PLN-260706 — portal account DTOs (login / change-password / admin issue). */

export class PortalLoginDto {
  @ApiProperty({ example: 'tpi', description: '학원 코드 (테넌트 slug) — PLN-260708' })
  @IsString() @Length(1, 40)
  tenantCode!: string;

  // 학생 계정의 로그인 아이디는 이메일(DB pac_login_id VARCHAR(200), PLN-260714)이므로
  // 상한을 40 → 200 으로 맞춘다. 40자로 두면 긴 이메일 로그인이 거부된다.
  @ApiProperty({ example: 's7k3m9', description: '포털 로그인 아이디 (학생=이메일)' })
  @IsString() @Length(3, 200)
  loginId!: string;

  @ApiProperty({ example: 'Xk7m2Qp9aR' })
  @IsString() @Length(1, 120)
  password!: string;
}

export class PortalChangePasswordDto {
  @ApiProperty()
  @IsString() @Length(1, 120)
  currentPassword!: string;

  @ApiProperty({ description: '8-120자, 영문+숫자 포함' })
  @IsString() @Length(8, 120)
  newPassword!: string;
}

export class IssuePortalAccountDto {
  @ApiProperty({ enum: ['STUDENT', 'PARENT', 'TEACHER'] })
  @IsIn(['STUDENT', 'PARENT', 'TEACHER'])
  kind!: PortalKind;

  @ApiProperty({ description: 'std_id | par_id | tch_id (kind에 대응)' })
  @IsUUID()
  refId!: string;

  // PLN-260716 — 관리자가 비밀번호를 직접 지정(비우면 자동 생성). 포털은 수업일정
  // 조회용 저보안이라 복잡도 강제 없이 4~120자만 허용, 강제 변경도 없음.
  @ApiPropertyOptional({ description: '관리자 지정 비밀번호(비우면 자동생성), 4~120자' })
  @IsOptional() @IsString() @Length(4, 120)
  password?: string;
}

/** PLN-260716 — admin password reset with an optional operator-set password. */
export class ResetPortalPasswordDto {
  @ApiPropertyOptional({ description: '관리자 지정 비밀번호(비우면 자동생성), 4~120자' })
  @IsOptional() @IsString() @Length(4, 120)
  password?: string;
}

/** Response after issue/reset — the temp password is shown ONCE. */
export class PortalCredentialResponse {
  @ApiProperty() id!: string;
  @ApiProperty() loginId!: string;
  @ApiProperty({ description: '임시 비밀번호 (1회 표시). 최초 로그인 시 변경 필요.' })
  tempPassword!: string;
}

/** Read view — never includes the password hash. */
export class PortalAccountView {
  @ApiProperty() id!: string;
  @ApiProperty() kind!: PortalKind;
  @ApiProperty() refId!: string;
  @ApiProperty() loginId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty({ nullable: true }) lastLoginAt!: string | null;
  @ApiProperty({ nullable: true }) lockedAt!: string | null;
}
