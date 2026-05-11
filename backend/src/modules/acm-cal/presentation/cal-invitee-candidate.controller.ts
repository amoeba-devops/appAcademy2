import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { CalInviteeService } from '../application/cal-invitee.service';
import { ListInviteeCandidatesQueryDto } from '../application/dto/cal-event.dto';

@ApiTags('acm-cal')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard)
@Controller('acm/cal/invitee-candidates')
export class CalInviteeCandidateController {
  constructor(private readonly svc: CalInviteeService) {}

  @Get()
  @ApiOperation({ summary: 'Search candidate invitees (students/teachers/parents)' })
  search(
    @CurrentUser() u: AcmCurrentUser,
    @Query() q: ListInviteeCandidatesQueryDto,
  ) {
    return this.svc.searchCandidates(u.entId, q.q, q.kind);
  }
}
