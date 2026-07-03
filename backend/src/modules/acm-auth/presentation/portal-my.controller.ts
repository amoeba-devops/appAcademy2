import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AcmCurrentUser } from '../../acm-common/decorators/current-user.decorator';
import {
  PortalOptionalStudentQueryDto,
  PortalStudentQueryDto,
  PortalTimetableQueryDto,
} from '../application/dto/parent-portal.dto';
import { ParentPortalService } from '../application/parent-portal.service';
import { ParentJwtAuthGuard } from '../guards/parent-jwt-auth.guard';

@ApiTags('portal-my')
@ApiBearerAuth()
@UseGuards(ParentJwtAuthGuard)
@Controller('portal/my')
export class PortalMyController {
  constructor(private readonly parentPortalService: ParentPortalService) {}

  @Get('children')
  @ApiOperation({ summary: 'Get linked children and default dashboard KPI' })
  getChildren(@CurrentUser() user: AcmCurrentUser) {
    return this.parentPortalService.getChildren(user.id, user.entId);
  }

  @Get('kpi')
  @ApiOperation({ summary: 'Get dashboard KPI for one linked student' })
  getKpi(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: PortalStudentQueryDto,
  ) {
    return this.parentPortalService.getKpi(user.id, user.entId, query.studentId);
  }

  @Get('timetable')
  @ApiOperation({ summary: 'Get weekly timetable for one linked student' })
  getTimetable(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: PortalTimetableQueryDto,
  ) {
    return this.parentPortalService.getTimetable(
      user.id,
      user.entId,
      query.studentId,
      query.weekStart,
    );
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get payment history for linked students' })
  getPayments(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: PortalOptionalStudentQueryDto,
  ) {
    return this.parentPortalService.getPayments(
      user.id,
      user.entId,
      query.studentId,
    );
  }

  @Get('scores')
  @ApiOperation({ summary: 'Get MAP score history for linked students' })
  getScores(
    @CurrentUser() user: AcmCurrentUser,
    @Query() query: PortalOptionalStudentQueryDto,
  ) {
    return this.parentPortalService.getScores(
      user.id,
      user.entId,
      query.studentId,
    );
  }
}
