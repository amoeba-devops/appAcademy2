import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcmJwtAuthGuard } from '../../acm-auth/guards/acm-jwt-auth.guard';
import {
  CurrentUser,
  type AcmCurrentUser,
} from '../../acm-common/decorators/current-user.decorator';
import { OwnEntityGuard } from '../../acm-common/guards/own-entity.guard';
import { Roles } from '../../acm-common/decorators/roles.decorator';
import { RolesGuard } from '../../acm-common/guards/roles.guard';
import {
  InviteeSuggestionsService,
  type InviteeSuggestion,
} from '../application/invitee-suggestions.service';

/**
 * REQ-260610 FR-INSTANT-3 — 즉시 강의 모달의 추천 학생 12명.
 *
 *   GET /api/admin/cal/invitee-suggestions?limit=12
 */
@ApiTags('acm-cal-instant')
@ApiBearerAuth()
@UseGuards(AcmJwtAuthGuard, OwnEntityGuard, RolesGuard)
@Controller('admin/cal/invitee-suggestions')
export class InviteeSuggestionsController {
  constructor(private readonly svc: InviteeSuggestionsService) {}

  @Get()
  @Roles('ADMIN', 'TEACHER')
  @ApiOperation({
    summary: 'Suggest students for the instant class picker',
    description:
      'Union of (a) members of classes taught by the actor and (b) students invited to events the actor owned in the last 7 days. CLASS reason wins on collision. ADMIN role widens the search to all classes/events.',
  })
  async list(
    @CurrentUser() u: AcmCurrentUser,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ): Promise<{ items: InviteeSuggestion[] }> {
    const items = await this.svc.suggest({
      entId: u.entId,
      actorUserId: u.id,
      actorRole: u.role ?? 'TEACHER',
      limit,
    });
    return { items };
  }
}
