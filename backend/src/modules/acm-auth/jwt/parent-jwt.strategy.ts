import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ParentAuthService, type ParentJwtPayload } from '../application/parent-auth.service';

export const PARENT_JWT_STRATEGY = 'parent-jwt';

@Injectable()
export class ParentJwtStrategy extends PassportStrategy(
  Strategy,
  PARENT_JWT_STRATEGY,
) {
  constructor(
    config: ConfigService,
    private readonly parentAuthService: ParentAuthService,
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

  async validate(payload: ParentJwtPayload) {
    if (!payload?.sub || !payload?.entId || payload?.role !== 'PARENT') {
      throw new UnauthorizedException('Invalid parent token');
    }

    const parent = await this.parentAuthService.findParentUser(
      payload.sub,
      payload.entId,
    );
    if (!parent) {
      throw new UnauthorizedException('Parent not active');
    }
    return parent;
  }
}
