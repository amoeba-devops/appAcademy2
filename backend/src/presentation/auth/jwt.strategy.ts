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
    // JWT claims (`sub`, `acdId`) are serialized as strings by jsonwebtoken.
    // Coerce to number so downstream SQL parameter binding and TypeORM
    // numeric column comparisons behave as expected.
    const toNum = (v: unknown): number =>
      typeof v === 'number' ? v : Number(v);
    return {
      userId: toNum(payload.sub),
      academyId: payload.acdId != null ? toNum(payload.acdId) : null,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      amaUserId: payload.amaUserId,
      activeAcademyId: toNum(payload.activeAcdId ?? payload.acdId),
    };
  }
}
