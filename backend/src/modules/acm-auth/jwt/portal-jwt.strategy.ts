import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  PortalAccountService,
  type PortalJwtPayload,
} from '../application/portal-account.service';

export const PORTAL_JWT_STRATEGY = 'portal-jwt';

/**
 * PLN-260706 — validates the unified portal JWT (student/parent/teacher) and
 * re-checks the account is ACTIVE on every request. Signed with the shared
 * ACM_JWT_SECRET (same as admin/parent tokens) but a distinct payload shape.
 */
@Injectable()
export class PortalJwtStrategy extends PassportStrategy(
  Strategy,
  PORTAL_JWT_STRATEGY,
) {
  constructor(
    config: ConfigService,
    private readonly accounts: PortalAccountService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>(
        'ACM_JWT_SECRET',
        'acm-dev-secret-change-in-production',
      ),
    });
  }

  async validate(payload: PortalJwtPayload) {
    if (!payload?.sub || !payload?.entId || !payload?.kind) {
      throw new UnauthorizedException('Invalid portal token');
    }
    const user = await this.accounts.findActiveById(payload.sub, payload.entId);
    if (!user) {
      throw new UnauthorizedException('Portal account not active');
    }
    return user;
  }
}
