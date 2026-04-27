import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CurrentUserPayload } from './current-user.decorator';

/**
 * @ActiveTenant() — 현재 요청의 active academy id 를 주입.
 *
 * - JwtStrategy.validate() 에서 request.user 에 academyId/activeAcademyId 를 세팅.
 * - 헤더 `X-Active-Tenant` 는 ActiveTenantGuard 가 검증·반영.
 * - active tenant 가 없는 사용자(멤버십 0)에 대해서는 ForbiddenException 발생.
 *
 * 사용:
 *   @Get('students')
 *   list(@ActiveTenant() acdId: number) { ... }
 */
export interface ActiveTenantUser extends CurrentUserPayload {
  activeAcademyId?: number | null;
  amaUserId?: string;
}

export const ActiveTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as ActiveTenantUser | undefined;
    const id = user?.activeAcademyId ?? user?.academyId ?? null;
    if (id == null) {
      throw new ForbiddenException('NO_ACTIVE_TENANT');
    }
    return id;
  },
);
