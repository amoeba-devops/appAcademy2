import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GetTimetableUseCase } from '../../application/use-cases/timetable/index.js';

@ApiTags('Timetable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timetable')
export class TimetableController {
  constructor(
    private readonly getTimetable: GetTimetableUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get weekly timetable (주간 시간표 조회)' })
  @ApiQuery({ name: 'week', required: false, description: 'Week start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'teacherId', required: false })
  @ApiQuery({ name: 'classroomId', required: false })
  async getWeeklyTimetable(
    @CurrentUser() user: { academyId: number },
    @Query('week') week?: string,
    @Query('teacherId') teacherId?: string,
    @Query('classroomId') classroomId?: string,
  ) {
    return this.getTimetable.execute(user.academyId, {
      week,
      teacherId: teacherId ? parseInt(teacherId, 10) : undefined,
      classroomId: classroomId ? parseInt(classroomId, 10) : undefined,
    });
  }
}
