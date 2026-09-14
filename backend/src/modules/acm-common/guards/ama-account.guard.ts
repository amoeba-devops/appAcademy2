import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AcmCurrentUser } from '../decorators/current-user.decorator';

/**
 * 요구 260914G — AMA 연동 계정에게만 허용하는 동작(상담 삭제·복구) 게이트.
 *
 * 판정 기준은 **계정의 인증 출처**(`amb_acm_user.auth_source = 'ama'`)다.
 * AMA 로 연동된 계정이면 이번 로그인이 로컬 비밀번호였더라도 허용한다
 * (사용자 확정: 계정 기준).
 *
 * `AcmJwtAuthGuard` 뒤에 붙여야 한다 — req.user 가 채워진 뒤 동작한다.
 */
@Injectable()
export class AmaAccountGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: AcmCurrentUser }>();
    if (req.user?.authSource !== 'ama') {
      throw new ForbiddenException('AMA_ACCOUNT_REQUIRED');
    }
    return true;
  }
}
