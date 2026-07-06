import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PORTAL_JWT_STRATEGY } from '../jwt/portal-jwt.strategy';

@Injectable()
export class PortalJwtAuthGuard extends AuthGuard(PORTAL_JWT_STRATEGY) {}
