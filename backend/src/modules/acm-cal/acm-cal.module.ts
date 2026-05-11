import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcmUserTypeormEntity } from '../acm-auth/infrastructure/typeorm/acm-user.typeorm-entity';
import { ACM_DS } from '../acm-common/datasource';
import { ParentTypeormEntity } from '../acm-std/infrastructure/typeorm/parent.typeorm-entity';
import { StudentTypeormEntity } from '../acm-std/infrastructure/typeorm/student.typeorm-entity';
import { TeacherTypeormEntity } from '../acm-tch/infrastructure/typeorm/teacher.typeorm-entity';
import { CalEventService } from './application/cal-event.service';
import { CalInviteeService } from './application/cal-invitee.service';
import { InviteeNotifierService } from './application/invitee-notifier.service';
import { CalEventTypeormEntity } from './infrastructure/typeorm/cal-event.typeorm-entity';
import { CalInviteeTypeormEntity } from './infrastructure/typeorm/cal-invitee.typeorm-entity';
import { CalEventController } from './presentation/cal-event.controller';
import { CalInviteeCandidateController } from './presentation/cal-invitee-candidate.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        CalEventTypeormEntity,
        CalInviteeTypeormEntity,
        AcmUserTypeormEntity,
        StudentTypeormEntity,
        TeacherTypeormEntity,
        ParentTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [CalEventController, CalInviteeCandidateController],
  providers: [CalEventService, CalInviteeService, InviteeNotifierService],
  exports: [CalEventService],
})
export class AcmCalModule {}
