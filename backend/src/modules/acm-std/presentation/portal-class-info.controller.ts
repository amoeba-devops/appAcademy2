import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalJwtAuthGuard } from '../../acm-auth/guards/portal-jwt-auth.guard';
import { PortalUser } from '../../acm-auth/decorators/portal-user.decorator';
import type { PortalAuthUser } from '../../acm-auth/application/portal-account.service';
import { PortalClassInfoService } from '../application/portal-class-info.service';

/** REQ-261103B — 학생·학부모 포털 수업정보(강사별 과목·교재·수업링크). */
@ApiTags('portal-std')
@ApiBearerAuth()
@Controller('portal/std/class-info')
@UseGuards(PortalJwtAuthGuard)
export class PortalClassInfoController {
  constructor(private readonly svc: PortalClassInfoService) {}

  @Get()
  @ApiOperation({ summary: 'My (or my children’s) class info per teacher' })
  list(@PortalUser() u: PortalAuthUser) {
    return this.svc.list(u.entId, u.kind, u.refId);
  }
}
