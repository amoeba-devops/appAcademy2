import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
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
