import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthService } from './application/acm-auth.service';
import { SubscriptionCheckService } from './application/subscription-check.service';
import { UserMembershipGuard } from './application/user-membership.guard';
import { EntityGateService } from './application/entity-gate.service';
import { AmaConfigService } from './application/ama-config.service';
import { AmaConfigGateService } from './application/ama-config-gate.service';
import { AmaUserDirectoryService } from './application/ama-user-directory.service';
import { ParentAuthService } from './application/parent-auth.service';
import { ParentPortalService } from './application/parent-portal.service';
import { AcmJwtStrategy } from './jwt/acm-jwt.strategy';
import { ParentJwtStrategy } from './jwt/parent-jwt.strategy';
import { AcmJwtAuthGuard } from './guards/acm-jwt-auth.guard';
import { ParentJwtAuthGuard } from './guards/parent-jwt-auth.guard';
import { AcmAuthController } from './presentation/acm-auth.controller';
import { AmaUserController } from './presentation/ama-user.controller';
import { AmaConfigController } from './presentation/ama-config.controller';
import { ParentAuthController } from './presentation/parent-auth.controller';
import { PortalMyController } from './presentation/portal-my.controller';
import { AcmTenantTypeormEntity } from '../acm-system/infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmUserTypeormEntity } from './infrastructure/typeorm/acm-user.typeorm-entity';
import { AmaConfigTypeormEntity } from './infrastructure/typeorm/ama-config.typeorm-entity';
import { ParentTypeormEntity } from '../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentParentTypeormEntity } from '../acm-std/infrastructure/typeorm/student-parent.typeorm-entity';
import { StudentTypeormEntity } from '../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { ClassStudentTypeormEntity } from '../acm-cls/infrastructure/typeorm/class-student.typeorm-entity';
import { ClassTypeormEntity } from '../acm-cls/infrastructure/typeorm/class.typeorm-entity';
import { SessionTypeormEntity } from '../acm-cls/infrastructure/typeorm/session.typeorm-entity';
import { ClsEnrollmentTypeormEntity } from '../acm-cls/infrastructure/typeorm/cls-enrollment.typeorm-entity';
import { MapScoreTypeormEntity } from '../acm-map/infrastructure/typeorm/map-score.typeorm-entity';
import { PayOrderTypeormEntity } from '../acm-pay/infrastructure/typeorm/pay-order.typeorm-entity';
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
import { AmaCustomAppVerifier } from './infrastructure/ama-custom-app.verifier';
import { AesGcmService } from '../acm-common/crypto/aes-gcm.service';

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
 * AMA_OAUTH_CLIENT provider (REQ-260609C). Decoupled from AMA_SERVICES_MODE:
 * when AMA_TOKEN_VERIFY_MODE=ama_session the OAuth client MUST hit the real
 * gateway (a mock would trust tokens without verification), so http is forced.
 * Otherwise it follows AMA_SERVICES_MODE (mock by default; OAuth unused in local
 * mode anyway). Used by AmaSessionExchanger for grant exchange + introspect.
 */
const amaOAuthProvider: Provider = {
  provide: AMA_OAUTH_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const verifyMode = String(
      config.get('AMA_TOKEN_VERIFY_MODE', 'local'),
    ).toLowerCase();
    const servicesMode = String(
      config.get('AMA_SERVICES_MODE', 'mock'),
    ).toLowerCase();
    if (verifyMode === 'ama_session' || servicesMode === 'http') {
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
      [
        AcmUserTypeormEntity,
        AmaConfigTypeormEntity,
        AcmTenantTypeormEntity,
        ParentTypeormEntity,
        StudentParentTypeormEntity,
        StudentTypeormEntity,
        ClassStudentTypeormEntity,
        ClassTypeormEntity,
        SessionTypeormEntity,
        ClsEnrollmentTypeormEntity,
        MapScoreTypeormEntity,
        PayOrderTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [
    AcmAuthController,
    AmaUserController,
    AmaConfigController,
    ParentAuthController,
    PortalMyController,
  ],
  providers: [
    AcmAuthService,
    ParentAuthService,
    ParentPortalService,
    SubscriptionCheckService,
    UserMembershipGuard,
    EntityGateService,
    AmaConfigService,
    AmaConfigGateService,
    AmaUserDirectoryService,
    AmaSessionExchanger,
    AmaCustomAppVerifier,
    AesGcmService,
    stgAppsSubscriptionProvider,
    amaPlatformProvider,
    amaOAuthProvider,
    AcmJwtStrategy,
    ParentJwtStrategy,
    AcmJwtAuthGuard,
    ParentJwtAuthGuard,
    AmaTokenVerifier,
  ],
  exports: [
    AcmAuthService,
    ParentAuthService,
    AcmJwtAuthGuard,
    ParentJwtAuthGuard,
  ],
})
export class AcmAuthModule {}
