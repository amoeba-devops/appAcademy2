import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../infrastructure/database/entities/user.entity';
import { ParentEntity } from '../../infrastructure/database/entities/parent.entity';
import { UserAcademyEntity } from '../../infrastructure/database/entities/user-academy.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ParentAuthController } from './parent-auth.controller';
import { ParentAuthService } from './parent-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { AmaAuthController, AmaOidcServiceRef } from './ama-auth.controller';
import { AmaOidcStateStore } from './ama-oidc-state.store';
import { AmaSsoUseCase } from '../../application/auth/ama-sso.use-case';
import { AmaAuthModule } from '../../infrastructure/external/ama/auth/ama-auth.module';
import { ActiveTenantGuard } from '../../common/guards/active-tenant.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'tac-dev-secret-change-in-production'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '8h'),
        },
      }),
    }),
    TypeOrmModule.forFeature([UserEntity, ParentEntity, UserAcademyEntity]),
    AmaAuthModule,
  ],
  controllers: [AuthController, ParentAuthController, AmaAuthController],
  providers: [
    AuthService,
    ParentAuthService,
    JwtStrategy,
    AmaSsoUseCase,
    AmaOidcStateStore,
    AmaOidcServiceRef,
    ActiveTenantGuard,
  ],
  exports: [
    AuthService,
    ParentAuthService,
    JwtModule,
    PassportModule,
    AmaSsoUseCase,
    ActiveTenantGuard,
    TypeOrmModule,
  ],
})
export class AuthModule {}
