import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { AcmTenantTypeormEntity } from './infrastructure/typeorm/acm-tenant.typeorm-entity';
import { AcmTenantMenuTypeormEntity } from './infrastructure/typeorm/acm-tenant-menu.typeorm-entity';
import { SystemUserService } from './application/system-user.service';
import { TenantService } from './application/tenant.service';
import { SystemUserController } from './presentation/system-user.controller';
import { SystemTenantController } from './presentation/system-tenant.controller';
import { MeMenuController } from './presentation/me-menu.controller';

/**
 * REQ-260621 — System administration module (APP_ADMIN, cross-tenant) +
 * tenant registry / per-tenant menu visibility (v1.1).
 * Reuses AcmAuthService (password policy + hashing + lock) from AcmAuthModule.
 */
@Module({
  imports: [
    AcmAuthModule,
    TypeOrmModule.forFeature(
      [
        AcmUserTypeormEntity,
        AcmTenantTypeormEntity,
        AcmTenantMenuTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [SystemUserController, SystemTenantController, MeMenuController],
  providers: [SystemUserService, TenantService],
})
export class AcmSystemModule {}
