import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { MetricDefinitionTypeormEntity } from './infrastructure/typeorm/metric-definition.typeorm-entity';
import { ManualInputTypeormEntity } from './infrastructure/typeorm/manual-input.typeorm-entity';
import { ComplaintTypeormEntity } from './infrastructure/typeorm/complaint.typeorm-entity';
import { DailyKpiTypeormEntity } from './infrastructure/typeorm/daily-kpi.typeorm-entity';
import { MetricDefinitionService } from './application/metric-definition.service';
import { ManualInputService } from './application/manual-input.service';
import { ComplaintService } from './application/complaint.service';
import { DailyKpiService } from './application/daily-kpi.service';
import { DailyKpiJob } from './application/daily-kpi.job';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * acm-dsh — Dashboard Module (per acm-req-dsh-001 v1.0a)
 * 4 tables: metric_definitions / daily_kpi / manual_inputs / complaints
 */
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        MetricDefinitionTypeormEntity,
        ManualInputTypeormEntity,
        ComplaintTypeormEntity,
        DailyKpiTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [DashboardController],
  providers: [
    MetricDefinitionService,
    ManualInputService,
    ComplaintService,
    DailyKpiService,
    DailyKpiJob,
  ],
  exports: [DailyKpiService],
})
export class AcmDshModule {}
