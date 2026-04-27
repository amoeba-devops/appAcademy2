import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';
import { ActiveTenantUser } from '../decorators/active-tenant.decorator';

/**
 * ActiveTenantGuard — JwtAuthGuard 이후에 적용.
 *
 * 책임:
 *  1) request.user.activeAcademyId 를 결정 (헤더 우선, 없으면 JWT 의 activeAcdId)
 *  2) 사용자가 해당 academy 에 ACTIVE 멤버십을 가졌는지 검증
 *  3) request.user 에 activeAcademyId/role 주입 → @ActiveTenant() 가 사용
 *
 * 헤더: `X-Active-Tenant: <acdId>` — 다중 멤버십 사용자가 명시적 전환할 때.
 */
@Injectable()
export class ActiveTenantGuard implements CanActivate {
  constructor(
    @InjectRepository(UserAcademyEntity)
    private readonly memberRepo: Repository<UserAcademyEntity>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as ActiveTenantUser | undefined;
    if (!user || typeof user.userId !== 'number') {
      throw new ForbiddenException('NO_USER');
    }

    const headerVal = req.headers?.['x-active-tenant'];
    const headerAcdId = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    const headerId = headerAcdId ? Number(headerAcdId) : NaN;

    const requestedAcdId = Number.isFinite(headerId)
      ? headerId
      : (user.activeAcademyId ?? user.academyId ?? null);

    if (requestedAcdId == null) {
      throw new ForbiddenException('NO_ACTIVE_TENANT');
    }

    const membership = await this.memberRepo.findOne({
      where: {
        usrId: user.userId,
        acdId: requestedAcdId,
        uamStatus: 'ACTIVE',
      },
    });
    if (!membership) {
      throw new ForbiddenException('TENANT_MEMBERSHIP_REQUIRED');
    }

    user.activeAcademyId = requestedAcdId;
    user.academyId = requestedAcdId;
    user.role = membership.uamRole;
    return true;
  }
}
