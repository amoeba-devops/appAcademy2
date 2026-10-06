import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigAdminGuard } from './config-admin.guard';
import { AmaConfigController } from '../../acm-auth/presentation/ama-config.controller';
import { BodaConfigController } from '../../acm-cal/presentation/boda-config.controller';
import {
  VideoConfigController,
  VideoCapabilitiesController,
  PortalVideoCapabilitiesController,
} from '../../acm-cal/presentation/video-config.controller';
import { MailConfigController } from '../../acm-system/presentation/mail-config.controller';
import { KakaoConfigController } from '../../acm-system/presentation/kakao-config.controller';
import { Ga4ConfigController } from '../../acm-system/presentation/ga4-config.controller';
import { AiConfigController } from '../../acm-system/presentation/ai-config.controller';
import {
  AdsController,
  AdsCostController,
} from '../../acm-dsh/ads/ads.controller';
import { TenantSettingsController } from '../../acm-system/presentation/tenant-settings.controller';
import { BodaDemoController } from '../../acm-cal/presentation/boda-demo.controller';

describe('Configuration endpoint coverage', () => {
  it.each([
    AmaConfigController,
    BodaConfigController,
    VideoConfigController,
    MailConfigController,
    KakaoConfigController,
    Ga4ConfigController,
    AiConfigController,
    AdsController,
  ])('%p requires configuration permission', (controller) => {
    expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toContain(
      ConfigAdminGuard,
    );
  });
  it('protects settings mutation and legacy demo-seed while retaining business read endpoints', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        TenantSettingsController.prototype.update,
      ),
    ).toContain(ConfigAdminGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        BodaDemoController.prototype.seedDemoConfig,
      ),
    ).toContain(ConfigAdminGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        TenantSettingsController.prototype.get,
      ),
    ).not.toContain(ConfigAdminGuard);
    for (const controller of [
      VideoCapabilitiesController,
      PortalVideoCapabilitiesController,
      AdsCostController,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller)).not.toContain(
        ConfigAdminGuard,
      );
    }
  });
});
