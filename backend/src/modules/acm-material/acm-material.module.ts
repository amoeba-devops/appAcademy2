import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ObjectStoreClient } from '../acm-csl/infrastructure/external/object-store.client';
import { MaterialService } from './application/material.service';
import { MaterialTypeormEntity } from './infrastructure/typeorm/material.typeorm-entity';
import { MaterialAdminController } from './presentation/material-admin.controller';
import { PortalMaterialController } from './presentation/portal-material.controller';

/**
 * PLN-260706 Phase 3 — 자료실 / 수업자료 (class materials).
 * Routes: /acm/materials (teacher/admin), /portal/materials (portal).
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([MaterialTypeormEntity], ACM_DS),
  ],
  controllers: [MaterialAdminController, PortalMaterialController],
  providers: [MaterialService, ObjectStoreClient],
})
export class AcmMaterialModule {}
