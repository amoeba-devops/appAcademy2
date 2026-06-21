import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { SystemUserService } from './application/system-user.service';
import { SystemUserController } from './presentation/system-user.controller';

/**
 * REQ-260621 — System administration module (APP_ADMIN, cross-tenant).
 * Reuses AcmAuthService (password policy + hashing + lock) from AcmAuthModule.
 */
@Module({
  imports: [
    AcmAuthModule,
    TypeOrmModule.forFeature([AcmUserTypeormEntity], ACM_DS),
  ],
  controllers: [SystemUserController],
  providers: [SystemUserService],
})
export class AcmSystemModule {}
