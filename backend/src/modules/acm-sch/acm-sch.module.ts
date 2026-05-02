import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { SchoolTypeormEntity } from './infrastructure/typeorm/school.typeorm-entity';
import { GradeBandTypeormEntity } from './infrastructure/typeorm/grade-band.typeorm-entity';
import { ScheduleTypeormEntity } from './infrastructure/typeorm/schedule.typeorm-entity';
import { SchoolService } from './application/school.service';
import { GradeBandService } from './application/grade-band.service';
import { ScheduleService } from './application/schedule.service';
import { SchSchoolPublicService } from './application/sch-school-public.service';
import { SchoolController } from './presentation/school.controller';
import { GradeBandController } from './presentation/grade-band.controller';
import { ScheduleController } from './presentation/schedule.controller';
import { SchoolRepositoryImpl } from './infrastructure/typeorm/school.repository.impl';
import { SCHOOL_REPOSITORY } from './domain/school.repository';

/**
 * acm-sch — School Master Module
 * @see acm-v1.0a-fn-sch-001.md
 * @see docs/analysis/acm-fn-sch-qna-p1-requirements.md
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [SchoolTypeormEntity, GradeBandTypeormEntity, ScheduleTypeormEntity],
      ACM_DS,
    ),
  ],
  controllers: [SchoolController, GradeBandController, ScheduleController],
  providers: [
    SchoolService,
    GradeBandService,
    ScheduleService,
    SchSchoolPublicService,
    { provide: SCHOOL_REPOSITORY, useClass: SchoolRepositoryImpl },
  ],
  exports: [SchoolService, SchSchoolPublicService, SCHOOL_REPOSITORY],
})
export class AcmSchModule {}
