import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { CalEventService } from './application/cal-event.service';
import { CalEventTypeormEntity } from './infrastructure/typeorm/cal-event.typeorm-entity';
import { CalEventController } from './presentation/cal-event.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CalEventTypeormEntity], ACM_DS)],
  controllers: [CalEventController],
  providers: [CalEventService],
  exports: [CalEventService],
})
export class AcmCalModule {}
