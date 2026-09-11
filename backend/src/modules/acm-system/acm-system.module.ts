import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AesGcmService } from '../acm-common/crypto/aes-gcm.service';
import { Ga4DataClient } from '../acm-common/ga4/ga4-data.client';
import { AcmTenantTypeormEntity } from './infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from './infrastructure/typeorm/acm-tenant-menu.typeorm-entity';
import { MailConfigTypeormEntity } from './infrastructure/typeorm/mail-config.typeorm-entity';
import { KakaoConfigTypeormEntity } from './infrastructure/typeorm/kakao-config.typeorm-entity';
import { Ga4ConfigTypeormEntity } from './infrastructure/typeorm/ga4-config.typeorm-entity';
import { SystemUserService } from './application/system-user.service';
import { TenantService } from './application/tenant.service';
import { MailConfigService } from './application/mail-config.service';
import { TenantMailerService } from './application/tenant-mailer.service';
import { TenantSettingsService } from './application/tenant-settings.service';
import { KakaoConfigService } from './application/kakao-config.service';
import { SolapiAlimtalkService } from './application/solapi-alimtalk.service';
import { Ga4ConfigService } from './application/ga4-config.service';
import { SystemUserController } from './presentation/system-user.controller';
import { SystemTenantController } from './presentation/system-tenant.controller';
import { MeMenuController } from './presentation/me-menu.controller';
import { MailConfigController } from './presentation/mail-config.controller';
import { TenantSettingsController } from './presentation/tenant-settings.controller';
import { KakaoConfigController } from './presentation/kakao-config.controller';
import { Ga4ConfigController } from './presentation/ga4-config.controller';

/**
 * REQ-260621 — System administration module (APP_ADMIN, cross-tenant) +
 * tenant registry / per-tenant menu visibility (v1.1).
 * Reuses AcmAuthService (password policy + hashing + lock) from AcmAuthModule.
 * REQ-260902B — 테넌트 메일(SMTP) 설정 + TenantMailerService (export).
 * PLN-260912 — 테넌트 GA4 설정 + Ga4ConfigService (export, used by acm-dsh sync).
 */
@Module({
  imports: [
    AcmAuthModule,
    TypeOrmModule.forFeature(
      [
        AcmUserTypeormEntity,
        AcmTenantTypeormEntity,
        AcmTenantMenuTypeormEntity,
        MailConfigTypeormEntity,
        KakaoConfigTypeormEntity,
        Ga4ConfigTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [
    SystemUserController,
    SystemTenantController,
    MeMenuController,
    MailConfigController,
    TenantSettingsController,
    KakaoConfigController,
    Ga4ConfigController,
  ],
  providers: [
    SystemUserService,
    TenantService,
    AesGcmService,
    MailConfigService,
    TenantMailerService,
    TenantSettingsService,
    KakaoConfigService,
    SolapiAlimtalkService,
    Ga4DataClient,
    Ga4ConfigService,
  ],
  exports: [
    TenantMailerService,
    TenantSettingsService,
    SolapiAlimtalkService,
    Ga4ConfigService,
  ],
})
export class AcmSystemModule {}
