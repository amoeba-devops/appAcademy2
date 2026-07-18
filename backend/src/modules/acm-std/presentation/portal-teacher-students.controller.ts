import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { PortalTeacherStudentsService } from '../application/portal-teacher-students.service';

/**
 * PLN-260719 Phase C — 강사 포털 수강생관리 (TEACHER 전용).
 * refId = tch_id. 다른 kind(학생/학부모)는 403.
 */
@ApiTags('portal-teacher')
@ApiBearerAuth()
@Controller('portal/teacher/students')
@UseGuards(PortalJwtAuthGuard)
export class PortalTeacherStudentsController {
  constructor(private readonly svc: PortalTeacherStudentsService) {}

  private assertTeacher(u: PortalAuthUser): void {
    if (u.kind !== 'TEACHER') throw new ForbiddenException('TEACHER_ONLY');
  }

  @Get()
  @ApiOperation({ summary: 'My assigned/class students (teacher only)' })
  list(@PortalUser() u: PortalAuthUser) {
    this.assertTeacher(u);
    return this.svc.listMyStudents(u.entId, u.refId);
  }

  @Get(':stdId')
  @ApiOperation({
    summary: 'Student detail + consult/class records (teacher only)',
  })
  detail(
    @PortalUser() u: PortalAuthUser,
    @Param('stdId', ParseUUIDPipe) stdId: string,
  ) {
    this.assertTeacher(u);
    return this.svc.getMyStudent(u.entId, u.refId, stdId);
  }
}
