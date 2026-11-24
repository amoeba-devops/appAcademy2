import { Module } from '@nestjs/common';
import { AcmAuthModule } from '../acm-auth/acm-auth.module';
import { PortalMenuService } from './application/portal-menu.service';
import {
  PortalMenuController,
  TenantPortalMenuController,
} from './presentation/portal-menu.controller';

@Module({
  imports: [AcmAuthModule],
  providers: [PortalMenuService],
  controllers: [PortalMenuController, TenantPortalMenuController],
  exports: [PortalMenuService],
})
export class PortalMenuModule {}
