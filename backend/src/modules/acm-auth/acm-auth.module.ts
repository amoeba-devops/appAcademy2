import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { AcmAuthService } from './application/acm-auth.service';
import { SubscriptionCheckService } from './application/subscription-check.service';
import { AcmJwtStrategy } from './jwt/acm-jwt.strategy';
import { AcmJwtAuthGuard } from './guards/acm-jwt-auth.guard';
import { AcmAuthController } from './presentation/acm-auth.controller';
import { AcmUserTypeormEntity } from './infrastructure/typeorm/acm-user.typeorm-entity';
import { AmaTokenVerifier } from './infrastructure/ama-token.verifier';
import { STG_APPS_SUBSCRIPTION_CLIENT } from './infrastructure/stg-apps-subscription.client';
import { StgAppsSubscriptionMockClient } from './infrastructure/stg-apps-subscription-mock.client';
import { StgAppsSubscriptionHttpClient } from './infrastructure/stg-apps-subscription-http.client';

/**
 * STG_APPS_SUBSCRIPTION_CLIENT provider — picks mock or http based on
 * `AMA_SERVICES_MODE`. Same toggle is reused by AmaPlatformClient (T3/T4)
 * so the whole AMA outbound surface flips together.
 *
 * See REQ-260604 v2 § 9.3 (env vars) and PLN-260604 v2 § 5.
 */
const stgAppsSubscriptionProvider: Provider = {
  provide: STG_APPS_SUBSCRIPTION_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_SERVICES_MODE', 'mock')).toLowerCase();
    if (mode === 'http') {
      return new StgAppsSubscriptionHttpClient(config);
    }
    return new StgAppsSubscriptionMockClient();
  },
};

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
    // here so SubscriptionCheckService can read/refresh the local cache
    // and fall back to it when stg-apps is unavailable (REQ-260604 v2 FR-1/FR-9).
    TypeOrmModule.forFeature([AcademyEntity]),
  ],
  controllers: [AcmAuthController],
  providers: [
    AcmAuthService,
    SubscriptionCheckService,
    stgAppsSubscriptionProvider,
    AcmJwtStrategy,
    AcmJwtAuthGuard,
    AmaTokenVerifier,
  ],
  exports: [AcmAuthService, AcmJwtAuthGuard],
})
export class AcmAuthModule {}
