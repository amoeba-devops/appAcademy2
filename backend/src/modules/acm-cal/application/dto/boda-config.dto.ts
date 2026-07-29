import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * BODA(보다에듀) 테넌트 연동 설정 DTO.
 *
 * - REQ-260526 v2 FR-BODA-CFG-1..5
 * - Secret 입력 (`authKey`, `eventSecret`) 은 새 값을 보낼 때만 채우고,
 *   유지/변경 안함은 필드 자체를 생략. 응답에는 절대 포함 안 됨 (FR-CFG-3,
 *   AC-CFG-1) → 별도 `BodaConfigResponseDto` 를 사용한다.
 */
export class UpdateBodaConfigDto {
  // 공개 URL/식별자 — 변경 가능
  @ApiPropertyOptional({ example: 'https://bodaedu.kr' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  bodaWebUrl?: string;

  @ApiPropertyOptional({ example: 'https://svr.bodaedu.kr' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  svrUrl?: string;

  @ApiPropertyOptional({ example: 'https://bodaedu.kr/webrtc' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  webrtcUrl?: string;

  @ApiPropertyOptional({ description: 'BODA 측 companyCode (공개 식별자)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  companyCode?: string;

  @ApiPropertyOptional({ description: 'BODA 측 companyId (공개 식별자)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  companyId?: string;

  @ApiPropertyOptional({
    description: '기본 roomCode (TPI 1:1 수업 = vendor 발급값)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  defaultRoomCode?: string;

  @ApiPropertyOptional({
    description: '1:N(그룹) roomCode (TPI = 881). @see FIX-260724',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  groupRoomCode?: string;

  // 비밀 — 새 값을 보낼 때만 채움. 빈 문자열은 "지우기" 가 아니라 변경 없음 의미
  // (BODA 측 키 회전 시점에만 PUT). 명시적 삭제는 별건 endpoint 가 필요.
  @ApiPropertyOptional({
    description: '신규 authKey (보내면 즉시 AES-GCM 으로 저장)',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  authKey?: string;

  @ApiPropertyOptional({
    description: '신규 Webhook 공유비밀 (보내면 즉시 저장)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  eventSecret?: string;

  // 운영 옵션
  @ApiPropertyOptional({
    description:
      'Webhook 출발지 허용 IP/CIDR. 콤마 구분 (예: "1.2.3.4,10.0.0.0/24")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^[0-9.,/\s]*$/, {
    message: 'webhookAllowCidrs must contain only IPv4 / CIDR / "," / spaces',
  })
  webhookAllowCidrs?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 60,
    description: '입장 가능 시작 N분 전',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  graceBeforeMin?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 120,
    description: '입장 가능 종료 후 M분',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  graceAfterMin?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 60,
    description: 'reconcile 지연 N분',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  reconcileDelayMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * 응답 DTO — 비밀 값은 절대 포함 안 됨 (FR-CFG-3 / AC-CFG-1).
 * 대신 `is_set` 플래그로 채워졌는지만 노출.
 */
export class BodaConfigResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() entId!: string;

  @ApiProperty() bodaWebUrl!: string;
  @ApiProperty() svrUrl!: string;
  @ApiProperty() webrtcUrl!: string;
  @ApiProperty() companyCode!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() defaultRoomCode!: string;
  @ApiPropertyOptional({ nullable: true }) groupRoomCode?: string | null;

  /** 비밀이 저장되어 있는지 여부만 (값은 미노출). */
  @ApiProperty() authKeyIsSet!: boolean;
  @ApiProperty() eventSecretIsSet!: boolean;

  @ApiPropertyOptional() webhookAllowCidrs?: string | null;
  @ApiProperty() graceBeforeMin!: number;
  @ApiProperty() graceAfterMin!: number;
  @ApiProperty() reconcileDelayMin!: number;
  @ApiProperty() isActive!: boolean;

  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
