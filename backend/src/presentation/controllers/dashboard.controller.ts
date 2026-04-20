import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GetDashboardKpiUseCase } from '../../application/use-cases/dashboard';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly getKpi: GetDashboardKpiUseCase) {}

  @Get('kpi')
  @ApiOperation({ summary: 'Dashboard KPI summary (대시보드 KPI)' })
  async kpi(@CurrentUser() user: { academyId: number }) {
    return this.getKpi.execute(user.academyId);
  }
}
