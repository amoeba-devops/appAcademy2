import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
// REQ-260526 v2 — BODA 화상 강의실 연동.
import { BodaConfigTypeormEntity } from './infrastructure/typeorm/boda-config.typeorm-entity';
import { BodaRoomTypeormEntity } from './infrastructure/typeorm/boda-room.typeorm-entity';
import { BodaParticipantTypeormEntity } from './infrastructure/typeorm/boda-participant.typeorm-entity';
import { BodaEventLogTypeormEntity } from './infrastructure/typeorm/boda-event-log.typeorm-entity';
import { BodaConfigService } from './application/boda-config.service';
import { CalEventController } from './presentation/cal-event.controller';
import { CalInviteeCandidateController } from './presentation/cal-invitee-candidate.controller';
import { BodaConfigController } from './presentation/boda-config.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature(
      [
        CalEventTypeormEntity,
        CalInviteeTypeormEntity,
        AcmUserTypeormEntity,
        StudentTypeormEntity,
        TeacherTypeormEntity,
        ParentTypeormEntity,
        // BODA integration tables (T1 schema + T3 config service).
        BodaConfigTypeormEntity,
        BodaRoomTypeormEntity,
        BodaParticipantTypeormEntity,
        BodaEventLogTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [
    CalEventController,
    CalInviteeCandidateController,
    BodaConfigController,
  ],
  providers: [
    CalEventService,
    CalInviteeService,
    InviteeNotifierService,
    BodaConfigService,
  ],
  exports: [CalEventService, BodaConfigService],
})
export class AcmCalModule {}
