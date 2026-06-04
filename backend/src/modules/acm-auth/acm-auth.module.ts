import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { AcmAuthService } from './application/acm-auth.service';
import { AcademySubscriptionGuard } from './application/academy-subscription.guard';
import { AcmJwtStrategy } from './jwt/acm-jwt.strategy';
import { AcmJwtAuthGuard } from './guards/acm-jwt-auth.guard';
import { AcmAuthController } from './presentation/acm-auth.controller';
import { AcmUserTypeormEntity } from './infrastructure/typeorm/acm-user.typeorm-entity';
import { AmaTokenVerifier } from './infrastructure/ama-token.verifier';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'acm-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'ACM_JWT_SECRET',
          'acm-dev-secret-change-in-production',
        ),
        signOptions: {
          expiresIn: config.get<string>('ACM_JWT_EXPIRES_IN', '12h') as `${number}h`,
        },
      }),
    }),
    TypeOrmModule.forFeature([AcmUserTypeormEntity], ACM_DS),
    // AcademyEntity lives on the default (MySQL) datasource — registered
    // here so AcademySubscriptionGuard can verify tenant subscription
    // status during AMA token exchange (REQ-260604 FR-1).
    TypeOrmModule.forFeature([AcademyEntity]),
  ],
  controllers: [AcmAuthController],
  providers: [
    AcmAuthService,
    AcademySubscriptionGuard,
    AcmJwtStrategy,
    AcmJwtAuthGuard,
    AmaTokenVerifier,
  ],
  exports: [AcmAuthService, AcmJwtAuthGuard],
})
export class AcmAuthModule {}
