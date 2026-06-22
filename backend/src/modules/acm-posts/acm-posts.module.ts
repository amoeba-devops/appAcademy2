import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { ClassroomTypeormEntity } from './infrastructure/typeorm/classroom.typeorm-entity';
import { PostTypeormEntity } from './infrastructure/typeorm/post.typeorm-entity';
import { ProgramSettingTypeormEntity } from './infrastructure/typeorm/program-setting.typeorm-entity';
import { ProgramTypeormEntity } from './infrastructure/typeorm/program.typeorm-entity';

/**
 * REQ-260622 Phase 2 — `acm-posts` 모듈.
 *
 * Holds 4 catalog-style tables that don't fit anywhere else:
 *   - amb_acm_post              학원 게시판 (notice / event / result)
 *   - amb_acm_program           프로그램 카탈로그
 *   - amb_acm_program_setting   수강료·정원·환불정책 (1:1 → program)
 *   - amb_acm_classroom         물리 교실 마스터
 *
 * Phase 2 follow-up adds the controllers + services + portal-facing
 * read paths.
 *
 * NOT imported into app.module.ts yet.
 */
import { ClassroomService } from './application/services/classroom.service';
import { PostService } from './application/services/post.service';
import { ProgramService } from './application/services/program.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        PostTypeormEntity,
        ProgramTypeormEntity,
        ProgramSettingTypeormEntity,
        ClassroomTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  providers: [PostService, ProgramService, ClassroomService],
  exports: [PostService, ProgramService, ClassroomService],
})
export class AcmPostsModule {}
