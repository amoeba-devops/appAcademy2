import { BadRequestException, PipeTransform } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * 테넌트 ent_id 형식(8-4-4-4-12 hex). validator 13.15+ 의 isUUID 는 버전 자리가 0 인
 * 고정 ID(`00000000-…-000000000001` Trinity, `…00ff` System)를 거부하므로 ent_id 에는
 * IsUUID/ParseUUIDPipe 대신 이 검사를 쓴다.
 */
export const ENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function IsEntId() {
  return Matches(ENT_ID_PATTERN, { message: '$property must be a tenant id' });
}

export class ParseEntIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !ENT_ID_PATTERN.test(value))
      throw new BadRequestException(
        'Validation failed (tenant id is expected)',
      );
    return value;
  }
}
