import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AcmJwtPayload, AcmAuthService } from '../application/acm-auth.service';

export const ACM_JWT_STRATEGY = 'acm-jwt';

@Injectable()
export class AcmJwtStrategy extends PassportStrategy(Strategy, ACM_JWT_STRATEGY) {
  constructor(
    config: ConfigService,
    private readonly authService: AcmAuthService,
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

  async validate(payload: AcmJwtPayload): Promise<{
    id: string;
    entId: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'TEACHER' | 'STAFF';
  }> {
    if (!payload?.sub || !payload?.entId) {
      throw new UnauthorizedException('Invalid token');
    }
    // Optional: re-check user is still ACTIVE.
    const u = await this.authService.findById(payload.sub);
    if (!u) throw new UnauthorizedException('User not active');
    return { ...u, role: u.role ?? payload.role ?? 'ADMIN' };
  }
}
