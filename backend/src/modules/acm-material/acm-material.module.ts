import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ObjectStoreClient } from '../acm-csl/infrastructure/external/object-store.client';
import { MaterialService } from './application/material.service';
import { PortalMaterialService } from './application/portal-material.service';
import { MaterialTypeormEntity } from './infrastructure/typeorm/material.typeorm-entity';
import { MaterialShareTypeormEntity } from './infrastructure/typeorm/material-share.typeorm-entity';
import { MaterialCommentTypeormEntity } from './infrastructure/typeorm/material-comment.typeorm-entity';
import { MaterialRevisionTypeormEntity } from './infrastructure/typeorm/material-revision.typeorm-entity';
import { MaterialAttachmentTypeormEntity } from './infrastructure/typeorm/material-attachment.typeorm-entity';
import { MaterialAdminController } from './presentation/material-admin.controller';
import { PortalMaterialController } from './presentation/portal-material.controller';

/**
 * PLN-260706 Phase 3 / PLN-260718 P3 — 자료실 / 수업자료.
 * Routes: /acm/materials (teacher/admin class materials),
 *         /portal/materials (portal authoring + sharing + comments).
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        MaterialTypeormEntity,
        MaterialShareTypeormEntity,
        MaterialCommentTypeormEntity,
        MaterialRevisionTypeormEntity,
        MaterialAttachmentTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [MaterialAdminController, PortalMaterialController],
  providers: [MaterialService, PortalMaterialService, ObjectStoreClient],
})
export class AcmMaterialModule {}
