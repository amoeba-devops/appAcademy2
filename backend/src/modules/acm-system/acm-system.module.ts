import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AesGcmService } from '../acm-common/crypto/aes-gcm.service';
import { AcmTenantTypeormEntity } from './infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from './infrastructure/typeorm/acm-tenant-menu.typeorm-entity';
import { MailConfigTypeormEntity } from './infrastructure/typeorm/mail-config.typeorm-entity';
import { SystemUserService } from './application/system-user.service';
import { TenantService } from './application/tenant.service';
import { MailConfigService } from './application/mail-config.service';
import { TenantMailerService } from './application/tenant-mailer.service';
import { TenantSettingsService } from './application/tenant-settings.service';
import { SystemUserController } from './presentation/system-user.controller';
import { SystemTenantController } from './presentation/system-tenant.controller';
import { MeMenuController } from './presentation/me-menu.controller';
import { MailConfigController } from './presentation/mail-config.controller';
import { TenantSettingsController } from './presentation/tenant-settings.controller';

/**
 * REQ-260621 — System administration module (APP_ADMIN, cross-tenant) +
 * tenant registry / per-tenant menu visibility (v1.1).
 * Reuses AcmAuthService (password policy + hashing + lock) from AcmAuthModule.
 * REQ-260902B — 테넌트 메일(SMTP) 설정 + TenantMailerService (export).
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
  ],
  providers: [
    SystemUserService,
    TenantService,
    AesGcmService,
    MailConfigService,
    TenantMailerService,
    TenantSettingsService,
  ],
  exports: [TenantMailerService, TenantSettingsService],
})
export class AcmSystemModule {}
