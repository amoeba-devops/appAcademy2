import { Module } from '@nestjs/common';
import { GetDashboardKpiUseCase } from '../application/use-cases/dashboard';
import { DashboardController } from './controllers/dashboard.controller';

@Module({
  controllers: [DashboardController],
  providers: [GetDashboardKpiUseCase],
})
export class DashboardModule {}
