import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'tac-dev-secret-change-in-production'),
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      academyId: payload.acdId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      amaUserId: payload.amaUserId,
      activeAcademyId: payload.activeAcdId ?? payload.acdId,
    };
  }
}
