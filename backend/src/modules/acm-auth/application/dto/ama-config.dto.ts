import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * AMA 연동 설정 갱신 DTO (REQ-260609B FR-2).
 *
 * PUT 은 부분 갱신(생략된 필드는 기존값 유지). 값은 평문 비교용 식별자이므로
 * 별도 비밀 마스킹 없이 응답에도 그대로 노출한다.
 */
export class UpdateAmaConfigDto {
  @ApiPropertyOptional({
    description: '사용할 AMA 법인 entityId (AMA 법인 설정의 entityId/UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  amaEntityId?: string;

  @ApiPropertyOptional({
    description: '커스텀앱 appCode (커스텀앱 등록 시 작성한 앱 이름)',
    example: 'tpi-acm',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  appCode?: string;

  @ApiPropertyOptional({
    description: 'false 면 이 설정으로의 로그인을 전면 차단',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'local_config 모드: Custom App HS256 서명 secret. 보낼 때만 AES-GCM 암호화 저장. 응답 미노출.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  customAppSecret?: string;

  @ApiPropertyOptional({
    description: '기대 scope (Custom App 토큰의 scope 비교)',
    example: 'custom_app:context',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  expectedScope?: string;

  @ApiPropertyOptional({
    description:
      'local_config 모드: Custom Category(custom_category:context) HS256 서명 secret. ' +
      '커스텀앱 secret 과 별개. 보낼 때만 AES-GCM 암호화 저장. 응답 미노출.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(400)
  categorySecret?: string;

  @ApiPropertyOptional({
    description: '커스텀카테고리 slug (토큰 eccSlug 와 비교)',
    example: 'tpi-academy',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  categorySlug?: string;
}

/** AMA 연동 설정 응답 DTO. secret 은 isSet 플래그로만 노출. */
export class AmaConfigResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() entId!: string;
  @ApiProperty() amaEntityId!: string;
  @ApiProperty() appCode!: string;
  @ApiProperty() isActive!: boolean;
  /** Custom App secret 이 저장돼 있는지 여부만 (값 미노출). */
  @ApiProperty() customAppSecretIsSet!: boolean;
  @ApiPropertyOptional() expectedScope?: string | null;
  /** Custom Category secret 이 저장돼 있는지 여부만 (값 미노출). */
  @ApiProperty() categorySecretIsSet!: boolean;
  @ApiPropertyOptional() categorySlug?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
