import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { SchoolTypeormEntity } from './infrastructure/typeorm/school.typeorm-entity';
import { SchoolService } from './application/school.service';
import { SchoolController } from './presentation/school.controller';
import { SchoolRepositoryImpl } from './infrastructure/typeorm/school.repository.impl';
import { SCHOOL_REPOSITORY } from './domain/school.repository';

/**
 * acm-sch — School Master Module
 * @see acm-v1.0a-fn-sch-001.md
 */
@Module({
  imports: [TypeOrmModule.forFeature([SchoolTypeormEntity], ACM_DS)],
  controllers: [SchoolController],
  providers: [
    SchoolService,
    { provide: SCHOOL_REPOSITORY, useClass: SchoolRepositoryImpl },
  ],
  exports: [SchoolService, SCHOOL_REPOSITORY],
})
export class AcmSchModule {}
