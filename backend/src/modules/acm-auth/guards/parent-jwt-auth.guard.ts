import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PARENT_JWT_STRATEGY } from '../jwt/parent-jwt.strategy';

@Injectable()
export class ParentJwtAuthGuard extends AuthGuard(PARENT_JWT_STRATEGY) {}
