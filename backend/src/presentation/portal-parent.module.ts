import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PortalParentController } from './controllers/portal-parent.controller';

@Module({
  imports: [AuthModule],
  controllers: [PortalParentController],
})
export class PortalParentModule {}
