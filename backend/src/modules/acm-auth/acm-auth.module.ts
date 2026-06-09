import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcademyEntity } from '../../infrastructure/database/entities/academy.entity';
import { AcmAuthService } from './application/acm-auth.service';
import { SubscriptionCheckService } from './application/subscription-check.service';
import { UserMembershipGuard } from './application/user-membership.guard';
import { EntityGateService } from './application/entity-gate.service';
import { AmaConfigService } from './application/ama-config.service';
import { AmaConfigGateService } from './application/ama-config-gate.service';
import { AmaUserDirectoryService } from './application/ama-user-directory.service';
import { AcmJwtStrategy } from './jwt/acm-jwt.strategy';
import { AcmJwtAuthGuard } from './guards/acm-jwt-auth.guard';
import { AcmAuthController } from './presentation/acm-auth.controller';
import { AmaUserController } from './presentation/ama-user.controller';
import { AmaConfigController } from './presentation/ama-config.controller';
import { AcmUserTypeormEntity } from './infrastructure/typeorm/acm-user.typeorm-entity';
import { AmaConfigTypeormEntity } from './infrastructure/typeorm/ama-config.typeorm-entity';
import { AmaTokenVerifier } from './infrastructure/ama-token.verifier';
import { STG_APPS_SUBSCRIPTION_CLIENT } from './infrastructure/stg-apps-subscription.client';
import { StgAppsSubscriptionMockClient } from './infrastructure/stg-apps-subscription-mock.client';
import { StgAppsSubscriptionHttpClient } from './infrastructure/stg-apps-subscription-http.client';
import { AMA_PLATFORM_CLIENT } from './infrastructure/ama-platform.client';
import { AmaPlatformMockClient } from './infrastructure/ama-platform-mock.client';
import { AmaPlatformHttpClient } from './infrastructure/ama-platform-http.client';
import { AMA_OAUTH_CLIENT } from './infrastructure/ama-oauth.client';
import { AmaOAuthMockClient } from './infrastructure/ama-oauth-mock.client';
import { AmaOAuthHttpClient } from './infrastructure/ama-oauth-http.client';
import { AmaSessionExchanger } from './infrastructure/ama-session.exchanger';

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

/**
 * AMA_PLATFORM_CLIENT provider — same AMA_SERVICES_MODE toggle as
 * stgAppsSubscriptionProvider so the entire AMA outbound surface flips
 * mock↔http together (REQ-260604 v2 § 9.3).
 */
const amaPlatformProvider: Provider = {
  provide: AMA_PLATFORM_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_SERVICES_MODE', 'mock')).toLowerCase();
    if (mode === 'http') {
      return new AmaPlatformHttpClient(config);
    }
    return new AmaPlatformMockClient();
  },
};

/**
 * AMA_OAUTH_CLIENT provider (REQ-260609C) — same AMA_SERVICES_MODE toggle.
 * Used by AmaSessionExchanger for the ama_session grant exchange + introspect.
 */
const amaOAuthProvider: Provider = {
  provide: AMA_OAUTH_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const mode = String(config.get('AMA_SERVICES_MODE', 'mock')).toLowerCase();
    if (mode === 'http') {
      return new AmaOAuthHttpClient(config);
    }
    return new AmaOAuthMockClient();
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
    TypeOrmModule.forFeature(
      [AcmUserTypeormEntity, AmaConfigTypeormEntity],
      ACM_DS,
    ),
    // AcademyEntity lives on the default (MySQL) datasource — registered
    // here so SubscriptionCheckService can read/refresh the local cache
    // and fall back to it when stg-apps is unavailable (REQ-260604 v2 FR-1/FR-9).
    TypeOrmModule.forFeature([AcademyEntity]),
  ],
  controllers: [AcmAuthController, AmaUserController, AmaConfigController],
  providers: [
    AcmAuthService,
    SubscriptionCheckService,
    UserMembershipGuard,
    EntityGateService,
    AmaConfigService,
    AmaConfigGateService,
    AmaUserDirectoryService,
    AmaSessionExchanger,
    stgAppsSubscriptionProvider,
    amaPlatformProvider,
    amaOAuthProvider,
    AcmJwtStrategy,
    AcmJwtAuthGuard,
    AmaTokenVerifier,
  ],
  exports: [AcmAuthService, AcmJwtAuthGuard],
})
export class AcmAuthModule {}
