import {
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
class PushKeysDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]+={0,2}$/)
  @MaxLength(100)
  p256dh!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]+={0,2}$/) @MaxLength(30) auth!: string;
}
export class PushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint!: string;
  @IsDefined() @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
  /** REQ-261102B — 기기 종류(휴대폰/PC). 없으면 기존 값 유지. */
  @IsOptional() @IsIn(['MOBILE', 'DESKTOP']) device?: 'MOBILE' | 'DESKTOP';
}
