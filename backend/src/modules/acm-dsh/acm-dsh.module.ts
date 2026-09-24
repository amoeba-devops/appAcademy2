import { AdsOAuthService } from './ads/ads-oauth.service';
import { AdsService } from './ads/ads.service';
import { AdsProviderClient } from './ads/ads-provider.client';
import { AdsJob } from './ads/ads.job';
import { AdsController, AdsCostController } from './ads/ads.controller';
import { MarketingInputService } from './application/marketing-input.service';
import { OperatingService } from './application/operating.service';
import { SourceCurrentService } from './application/source-current.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ACM_DS } from '../acm-common/datasource';
import { Ga4DataClient } from '../acm-common/ga4/ga4-data.client';
import { AcmSystemModule } from '../acm-system/acm-system.module';
import { MetricDefinitionTypeormEntity } from './infrastructure/typeorm/metric-definition.typeorm-entity';
import { ManualInputTypeormEntity } from './infrastructure/typeorm/manual-input.typeorm-entity';
import { ComplaintTypeormEntity } from './infrastructure/typeorm/complaint.typeorm-entity';
import { DailyKpiTypeormEntity } from './infrastructure/typeorm/daily-kpi.typeorm-entity';
import { DailyKpiSiteTypeormEntity } from './infrastructure/typeorm/daily-kpi-site.typeorm-entity';
import { SiteVisitTypeormEntity } from './infrastructure/typeorm/site-visit.typeorm-entity';
import { MetricDefinitionService } from './application/metric-definition.service';
import { ManualInputService } from './application/manual-input.service';
import { ComplaintService } from './application/complaint.service';
import { DailyKpiService } from './application/daily-kpi.service';
import { CslSiteAttributionListener } from './application/csl-site-attribution.listener';
import { DailyKpiJob } from './application/daily-kpi.job';
import { MonthlySummaryService } from './application/monthly-summary.service';
import { Ga4SyncService } from './application/ga4-sync.service';
import { Ga4SyncJob } from './application/ga4-sync.job';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * acm-dsh — Dashboard Module (per acm-req-dsh-001 v1.0a)
 * 4 tables: metric_definitions / daily_kpi / manual_inputs / complaints
 * PLN-260912: + site_visit (GA4 visitor sync, nightly 04:00 KST)
 */
@Module({
  imports: [
    AcmSystemModule,
    TypeOrmModule.forFeature(
      [
        MetricDefinitionTypeormEntity,
        ManualInputTypeormEntity,
        ComplaintTypeormEntity,
        DailyKpiTypeormEntity,
        DailyKpiSiteTypeormEntity,
        SiteVisitTypeormEntity,
      ],
      ACM_DS,
    ),
  ],
  controllers: [DashboardController, AdsController, AdsCostController],
  providers: [
    AdsService,
    AdsProviderClient,
    AdsJob,
    AdsOAuthService,
    MarketingInputService,
    OperatingService,
    SourceCurrentService,
    MetricDefinitionService,
    ManualInputService,
    ComplaintService,
    DailyKpiService,
    DailyKpiJob,
    MonthlySummaryService,
    Ga4DataClient,
    Ga4SyncService,
    Ga4SyncJob,
    CslSiteAttributionListener, // 요구 260914G
  ],
  exports: [DailyKpiService],
})
export class AcmDshModule {}
