import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ACM_JWT_STRATEGY } from '../jwt/acm-jwt.strategy';

@Injectable()
export class AcmJwtAuthGuard extends AuthGuard(ACM_JWT_STRATEGY) {}
